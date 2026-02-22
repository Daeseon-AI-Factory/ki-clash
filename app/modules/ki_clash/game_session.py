"""PvP game session — manages real-time turn flow over WebSocket.

Handles the simultaneous-action protocol:
1. Both players get "waiting_for_action"
2. Each submits an action → server stores it
3. When both submitted → engine resolves → broadcast result
4. Repeat until match ends

Also handles:
- Turn timeout (5s → auto-Charge)
- Disconnect (30s reconnect window → forfeit)
"""

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.game_engine.engine import GameEngine
from app.core.game_engine.types import (
    Action,
    DEFAULT_TIMEOUT_ACTION,
    GameState,
    MatchResult,
    MatchStatus,
    RoundResult,
    RoundWinner,
    TURN_TIME_LIMIT_SECONDS,
    TurnResult,
)
from app.core.ws_manager.manager import WSManager
from app.models.match import Match
from app.models.round import Round as RoundModel
from app.models.turn import Turn as TurnModel
from app.schemas import ws as ws_msg

logger = logging.getLogger(__name__)

# How long a disconnected player has to reconnect before forfeit
DISCONNECT_TIMEOUT_S = 30

_engine = GameEngine()


class PvPGameSession:
    """Manages a single PvP game session between two players.

    Each game gets one PvPGameSession instance. It holds:
    - The in-memory game state
    - Pending actions for the current turn
    - References to both players
    - Turn timeout logic

    Pattern: Mediator — this class mediates between two players
    and the game engine, coordinating who sends what and when.
    """

    def __init__(
        self,
        game_state: GameState,
        player1_id: UUID,
        player2_id: UUID,
        ws_manager: WSManager,
    ) -> None:
        self.state = game_state
        self.game_id = game_state.game_id
        self.p1_id = player1_id
        self.p2_id = player2_id
        self._ws = ws_manager

        # Pending actions for current turn (None = not yet submitted)
        self._p1_action: Action | None = None
        self._p2_action: Action | None = None

        # Turn timeout task
        self._timeout_task: asyncio.Task | None = None

        # Disconnect tracking
        self._disconnect_tasks: dict[UUID, asyncio.Task] = {}

    @property
    def room_id(self) -> str:
        return str(self.game_id)

    def is_player(self, player_id: UUID) -> bool:
        """Check if a player belongs to this game."""
        return player_id in (self.p1_id, self.p2_id)

    def get_opponent_id(self, player_id: UUID) -> UUID:
        """Get the opponent's player ID."""
        return self.p2_id if player_id == self.p1_id else self.p1_id

    async def start(self) -> None:
        """Begin the game — send initial waiting_for_action to both players."""
        await self._send_waiting_for_action()

    async def submit_action(self, player_id: UUID, action: Action) -> None:
        """Handle a player submitting their action for the current turn.

        If only one player has submitted, we wait for the other.
        If both have submitted, we resolve the turn immediately.

        Args:
            player_id: Who submitted.
            action: Their chosen action.
        """
        if self.state.status != MatchStatus.IN_PROGRESS:
            await self._ws.send_to_player(
                player_id, ws_msg.error_msg("Game is not in progress")
            )
            return

        current_round = self.state.current_round
        if current_round is None:
            return

        # Validate action affordability
        if player_id == self.p1_id:
            ki = current_round.p1_ki
        else:
            ki = current_round.p2_ki

        if not _engine.validate_action(action, ki):
            await self._ws.send_to_player(
                player_id,
                ws_msg.error_msg(f"Cannot afford {action.value} (ki={ki})"),
            )
            return

        # Store the action
        if player_id == self.p1_id:
            self._p1_action = action
        elif player_id == self.p2_id:
            self._p2_action = action

        # Confirm to the player that their action was received
        await self._ws.send_to_player(
            player_id,
            {"type": "action_confirmed", "data": {"action": action.value}},
        )

        # If both players have submitted → resolve
        if self._p1_action is not None and self._p2_action is not None:
            await self._resolve_turn()

    async def handle_disconnect(self, player_id: UUID) -> None:
        """Handle a player disconnecting mid-game.

        Starts a 30-second timer. If the player doesn't reconnect,
        they forfeit. The opponent is notified immediately.

        Args:
            player_id: The disconnected player.
        """
        opponent_id = self.get_opponent_id(player_id)

        # Notify opponent
        await self._ws.send_to_player(
            opponent_id,
            ws_msg.opponent_disconnected(DISCONNECT_TIMEOUT_S),
        )

        # Start forfeit timer
        async def _forfeit_after_timeout() -> None:
            await asyncio.sleep(DISCONNECT_TIMEOUT_S)
            # If still disconnected after timeout → forfeit
            if not self._ws.is_connected(player_id):
                forfeiting = (
                    RoundWinner.P1 if player_id == self.p1_id else RoundWinner.P2
                )
                self.state, match_result = _engine.forfeit(self.state, forfeiting)

                # Notify opponent they won
                winner_label = "you" if opponent_id != player_id else "opponent"
                await self._ws.send_to_player(
                    opponent_id,
                    ws_msg.match_result(
                        winner="p1" if match_result.winner == RoundWinner.P1 else "p2",
                        rounds_won_p1=match_result.rounds_won_p1,
                        rounds_won_p2=match_result.rounds_won_p2,
                        total_turns=match_result.total_turns,
                    ),
                )
                logger.info(
                    "Player %s forfeited game %s due to disconnect timeout",
                    player_id, self.game_id,
                )

        self._disconnect_tasks[player_id] = asyncio.create_task(
            _forfeit_after_timeout()
        )

    async def handle_reconnect(self, player_id: UUID) -> None:
        """Handle a player reconnecting after a disconnect.

        Cancels the forfeit timer and notifies the opponent.
        """
        # Cancel forfeit timer
        task = self._disconnect_tasks.pop(player_id, None)
        if task:
            task.cancel()

        opponent_id = self.get_opponent_id(player_id)
        await self._ws.send_to_player(opponent_id, ws_msg.opponent_reconnected())

        # Re-send current state to reconnected player
        if self.state.status == MatchStatus.IN_PROGRESS:
            await self._send_waiting_for_action()

        logger.info("Player %s reconnected to game %s", player_id, self.game_id)

    async def _resolve_turn(self) -> None:
        """Resolve the turn once both actions are in."""
        # Cancel turn timeout
        if self._timeout_task:
            self._timeout_task.cancel()
            self._timeout_task = None

        assert self._p1_action is not None and self._p2_action is not None

        # Engine resolves the turn
        self.state, turn_result, round_result, match_result = _engine.submit_turn(
            self.state, self._p1_action, self._p2_action
        )

        # Clear pending actions for next turn
        self._p1_action = None
        self._p2_action = None

        # Send personalized turn results
        # Each player sees "your_action" and "opponent_action" (not p1/p2)
        await self._ws.send_to_player(
            self.p1_id,
            ws_msg.turn_result(
                turn_number=turn_result.turn_number,
                your_action=turn_result.p1_action.value,
                opponent_action=turn_result.p2_action.value,
                outcome=self._flip_outcome_for(turn_result.outcome.value, "p1"),
                your_ki=turn_result.p1_ki_after,
                opponent_ki=turn_result.p2_ki_after,
            ),
        )
        await self._ws.send_to_player(
            self.p2_id,
            ws_msg.turn_result(
                turn_number=turn_result.turn_number,
                your_action=turn_result.p2_action.value,
                opponent_action=turn_result.p1_action.value,
                outcome=self._flip_outcome_for(turn_result.outcome.value, "p2"),
                your_ki=turn_result.p2_ki_after,
                opponent_ki=turn_result.p1_ki_after,
            ),
        )

        # Send round result if round ended
        if round_result is not None:
            await self._send_round_result(round_result)

        # Send match result if match ended
        if match_result is not None:
            await self._send_match_result(match_result)
        elif round_result is None:
            # Continue to next turn
            await asyncio.sleep(1.5)  # Brief pause for reveal animation
            await self._send_waiting_for_action()
        else:
            # Round ended but match continues → next round
            await asyncio.sleep(2.0)  # Longer pause between rounds
            await self._send_waiting_for_action()

    async def _send_waiting_for_action(self) -> None:
        """Notify both players to submit their next action."""
        current_round = self.state.current_round
        if current_round is None:
            return

        msg_p1 = ws_msg.waiting_for_action(
            turn=current_round.turn_number + 1,
            time_limit=TURN_TIME_LIMIT_SECONDS,
            round_number=current_round.round_number,
            p1_ki=current_round.p1_ki,
            p2_ki=current_round.p2_ki,
        )
        msg_p2 = ws_msg.waiting_for_action(
            turn=current_round.turn_number + 1,
            time_limit=TURN_TIME_LIMIT_SECONDS,
            round_number=current_round.round_number,
            # Swap ki for P2's perspective
            p1_ki=current_round.p2_ki,
            p2_ki=current_round.p1_ki,
        )

        await self._ws.send_to_player(self.p1_id, msg_p1)
        await self._ws.send_to_player(self.p2_id, msg_p2)

        # Start turn timeout
        self._timeout_task = asyncio.create_task(self._turn_timeout())

    async def _turn_timeout(self) -> None:
        """Auto-submit Charge for players who didn't act in time."""
        await asyncio.sleep(TURN_TIME_LIMIT_SECONDS)

        if self._p1_action is None:
            self._p1_action = DEFAULT_TIMEOUT_ACTION
            logger.info("P1 timed out in game %s, auto-Charge", self.game_id)
        if self._p2_action is None:
            self._p2_action = DEFAULT_TIMEOUT_ACTION
            logger.info("P2 timed out in game %s, auto-Charge", self.game_id)

        if self._p1_action is not None and self._p2_action is not None:
            await self._resolve_turn()

    async def _send_round_result(self, result: RoundResult) -> None:
        """Send round result to both players with personalized winner label."""
        for player_id in (self.p1_id, self.p2_id):
            winner_label = self._winner_for_player(result.winner, player_id)
            await self._ws.send_to_player(
                player_id,
                ws_msg.round_result(
                    round_number=result.round_number,
                    winner=winner_label,
                    total_turns=result.total_turns,
                ),
            )

    async def _send_match_result(self, result: MatchResult) -> None:
        """Send match result to both players with personalized winner label."""
        for player_id in (self.p1_id, self.p2_id):
            winner_label = self._winner_for_player(result.winner, player_id)
            await self._ws.send_to_player(
                player_id,
                ws_msg.match_result(
                    winner=winner_label,
                    rounds_won_p1=result.rounds_won_p1,
                    rounds_won_p2=result.rounds_won_p2,
                    total_turns=result.total_turns,
                ),
            )

    def _winner_for_player(self, winner: RoundWinner, player_id: UUID) -> str:
        """Convert engine's p1/p2 winner to 'you'/'opponent'/'draw' for a player."""
        if winner == RoundWinner.DRAW:
            return "draw"
        if (winner == RoundWinner.P1 and player_id == self.p1_id) or \
           (winner == RoundWinner.P2 and player_id == self.p2_id):
            return "you"
        return "opponent"

    def _flip_outcome_for(self, outcome: str, perspective: str) -> str:
        """Flip outcome labels for the correct player's perspective.

        The engine reports 'p1_wins_round' / 'p2_wins_round'.
        We convert to 'you_win' / 'you_lose' for each player.
        """
        if perspective == "p1":
            return outcome.replace("p1_wins_round", "you_win").replace("p2_wins_round", "you_lose")
        else:
            return outcome.replace("p2_wins_round", "you_win").replace("p1_wins_round", "you_lose")

    async def cleanup(self) -> None:
        """Cancel all background tasks for this session."""
        if self._timeout_task:
            self._timeout_task.cancel()
        for task in self._disconnect_tasks.values():
            task.cancel()
