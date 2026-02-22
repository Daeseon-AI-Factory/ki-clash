# CORE_CANDIDATE
"""Medium AI — pattern-based counter strategy.

Tracks the opponent's last 3 moves and picks the best counter.
Beatable by varying strategy, but punishes repetitive players.
"""

import random
from collections import Counter

from app.core.game_engine.types import (
    ACTION_KI_COST,
    Action,
    GameState,
    TurnResult,
)

# Counter mapping: if opponent does X, AI should do Y
_COUNTER: dict[Action, Action] = {
    Action.CHARGE: Action.ATTACK,       # punish charging
    Action.BLOCK: Action.ENERGY_WAVE,   # pierce the block (or charge)
    Action.ATTACK: Action.BLOCK,        # block the attack
    Action.ENERGY_WAVE: Action.TELEPORT,  # dodge the wave
    Action.TELEPORT: Action.CHARGE,     # free charge while they dodge nothing
}

# Fallback: if we can't afford the counter
_COUNTER_FALLBACK: dict[Action, list[Action]] = {
    Action.CHARGE: [Action.ATTACK, Action.CHARGE],
    Action.BLOCK: [Action.CHARGE, Action.ATTACK],
    Action.ATTACK: [Action.BLOCK, Action.TELEPORT],
    Action.ENERGY_WAVE: [Action.TELEPORT, Action.BLOCK],
    Action.TELEPORT: [Action.CHARGE, Action.BLOCK],
}


class MediumAI:
    """Pattern-matching AI that counters the opponent's recent moves."""

    def choose_action(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        """Choose an action by countering the opponent's most common recent move.

        Looks at the opponent's (P1's) last 3 moves, finds the most
        frequent, and plays the counter. Falls back to weighted random
        if no history yet.

        Args:
            game_state: Current game state.
            history: Turn history for the current round.

        Returns:
            The chosen counter action.
        """
        current_round = game_state.current_round
        ai_ki = current_round.p2_ki if current_round else 0

        # No history yet — play like easy AI but slightly smarter
        if len(history) < 1:
            return self._random_affordable(ai_ki)

        # Look at opponent's (P1) last 3 moves
        recent_p1_actions = [t.p1_action for t in history[-3:]]
        most_common = Counter(recent_p1_actions).most_common(1)[0][0]

        # Pick counter
        counter = _COUNTER[most_common]
        if ai_ki >= ACTION_KI_COST[counter]:
            return counter

        # Can't afford counter — try fallbacks
        for fallback in _COUNTER_FALLBACK[most_common]:
            if ai_ki >= ACTION_KI_COST[fallback]:
                return fallback

        # Last resort: Charge or Block (always free)
        return Action.CHARGE

    def _random_affordable(self, ai_ki: int) -> Action:
        """Pick a random affordable action with slight attack bias."""
        affordable = [a for a in Action if ai_ki >= ACTION_KI_COST[a]]
        weights = {
            Action.CHARGE: 0.30,
            Action.BLOCK: 0.20,
            Action.ATTACK: 0.30,
            Action.ENERGY_WAVE: 0.10,
            Action.TELEPORT: 0.10,
        }
        w = [weights[a] for a in affordable]
        return random.choices(affordable, weights=w, k=1)[0]
