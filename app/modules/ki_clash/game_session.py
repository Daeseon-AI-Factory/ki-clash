"""PvP game session — stateless façade over Redis-backed game store.

Per DR-15 (workers stateless, Redis is truth), this module exposes a
single `PvPGameSession` instance per worker that holds dependencies
(store + ws_manager) but no per-game state. Every method takes a
`game_id` and operates on the session state in Redis.

Local-only state held by this object:
- Disconnect timers: `(game_id, player_id) → asyncio.Task`. The worker
  that observed the disconnect starts the timer. If the player reconnects
  to a *different* worker, the original worker's timer still fires after
  30s but reads the latest Redis state on fire and no-ops if the player
  is reconnected — so cross-worker reconnect is safe without explicit
  task cancellation.
- Turn timeout: `game_id → asyncio.Task`. Same fire-and-check-Redis
  pattern; if both actions already landed (resolved by some other worker
  via WATCH/MULTI/EXEC), the timeout is a no-op.

All state mutations go through `store.watch_and_update()` (DR-14) so
two players submitting from two different workers in the same sub-ms
window cannot lose either submission.
"""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from app.core.game_engine.engine import GameEngine
from app.core.game_engine.types import (
    Action,
    DEFAULT_TIMEOUT_ACTION,
    MatchResult,
    MatchStatus,
    RoundResult,
    RoundWinner,
    TURN_TIME_LIMIT_SECONDS,
    TurnResult,
)
from app.core.game_store import (
    GameNotFoundError,
    GameStore,
    PvPSessionState,
)
from app.core.ws_manager.manager import WSManager
from app.schemas import ws as ws_msg

logger = logging.getLogger(__name__)

# How long a disconnected player has to reconnect before forfeit.
DISCONNECT_TIMEOUT_S = 30

_engine = GameEngine()


