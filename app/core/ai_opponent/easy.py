# CORE_CANDIDATE
"""Easy AI — weighted random with bias toward Charge.

Suitable for new players learning the game mechanics.
"""

import random

from app.core.game_engine.types import (
    ACTION_KI_COST,
    Action,
    GameState,
    TurnResult,
)


# Weights for each action — Charge is heavily favored
_WEIGHTS: dict[Action, float] = {
    Action.CHARGE: 0.45,
    Action.BLOCK: 0.20,
    Action.ATTACK: 0.20,
    Action.ENERGY_WAVE: 0.05,
    Action.TELEPORT: 0.10,
}


class EasyAI:
    """Weighted random AI that favors Charge."""

    def choose_action(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        """Choose an action using weighted random selection.

        Filters out actions the AI can't afford, then picks
        from the remaining with predefined weights.

        Args:
            game_state: Current game state.
            history: Turn history for the current round.

        Returns:
            A randomly selected affordable action.
        """
        current_round = game_state.current_round
        ai_ki = current_round.p2_ki if current_round else 0

        affordable = [
            a for a in Action if ai_ki >= ACTION_KI_COST[a]
        ]

        weights = [_WEIGHTS[a] for a in affordable]
        total = sum(weights)
        normalized = [w / total for w in weights]

        return random.choices(affordable, weights=normalized, k=1)[0]
