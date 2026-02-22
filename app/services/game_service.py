"""Game service — orchestrates game creation, turns, and persistence.

Bridges the pure game engine with the database layer.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.ai_opponent.base import create_ai_opponent
from app.core.game_engine.engine import GameEngine
from app.core.game_engine.types import (
    Action,
    Difficulty,
    GameState,
    MatchResult,
    MatchStatus,
    MatchType,
    RoundResult,
    RoundWinner,
    TurnResult,
)
from app.exceptions import GameError, NotFoundError
from app.models.match import Match
from app.models.round import Round as RoundModel
from app.models.turn import Turn as TurnModel

_engine = GameEngine()

# In-memory game state cache (keyed by match UUID).
# For MVP single-server deployment this is fine.
# For scale, move to Redis.
_active_games: dict[UUID, GameState] = {}

_DIFFICULTY_TO_MATCH_TYPE: dict[Difficulty, MatchType] = {
    Difficulty.EASY: MatchType.AI_EASY,
    Difficulty.MEDIUM: MatchType.AI_MEDIUM,
    Difficulty.HARD: MatchType.AI_HARD,
}


async def create_ai_game(
    db: AsyncSession,
    player_id: UUID,
    difficulty: Difficulty,
) -> GameState:
    """Create a new AI game and persist the match record.

    Args:
        db: Database session.
        player_id: The human player's UUID.
        difficulty: AI difficulty level.

    Returns:
        Initial GameState.
    """
    match_type = _DIFFICULTY_TO_MATCH_TYPE[difficulty]
    state = _engine.start_match(match_type)

    # Persist match
    match = Match(
        id=state.game_id,
        player1_id=player_id,
        player2_id=None,
        match_type=match_type.value,
        status=MatchStatus.IN_PROGRESS.value,
    )
    db.add(match)

    # Persist initial round
    assert state.current_round is not None
    round_model = RoundModel(
        match_id=state.game_id,
        round_number=state.current_round.round_number,
    )
    db.add(round_model)
    await db.flush()

    # Store round DB id for later turn persistence
    state.current_round.round_number  # already set

    _active_games[state.game_id] = state
    return state


async def get_game_state(game_id: UUID) -> GameState:
    """Get the in-memory game state.

    Args:
        game_id: Match UUID.

    Returns:
        Current GameState.

    Raises:
        NotFoundError: If game not found in active games.
    """
    state = _active_games.get(game_id)
    if state is None:
        raise NotFoundError("Game", str(game_id))
    return state


async def submit_action(
    db: AsyncSession,
    game_id: UUID,
    player_id: UUID,
    action: Action,
) -> tuple[GameState, TurnResult, RoundResult | None, MatchResult | None]:
    """Submit a player action, have AI respond, resolve the turn.

    Args:
        db: Database session.
        game_id: Match UUID.
        player_id: The human player's UUID.
        action: Player's chosen action.

    Returns:
        Tuple of (GameState, TurnResult, optional RoundResult, optional MatchResult).
    """
    state = _active_games.get(game_id)
    if state is None:
        raise NotFoundError("Game", str(game_id))

    if state.status != MatchStatus.IN_PROGRESS:
        raise GameError("Game is not in progress")

    # Determine AI difficulty from match type
    difficulty_map = {
        MatchType.AI_EASY: Difficulty.EASY,
        MatchType.AI_MEDIUM: Difficulty.MEDIUM,
        MatchType.AI_HARD: Difficulty.HARD,
    }
    difficulty = difficulty_map.get(state.match_type)
    if difficulty is None:
        raise GameError("Not an AI game")

    # Validate player action
    assert state.current_round is not None
    if not _engine.validate_action(action, state.current_round.p1_ki):
        raise GameError(
            f"Cannot afford {action.value} (ki={state.current_round.p1_ki})"
        )

    # Get AI action
    ai = create_ai_opponent(difficulty)
    ai_action = ai.choose_action(state, state.current_round.turn_history)

    # Get current round DB record (for persisting turns)
    round_db = await _get_current_round_db(db, game_id, state.current_round.round_number)

    # Resolve turn
    state, turn_result, round_result, match_result = _engine.submit_turn(
        state, action, ai_action
    )

    # Persist turn
    turn_model = TurnModel(
        round_id=round_db.id,
        turn_number=turn_result.turn_number,
        p1_action=turn_result.p1_action.value,
        p2_action=turn_result.p2_action.value,
        p1_ki_before=turn_result.p1_ki_before,
        p2_ki_before=turn_result.p2_ki_before,
        p1_ki_after=turn_result.p1_ki_after,
        p2_ki_after=turn_result.p2_ki_after,
        outcome=turn_result.outcome.value,
    )
    db.add(turn_model)

    # Handle round end
    if round_result is not None:
        round_db.winner = round_result.winner.value
        round_db.total_turns = round_result.total_turns

        # Update match score
        match_db = await _get_match_db(db, game_id)
        match_db.rounds_won_p1 = state.rounds_won_p1
        match_db.rounds_won_p2 = state.rounds_won_p2

        # If match continues, create new round record
        if match_result is None and state.current_round is not None:
            new_round = RoundModel(
                match_id=game_id,
                round_number=state.current_round.round_number,
            )
            db.add(new_round)

    # Handle match end
    if match_result is not None:
        match_db = await _get_match_db(db, game_id)
        match_db.status = MatchStatus.COMPLETED.value
        match_db.completed_at = datetime.now(timezone.utc)

        if match_result.winner == RoundWinner.P1:
            match_db.winner_id = player_id
        # AI wins → winner_id stays None

        # Update player stats
        from app.models.player import Player
        result = await db.execute(select(Player).where(Player.id == player_id))
        player = result.scalar_one()
        if match_result.winner == RoundWinner.P1:
            player.wins += 1
        elif match_result.winner == RoundWinner.P2:
            player.losses += 1
        else:
            player.draws += 1

        # Clean up in-memory state
        del _active_games[game_id]
    else:
        _active_games[game_id] = state

    await db.flush()
    return state, turn_result, round_result, match_result


async def _get_match_db(db: AsyncSession, game_id: UUID) -> Match:
    result = await db.execute(select(Match).where(Match.id == game_id))
    match = result.scalar_one_or_none()
    if match is None:
        raise NotFoundError("Match", str(game_id))
    return match


async def _get_current_round_db(
    db: AsyncSession, game_id: UUID, round_number: int
) -> RoundModel:
    result = await db.execute(
        select(RoundModel).where(
            RoundModel.match_id == game_id,
            RoundModel.round_number == round_number,
        )
    )
    round_db = result.scalar_one_or_none()
    if round_db is None:
        raise NotFoundError("Round", f"match={game_id} round={round_number}")
    return round_db