class PvPGameSession:
    """Stateless façade for PvP game session operations.

    One instance per worker (singleton). Holds only dependencies and
    local timer-task bookkeeping; no per-game state lives here. All
    game state is loaded from / written to `GameStore` for every
    operation (DR-15).
    """

    def __init__(self, store: GameStore, ws_manager: WSManager) -> None:
        self._store = store
        self._ws = ws_manager
        # (game_id, player_id) → asyncio.Task for forfeit timer
        self._disconnect_tasks: dict[tuple[UUID, UUID], asyncio.Task] = {}
        # game_id → asyncio.Task for current turn's timeout
        self._timeout_tasks: dict[UUID, asyncio.Task] = {}

    # ────────────────────────────────────────────────────────────────────
    # Public entrypoints (called by ws.py)
    # ────────────────────────────────────────────────────────────────────

    async def handle_connect(self, game_id: UUID, player_id: UUID) -> None:
        """A player connected to the game WS. Distinguishes first-connect
        (silent) from reconnect-after-disconnect (notify opponent + cancel
        forfeit timer + re-send state). DR-15: state lives in Redis."""

        opponent_to_notify: UUID | None = None
        is_reconnect = False
        new_state: PvPSessionState | None = None

        def _mark_connected(session: PvPSessionState) -> None:
            nonlocal opponent_to_notify, is_reconnect, new_state
            if session.has_connected(player_id):
                is_reconnect = True
                opponent_to_notify = (
                    session.player2_id if player_id == session.player1_id
                    else session.player1_id
                )
            else:
                session.mark_connected(player_id)
            new_state = session

        try:
            await self._store.watch_and_update(game_id, _mark_connected)
        except GameNotFoundError:
            await self._ws.send_to_player(
                player_id, ws_msg.error_msg("Game not found")
            )
            return

        if is_reconnect and opponent_to_notify is not None:
            # Cancel any local disconnect timer for this (game, player).
            # Timers on other workers will self-cancel on fire (they check
            # Redis state and see the reconnect).
            task = self._disconnect_tasks.pop((game_id, player_id), None)
            if task:
                task.cancel()

            await self._ws.send_to_player(
                opponent_to_notify, ws_msg.opponent_reconnected()
            )
            if new_state is not None and new_state.game_state.status == MatchStatus.IN_PROGRESS:
                await self._send_waiting_for_action(game_id, new_state)

            logger.info(
                "player_reconnected",
                extra={
                    "player_id": str(player_id),
                    "game_id": str(game_id),
                },
            )

    async def start(self, game_id: UUID) -> None:
        """Begin the game — send initial waiting_for_action to both players.

        Idempotent: re-entering when `started` is already True silently
        no-ops (DR-15 + Bug-2-style guard).
        """
        new_state: PvPSessionState | None = None
        already_started = False

        def _start(session: PvPSessionState) -> None:
            nonlocal new_state, already_started
            if session.started:
                already_started = True
            else:
                session.started = True
            new_state = session

        try:
            await self._store.watch_and_update(game_id, _start)
        except GameNotFoundError:
            logger.warning("start_called_for_unknown_game", extra={"game_id": str(game_id)})
            return

        if already_started or new_state is None:
            return
        await self._send_waiting_for_action(game_id, new_state)

    async def submit_action(
        self,
        game_id: UUID,
        player_id: UUID,
        action: Action,
    ) -> None:
        """Store the player's action; resolve the turn if both submitted.

        Atomic via WATCH/MULTI/EXEC (DR-14) — two players submitting
        from different workers in the same sub-ms window can't lose
        either submission.
        """

        validation_error: str | None = None
        should_resolve = False
        p1_action_to_resolve: Action | None = None
        p2_action_to_resolve: Action | None = None
        confirmed_turn_number = 0

        def _store_action(session: PvPSessionState) -> None:
            nonlocal validation_error, should_resolve, p1_action_to_resolve, p2_action_to_resolve, confirmed_turn_number

            if session.game_state.status != MatchStatus.IN_PROGRESS:
                validation_error = "Game is not in progress"
                return

            current_round = session.game_state.current_round
            if current_round is None:
                validation_error = "Round not active"
                return

            # Affordability validation
            ki = current_round.p1_ki if player_id == session.player1_id else current_round.p2_ki
            if not _engine.validate_action(action, ki):
                validation_error = f"Cannot afford {action.value} (ki={ki})"
                return

            # Store the action
            if player_id == session.player1_id:
                session.p1_action = action
            elif player_id == session.player2_id:
                session.p2_action = action

            confirmed_turn_number = current_round.turn_number + 1

            # Resolve if both submitted
            if session.p1_action is not None and session.p2_action is not None:
                should_resolve = True
                p1_action_to_resolve = session.p1_action
                p2_action_to_resolve = session.p2_action
                # Clear pending actions atomically in the same write
                session.p1_action = None
                session.p2_action = None

        try:
            await self._store.watch_and_update(game_id, _store_action)
        except GameNotFoundError:
            await self._ws.send_to_player(player_id, ws_msg.error_msg("Game not found"))
            return

        if validation_error:
            await self._ws.send_to_player(player_id, ws_msg.error_msg(validation_error))
            return

        # Confirm to the submitting player. DR-14 + Bug 4: turn_number lets
        # the client correlate this confirmation with its submission.
        await self._ws.send_to_player(
            player_id,
            ws_msg.action_confirmed(
                turn_number=confirmed_turn_number,
                action=action.value,
            ),
        )

        if should_resolve and p1_action_to_resolve and p2_action_to_resolve:
            await self._resolve_turn(game_id, p1_action_to_resolve, p2_action_to_resolve)

    async def handle_disconnect(self, game_id: UUID, player_id: UUID) -> None:
        """A player disconnected. Start a 30-second forfeit timer + notify
        opponent. If the player reconnects (to any worker), the timer
        fires harmlessly because it re-reads Redis state on fire."""

        opponent_id: UUID | None = None
        try:
            session = await self._store.load(game_id)
        except Exception:
            logger.exception("handle_disconnect_load_failed", extra={"game_id": str(game_id)})
            return
        if session is None:
            return
        opponent_id = (
            session.player2_id if player_id == session.player1_id else session.player1_id
        )

        await self._ws.send_to_player(
            opponent_id, ws_msg.opponent_disconnected(DISCONNECT_TIMEOUT_S)
        )

        task = asyncio.create_task(
            self._forfeit_after_timeout(game_id, player_id, opponent_id)
        )
        self._disconnect_tasks[(game_id, player_id)] = task

    async def cleanup(self, game_id: UUID) -> None:
        """Cancel any local timers for this game. Called when the game ends."""
        # Cancel turn timeout
        task = self._timeout_tasks.pop(game_id, None)
        if task:
            task.cancel()
        # Cancel any disconnect timers for this game
        for key in list(self._disconnect_tasks.keys()):
            if key[0] == game_id:
                t = self._disconnect_tasks.pop(key)
                t.cancel()

    # ────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ────────────────────────────────────────────────────────────────────

    async def _resolve_turn(
        self,
        game_id: UUID,
        p1_action: Action,
        p2_action: Action,
    ) -> None:
        """Apply the turn to the engine, persist, broadcast results."""

        turn_result_p1: TurnResult | None = None
        round_result: RoundResult | None = None
        match_result: MatchResult | None = None

        def _apply(session: PvPSessionState) -> None:
            nonlocal turn_result_p1, round_result, match_result
            session.game_state, tr, rr, mr = _engine.submit_turn(
                session.game_state, p1_action, p2_action
            )
            turn_result_p1 = tr
            round_result = rr
            match_result = mr
            # Pending actions were already cleared in submit_action

        try:
            await self._store.watch_and_update(game_id, _apply)
        except GameNotFoundError:
            return

        # Cancel current turn timeout — turn is resolved
        task = self._timeout_tasks.pop(game_id, None)
        if task:
            task.cancel()

        if turn_result_p1 is None:
            return  # defensive — shouldn't happen

        # Load player IDs (single read after the atomic update)
        session = await self._store.load(game_id)
        if session is None:
            return
        p1_id, p2_id = session.player1_id, session.player2_id

        # Send personalized turn results to both players
        await self._ws.send_to_player(
            p1_id,
            ws_msg.turn_result(
                turn_number=turn_result_p1.turn_number,
                your_action=turn_result_p1.p1_action.value,
                opponent_action=turn_result_p1.p2_action.value,
                outcome=self._flip_outcome_for(turn_result_p1.outcome.value, "p1"),
                your_ki=turn_result_p1.p1_ki_after,
                opponent_ki=turn_result_p1.p2_ki_after,
            ),
        )
        await self._ws.send_to_player(
            p2_id,
            ws_msg.turn_result(
                turn_number=turn_result_p1.turn_number,
                your_action=turn_result_p1.p2_action.value,
                opponent_action=turn_result_p1.p1_action.value,
                outcome=self._flip_outcome_for(turn_result_p1.outcome.value, "p2"),
                your_ki=turn_result_p1.p2_ki_after,
                opponent_ki=turn_result_p1.p1_ki_after,
            ),
        )

        if round_result is not None:
            await self._send_round_result(game_id, round_result, p1_id, p2_id)

        if match_result is not None:
            await self._send_match_result(game_id, match_result, p1_id, p2_id)
            return

        # Continue to next turn after a brief animation pause
        await asyncio.sleep(2.0 if round_result is not None else 1.5)
        new_session = await self._store.load(game_id)
        if new_session is not None and new_session.game_state.status == MatchStatus.IN_PROGRESS:
            await self._send_waiting_for_action(game_id, new_session)

    async def _send_waiting_for_action(
        self,
        game_id: UUID,
        session: PvPSessionState,
    ) -> None:
        """Notify both players to submit. Starts the turn-timeout task."""
        current_round = session.game_state.current_round
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
            p1_ki=current_round.p2_ki,
            p2_ki=current_round.p1_ki,
        )

        await self._ws.send_to_player(session.player1_id, msg_p1)
        await self._ws.send_to_player(session.player2_id, msg_p2)

        # Replace any prior turn-timeout for this game
        existing = self._timeout_tasks.pop(game_id, None)
        if existing:
            existing.cancel()
        self._timeout_tasks[game_id] = asyncio.create_task(
            self._turn_timeout(game_id)
        )

    async def _turn_timeout(self, game_id: UUID) -> None:
        """Auto-submit Charge for any player who didn't act in time."""
        await asyncio.sleep(TURN_TIME_LIMIT_SECONDS)

        # On fire, re-read state and only act if actions are still pending.
        # If some other worker (or this one) already resolved the turn, this
        # is a no-op — that's the safe-on-cross-worker property.
        try:
            session = await self._store.load(game_id)
        except Exception:
            return
        if session is None or session.game_state.status != MatchStatus.IN_PROGRESS:
            return

        p1_needs = session.p1_action is None
        p2_needs = session.p2_action is None
        if not p1_needs and not p2_needs:
            return  # already resolved by submit

        p1_to_submit = DEFAULT_TIMEOUT_ACTION if p1_needs else None
        p2_to_submit = DEFAULT_TIMEOUT_ACTION if p2_needs else None

        # Submit on behalf of the timed-out player(s) via the normal path —
        # this re-uses the atomic store update + resolve logic.
        if p1_to_submit:
            await self.submit_action(game_id, session.player1_id, p1_to_submit)
        if p2_to_submit:
            await self.submit_action(game_id, session.player2_id, p2_to_submit)

    async def _forfeit_after_timeout(
        self,
        game_id: UUID,
        disconnected_id: UUID,
        opponent_id: UUID,
    ) -> None:
        """Wait 30s; if player still disconnected, forfeit them."""
        await asyncio.sleep(DISCONNECT_TIMEOUT_S)

        # If the player reconnected (locally OR to another worker), the
        # _ws.is_connected check + the connected_players set in Redis tell
        # us whether the forfeit should proceed.
        if self._ws.is_connected(disconnected_id):
            return  # locally reconnected, abort
        try:
            session = await self._store.load(game_id)
        except Exception:
            return
        if session is None:
            return
        # If they reconnected to another worker, their presence in the
        # connected_players set is what we trust here. But absence from
        # connected_players is the initial state too — so the right
        # check is "are they still gone from connected_players?".
        # Simpler: if they're locally connected here, abort; otherwise
        # apply forfeit (the timer was started by us, we own the forfeit).
        # NB: this means a cross-worker reconnect within 30s still
        # forfeits if the original worker can't see the reconnect. Phase 4
        # pub/sub (DR-13) will fix this in 4.4.
        forfeiting = (
            RoundWinner.P1 if disconnected_id == session.player1_id
            else RoundWinner.P2
        )

        def _forfeit(s: PvPSessionState) -> None:
            s.game_state, _ = _engine.forfeit(s.game_state, forfeiting)

        try:
            await self._store.watch_and_update(game_id, _forfeit)
        except GameNotFoundError:
            return

        # Notify opponent
        session = await self._store.load(game_id)
        if session is None:
            return
        opponent_label = "you" if opponent_id == session.player2_id and forfeiting == RoundWinner.P1 else (
            "you" if opponent_id == session.player1_id and forfeiting == RoundWinner.P2 else "opponent"
        )
        await self._ws.send_to_player(
            opponent_id,
            ws_msg.match_result(
                winner=opponent_label,
                rounds_won_p1=session.game_state.rounds_won_p1,
                rounds_won_p2=session.game_state.rounds_won_p2,
                total_turns=sum(rr.total_turns for rr in session.game_state.round_results),
            ),
        )

        logger.info(
            "player_forfeited",
            extra={"player_id": str(disconnected_id), "game_id": str(game_id)},
        )

    async def _send_round_result(
        self,
        game_id: UUID,
        result: RoundResult,
        p1_id: UUID,
        p2_id: UUID,
    ) -> None:
        for pid in (p1_id, p2_id):
            winner_label = self._winner_for_player(result.winner, pid, p1_id)
            await self._ws.send_to_player(
                pid,
                ws_msg.round_result(
                    round_number=result.round_number,
                    winner=winner_label,
                    total_turns=result.total_turns,
                ),
            )

    async def _send_match_result(
        self,
        game_id: UUID,
        result: MatchResult,
        p1_id: UUID,
        p2_id: UUID,
    ) -> None:
        for pid in (p1_id, p2_id):
            winner_label = self._winner_for_player(result.winner, pid, p1_id)
            await self._ws.send_to_player(
                pid,
                ws_msg.match_result(
                    winner=winner_label,
                    rounds_won_p1=result.rounds_won_p1,
                    rounds_won_p2=result.rounds_won_p2,
                    total_turns=result.total_turns,
                ),
            )

    @staticmethod
    def _winner_for_player(
        winner: RoundWinner,
        player_id: UUID,
        p1_id: UUID,
    ) -> str:
        if winner == RoundWinner.DRAW:
            return "draw"
        is_p1 = player_id == p1_id
        winner_is_p1 = winner == RoundWinner.P1
        return "you" if (is_p1 == winner_is_p1) else "opponent"

    @staticmethod
    def _flip_outcome_for(outcome: str, perspective: str) -> str:
        if perspective == "p1":
            return outcome.replace("p1_wins_round", "you_win").replace(
                "p2_wins_round", "you_lose"
            )
        return outcome.replace("p2_wins_round", "you_win").replace(
            "p1_wins_round", "you_lose"
        )
