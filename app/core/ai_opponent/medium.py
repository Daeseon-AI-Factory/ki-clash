# CORE_CANDIDATE
"""Medium AI — frequency-counter with ki economy awareness and noise.

Looks at the opponent's last 5 moves, counters the most frequent.
20% random noise makes it harder to game-plan against.
Also considers ki economy: bursts when holding lots of ki,
and anticipates opponent bursts when they have ki to spend.
"""

import random
from collections import Counter

from app.core.game_engine.types import (
    ACTION_KI_COST,
    Action,
    GameState,
    TurnResult,
)

_COUNTER: dict[Action, Action] = {
    Action.CHARGE: Action.ATTACK,
    Action.BLOCK: Action.ENERGY_WAVE,
    Action.ATTACK: Action.BLOCK,
    Action.ENERGY_WAVE: Action.TELEPORT,
    Action.TELEPORT: Action.CHARGE,
}

_COUNTER_FALLBACK: dict[Action, list[Action]] = {
    Action.CHARGE: [Action.ATTACK, Action.CHARGE],
    Action.BLOCK: [Action.CHARGE, Action.ATTACK],
    Action.ATTACK: [Action.BLOCK, Action.TELEPORT],
    Action.ENERGY_WAVE: [Action.TELEPORT, Action.BLOCK],
    Action.TELEPORT: [Action.CHARGE, Action.BLOCK],
}

_RANDOM_WEIGHTS: dict[Action, float] = {
    Action.CHARGE: 0.30,
    Action.BLOCK: 0.20,
    Action.ATTACK: 0.30,
    Action.ENERGY_WAVE: 0.10,
    Action.TELEPORT: 0.10,
}


class MediumAI:
    """Frequency-counter AI with ki economy awareness."""

    def choose_action(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        current_round = game_state.current_round
        ai_ki = current_round.p2_ki if current_round else 0
        opp_ki = current_round.p1_ki if current_round else 0

        # 20% random noise — prevents perfect pattern-exploitation
        if random.random() < 0.20:
            return self._random_affordable(ai_ki)

        # Ki economy: if we have lots of ki, push an Energy Wave
        if ai_ki >= 6 and random.random() < 0.45:
            return Action.ENERGY_WAVE

        # Threat anticipation: dodge if opponent can afford a burst
        if opp_ki >= 3 and random.random() < 0.25:
            if ai_ki >= ACTION_KI_COST[Action.TELEPORT]:
                return Action.TELEPORT

        if not history:
            return self._random_affordable(ai_ki)

        # Frequency analysis over last 5 moves
        recent_p1 = [t.p1_action for t in history[-5:]]
        most_common = Counter(recent_p1).most_common(1)[0][0]

        counter = _COUNTER[most_common]
        if ai_ki >= ACTION_KI_COST[counter]:
            return counter

        for fallback in _COUNTER_FALLBACK[most_common]:
            if ai_ki >= ACTION_KI_COST[fallback]:
                return fallback

        return Action.CHARGE

    def _random_affordable(self, ai_ki: int) -> Action:
        affordable = [a for a in Action if ai_ki >= ACTION_KI_COST[a]]
        weights = [_RANDOM_WEIGHTS[a] for a in affordable]
        total = sum(weights)
        normalized = [w / total for w in weights]
        return random.choices(affordable, weights=normalized, k=1)[0]
