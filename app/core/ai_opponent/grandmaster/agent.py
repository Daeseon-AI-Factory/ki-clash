# CORE_CANDIDATE
"""GrandmasterAI — the runtime AIOpponent implementation.

Wires the decision pipeline to the :class:`AIOpponent` protocol. It is the
strongest tier: a match-aware GTO core (offline-solved per-round Nash via
backward induction) blended with a bounded best-response exploitation layer.

Safety: if the committed strategy table is missing (a misconfigured deploy),
the agent logs once and degrades gracefully to :class:`ExpertAI` rather than
raising on the hot path or blocking the event loop with an inline solve.
"""

from __future__ import annotations

import logging
import random

from app.core.ai_opponent.grandmaster import policy
from app.core.ai_opponent.grandmaster.table import TableMissingError
from app.core.game_engine.types import Action, GameState, TurnResult

logger = logging.getLogger(__name__)


class GrandmasterAI:
    """Match-aware GTO + bounded-exploitation AI opponent (player P2)."""

    def __init__(self, *, seed: int | None = None) -> None:
        """Initialize the agent.

        Args:
            seed: Optional RNG seed for deterministic sampling (tests/replays).
        """
        self._rng = random.Random(seed)
        self._warned = False

    def choose_action(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        """Choose an action for the upcoming turn.

        Args:
            game_state: Current full game state (AI is P2).
            history: Turn history for the current round.

        Returns:
            An action affordable at the AI's current ki.
        """
        try:
            return policy.decide(game_state, history, rng=self._rng)
        except TableMissingError:
            return self._fallback(game_state, history)

    def _fallback(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        """Degrade to ExpertAI when the strategy table is unavailable.

        Args:
            game_state: Current full game state.
            history: Turn history for the current round.

        Returns:
            ExpertAI's chosen action.
        """
        if not self._warned:
            logger.warning(
                "Grandmaster strategy table missing; degrading to ExpertAI. "
                "Generate and commit scripts/generate_strategy_table.py output."
            )
            self._warned = True
        # Lazy import keeps ExpertAI off the happy-path import graph.
        from app.core.ai_opponent.expert import ExpertAI

        return ExpertAI().choose_action(game_state, history)
