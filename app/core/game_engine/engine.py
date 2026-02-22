# CORE_CANDIDATE
"""Game engine — manages the full lifecycle of a best-of-3 match.

Orchestrates turn resolution, round tracking, and match completion.
Pure state machine with no I/O dependencies. Reusable for any
simultaneous-action turn-based game.
"""

from app.core.game_engine.outcome_matrix import (
    resolve_turn as _resolve_turn,
    validate_action as _validate_action,
)
from app.core.game_engine.types import (
    Action,
    GameState,
    MatchResult,
    MatchStatus,
    MatchType,
    ROUNDS_TO_WIN,
    RoundResult,
    RoundState,
    RoundWinner,
    TURN_LIMIT,
    TurnOutcome,
    TurnResult,
)


class GameEngine:
    """Stateless engine that advances a GameState through turns, rounds, and match.

    All methods take a GameState and return a new/modified state.
    No side effects, no I/O — suitable for both AI and PvP modes.
    """

    def validate_action(self, action: Action, player_ki: int) -> bool:
        """Check whether a player can afford an action.

        Args:
            action: The action the player wants to take.
            player_ki: The player's current ki.

        Returns:
            True if the player has enough ki.
        """
        return _validate_action(action, player_ki)

    def start_match(self, match_type: MatchType) -> GameState:
        """Create a new match and start the first round.

        Args:
            match_type: Type of match (AI difficulty or PvP).

        Returns:
            GameState with round 1 initialized.
        """
        state = GameState(
            match_type=match_type,
            status=MatchStatus.IN_PROGRESS,
        )
        return self._start_new_round(state)

    def submit_turn(
        self,
        state: GameState,
        p1_action: Action,
        p2_action: Action,
    ) -> tuple[GameState, TurnResult, RoundResult | None, MatchResult | None]:
        """Submit both players' actions and resolve the turn.

        Validates actions, resolves the turn, checks for round/match end.

        Args:
            state: Current game state.
            p1_action: Player 1's chosen action.
            p2_action: Player 2's chosen action.

        Returns:
            Tuple of (updated GameState, TurnResult, optional RoundResult,
            optional MatchResult).

        Raises:
            ValueError: If match is not in progress or no active round.
            ValueError: If a player cannot afford their chosen action.
        """
        if state.status != MatchStatus.IN_PROGRESS:
            raise ValueError(f"Match is not in progress (status={state.status})")

        if state.current_round is None:
            raise ValueError("No active round")

        current_round = state.current_round

        if not self.validate_action(p1_action, current_round.p1_ki):
            raise ValueError(
                f"P1 cannot afford {p1_action.value} (ki={current_round.p1_ki})"
            )
        if not self.validate_action(p2_action, current_round.p2_ki):
            raise ValueError(
                f"P2 cannot afford {p2_action.value} (ki={current_round.p2_ki})"
            )

        turn_number = current_round.turn_number + 1
        turn_result = _resolve_turn(
            turn_number=turn_number,
            p1_action=p1_action,
            p2_action=p2_action,
            p1_ki=current_round.p1_ki,
            p2_ki=current_round.p2_ki,
        )

        # Update round state
        current_round.turn_number = turn_number
        current_round.p1_ki = turn_result.p1_ki_after
        current_round.p2_ki = turn_result.p2_ki_after
        current_round.turn_history.append(turn_result)

        # Check round end
        round_result = self._check_round_end(turn_result, current_round)
        match_result = None

        if round_result is not None:
            if round_result.winner == RoundWinner.P1:
                state.rounds_won_p1 += 1
            elif round_result.winner == RoundWinner.P2:
                state.rounds_won_p2 += 1

            state.round_results.append(round_result)
            state.current_round = None

            match_result = self._check_match_end(state)

            if match_result is not None:
                state.status = MatchStatus.COMPLETED
            else:
                state = self._start_new_round(state)

        return state, turn_result, round_result, match_result

    def forfeit(
        self,
        state: GameState,
        forfeiting_player: RoundWinner,
    ) -> tuple[GameState, MatchResult]:
        """Handle a player forfeiting the match.

        Args:
            state: Current game state.
            forfeiting_player: Which player is forfeiting (P1 or P2).

        Returns:
            Tuple of (updated GameState, MatchResult).
        """
        state.status = MatchStatus.ABANDONED
        winner = (
            RoundWinner.P2 if forfeiting_player == RoundWinner.P1 else RoundWinner.P1
        )

        total_turns = sum(r.total_turns for r in state.round_results)
        if state.current_round:
            total_turns += state.current_round.turn_number

        match_result = MatchResult(
            game_id=state.game_id,
            winner=winner,
            rounds_won_p1=state.rounds_won_p1,
            rounds_won_p2=state.rounds_won_p2,
            round_results=state.round_results,
            total_turns=total_turns,
        )
        return state, match_result

    def _start_new_round(self, state: GameState) -> GameState:
        """Initialize a new round within the match."""
        round_number = len(state.round_results) + 1
        state.current_round = RoundState(
            round_number=round_number,
            p1_ki=0,
            p2_ki=0,
            turn_number=0,
        )
        return state

    def _check_round_end(
        self,
        turn_result: TurnResult,
        round_state: RoundState,
    ) -> RoundResult | None:
        """Check if the current round has ended.

        A round ends when:
        1. A player wins (P1_WINS_ROUND or P2_WINS_ROUND outcome).
        2. Turn limit (20) reached — player with more ki wins; tie → DRAW.
        """
        winner: RoundWinner | None = None

        if turn_result.outcome == TurnOutcome.P1_WINS_ROUND:
            winner = RoundWinner.P1
        elif turn_result.outcome == TurnOutcome.P2_WINS_ROUND:
            winner = RoundWinner.P2
        elif round_state.turn_number >= TURN_LIMIT:
            if round_state.p1_ki > round_state.p2_ki:
                winner = RoundWinner.P1
            elif round_state.p2_ki > round_state.p1_ki:
                winner = RoundWinner.P2
            else:
                winner = RoundWinner.DRAW

        if winner is None:
            return None

        return RoundResult(
            round_number=round_state.round_number,
            winner=winner,
            total_turns=round_state.turn_number,
            final_p1_ki=round_state.p1_ki,
            final_p2_ki=round_state.p2_ki,
        )

    def _check_match_end(self, state: GameState) -> MatchResult | None:
        """Check if the match has ended.

        Match ends when a player reaches ROUNDS_TO_WIN (2) round wins,
        or all 3 rounds played with no winner (1-1 + draw → draw match).
        """
        total_turns = sum(r.total_turns for r in state.round_results)

        if state.rounds_won_p1 >= ROUNDS_TO_WIN:
            return MatchResult(
                game_id=state.game_id,
                winner=RoundWinner.P1,
                rounds_won_p1=state.rounds_won_p1,
                rounds_won_p2=state.rounds_won_p2,
                round_results=state.round_results,
                total_turns=total_turns,
            )

        if state.rounds_won_p2 >= ROUNDS_TO_WIN:
            return MatchResult(
                game_id=state.game_id,
                winner=RoundWinner.P2,
                rounds_won_p1=state.rounds_won_p1,
                rounds_won_p2=state.rounds_won_p2,
                round_results=state.round_results,
                total_turns=total_turns,
            )

        # 3 rounds played, no one has 2 wins → draw
        if len(state.round_results) >= 3:
            return MatchResult(
                game_id=state.game_id,
                winner=RoundWinner.DRAW,
                rounds_won_p1=state.rounds_won_p1,
                rounds_won_p2=state.rounds_won_p2,
                round_results=state.round_results,
                total_turns=total_turns,
            )

        return None
