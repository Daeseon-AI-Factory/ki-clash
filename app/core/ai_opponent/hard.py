# CORE_CANDIDATE
"""Hard AI — approximate Nash equilibrium mixed strategy with adaptation.

Uses game-theory optimal action probabilities as a baseline, then
adapts based on the opponent's tendencies. Not perfectly exploitable
by any single strategy.
"""

import random
from collections import Counter

from app.core.game_engine.types import (
    ACTION_KI_COST,
    Action,
    GameState,
    TurnResult,
)

# Approximate Nash equilibrium weights for the Ki Clash action space.
# These are hand-tuned to be close to GTO (game-theory optimal) mixed strategy.
# At 0 ki the only options are Charge/Block, so base weights apply to full ki.
_NASH_WEIGHTS: dict[Action, float] = {
    Action.CHARGE: 0.30,
    Action.BLOCK: 0.15,
    Action.ATTACK: 0.30,
    Action.ENERGY_WAVE: 0.10,
    Action.TELEPORT: 0.15,
}

# How much to shift weights based on opponent tendencies (0 = pure Nash, 1 = full adapt)
_ADAPTATION_STRENGTH = 0.4

# Exploitation matrix: if opponent favors X, increase weight for Y
_EXPLOIT: dict[Action, dict[Action, float]] = {
    Action.CHARGE: {
        Action.ATTACK: 0.25,
        Action.ENERGY_WAVE: 0.15,
    },
    Action.BLOCK: {
        Action.ENERGY_WAVE: 0.20,
        Action.CHARGE: 0.15,
    },
    Action.ATTACK: {
        Action.BLOCK: 0.20,
        Action.TELEPORT: 0.15,
    },
    Action.ENERGY_WAVE: {
        Action.TELEPORT: 0.30,
    },
    Action.TELEPORT: {
        Action.CHARGE: 0.15,
        Action.ATTACK: 0.15,
    },
}


class HardAI:
    """Game-theory inspired AI with opponent adaptation."""

    def choose_action(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        """Choose an action using Nash equilibrium baseline + adaptation.

        The base strategy is a mixed (randomized) strategy close to Nash
        equilibrium. As the match progresses, the AI detects opponent
        tendencies and shifts probabilities to exploit them.

        Args:
            game_state: Current game state.
            history: Turn history for the current round.

        Returns:
            The chosen action.
        """
        current_round = game_state.current_round
        ai_ki = current_round.p2_ki if current_round else 0

        # Start with Nash weights
        weights = dict(_NASH_WEIGHTS)

        # Adapt if we have enough history
        if len(history) >= 3:
            weights = self._adapt_weights(weights, history)

        # Filter to affordable actions and normalize
        affordable = [a for a in Action if ai_ki >= ACTION_KI_COST[a]]
        final_weights = [weights.get(a, 0.0) for a in affordable]
        total = sum(final_weights)
        if total == 0:
            return Action.CHARGE
        normalized = [w / total for w in final_weights]

        return random.choices(affordable, weights=normalized, k=1)[0]

    def _adapt_weights(
        self,
        base_weights: dict[Action, float],
        history: list[TurnResult],
    ) -> dict[Action, float]:
        """Shift weights to exploit opponent tendencies.

        Analyzes the opponent's (P1) action distribution and increases
        weights for actions that counter their most common plays.

        Args:
            base_weights: Starting Nash equilibrium weights.
            history: Full round history.

        Returns:
            Adapted weight dictionary.
        """
        weights = dict(base_weights)

        # Count opponent's action frequencies
        p1_actions = [t.p1_action for t in history]
        total_actions = len(p1_actions)
        action_freq: dict[Action, float] = {
            action: count / total_actions
            for action, count in Counter(p1_actions).items()
        }

        # Detect if opponent has a strong tendency (>35% on one action)
        for action, freq in action_freq.items():
            if freq > 0.35 and action in _EXPLOIT:
                exploit_shifts = _EXPLOIT[action]
                for counter_action, shift in exploit_shifts.items():
                    adjusted_shift = shift * _ADAPTATION_STRENGTH * freq
                    weights[counter_action] = weights.get(counter_action, 0) + adjusted_shift

        return weights
