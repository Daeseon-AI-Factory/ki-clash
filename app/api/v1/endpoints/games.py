"""Game endpoints — create game, submit action, get game state."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import get_current_player
from app.dependencies import get_db
from app.models.player import Player
from app.schemas.game import (
    CreateAIGameRequest,
    GameStateResponse,
    MatchResultResponse,
    RoundResultResponse,
    RoundStateResponse,
    SubmitActionRequest,
    SubmitActionResponse,
    TurnResultResponse,
)
from app.services import game_service
from app.core.game_engine.types import GameState, TurnResult, RoundResult, MatchResult

router = APIRouter()


def _game_state_response(state: GameState) -> GameStateResponse:
    """Convert engine GameState to API response schema."""
    current_round = None
    if state.current_round is not None:
        current_round = RoundStateResponse(
            round_number=state.current_round.round_number,
            p1_ki=state.current_round.p1_ki,
            p2_ki=state.current_round.p2_ki,
            turn_number=state.current_round.turn_number,
            turn_history=[
                TurnResultResponse(
                    turn_number=t.turn_number,
                    p1_action=t.p1_action,
                    p2_action=t.p2_action,
                    outcome=t.outcome,
                    p1_ki_after=t.p1_ki_after,
                    p2_ki_after=t.p2_ki_after,
                )
                for t in state.current_round.turn_history
            ],
        )

    return GameStateResponse(
        game_id=state.game_id,
        match_type=state.match_type.value,
        status=state.status,
        rounds_won_p1=state.rounds_won_p1,
        rounds_won_p2=state.rounds_won_p2,
        current_round=current_round,
        round_results=[
            RoundResultResponse(
                round_number=r.round_number,
                winner=r.winner,
                total_turns=r.total_turns,
            )
            for r in state.round_results
        ],
    )


@router.post("/ai", response_model=GameStateResponse)
async def create_ai_game(
    body: CreateAIGameRequest,
    player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
) -> GameStateResponse:
    """Start a new game vs AI."""
    state = await game_service.create_ai_game(db, player.id, body.difficulty)
    return _game_state_response(state)


@router.get("/{game_id}", response_model=GameStateResponse)
async def get_game(
    game_id: UUID,
    player: Player = Depends(get_current_player),
) -> GameStateResponse:
    """Get current game state."""
    state = await game_service.get_game_state(game_id)
    return _game_state_response(state)


@router.post("/{game_id}/action", response_model=SubmitActionResponse)
async def submit_action(
    game_id: UUID,
    body: SubmitActionRequest,
    player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
) -> SubmitActionResponse:
    """Submit a turn action. AI responds automatically."""
    state, turn_result, round_result, match_result = await game_service.submit_action(
        db, game_id, player.id, body.action
    )

    return SubmitActionResponse(
        turn_result=TurnResultResponse(
            turn_number=turn_result.turn_number,
            p1_action=turn_result.p1_action,
            p2_action=turn_result.p2_action,
            outcome=turn_result.outcome,
            p1_ki_after=turn_result.p1_ki_after,
            p2_ki_after=turn_result.p2_ki_after,
        ),
        round_result=RoundResultResponse(
            round_number=round_result.round_number,
            winner=round_result.winner,
            total_turns=round_result.total_turns,
        ) if round_result else None,
        match_result=MatchResultResponse(
            winner=match_result.winner,
            rounds_won_p1=match_result.rounds_won_p1,
            rounds_won_p2=match_result.rounds_won_p2,
            total_turns=match_result.total_turns,
        ) if match_result else None,
        game_state=_game_state_response(state),
    )
