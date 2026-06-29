# CORE_CANDIDATE
"""Novice AI — single-move reactive with high noise.

Reacts to the opponent's last action ~50% of the time.
Easy to beat by mixing any two moves.
"""

import random

from app.core.game_engine.types import (
    ACTION_KI_COST,
    Action,
    GameState,
    TurnResult,
)

# Simple counter: what to play against opponent's last action
_SIMPLE_COUNTER: dict[Action, Action] = {
    Action.CHARGE: Action.ATTACK,
    Action.BLOCK: Action.CHARGE,
    Action.ATTACK: Action.BLOCK,
    Action.ENERGY_WAVE: Action.TELEPORT,
    Action.TELEPORT: Action.CHARGE,
}

_RANDOM_WEIGHTS: dict[Action, float] = {
    Action.CHARGE: 0.35,
    Action.BLOCK: 0.25,
    Action.ATTACK: 0.25,
    Action.ENERGY_WAVE: 0.05,
    Action.TELEPORT: 0.10,
}


class NoviceAI:
    """Reacts to the opponent's last move half the time; otherwise random."""

    def choose_action(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        current_round = game_state.current_round
        ai_ki = current_round.p2_ki if current_round else 0

        if history and random.random() < 0.50:
            last_opp = history[-1].p1_action
            counter = _SIMPLE_COUNTER[last_opp]
            if ai_ki >= ACTION_KI_COST[counter]:
                return counter

        return self._random_affordable(ai_ki)

    def _random_affordable(self, ai_ki: int) -> Action:
        affordable = [a for a in Action if ai_ki >= ACTION_KI_COST[a]]
        weights = [_RANDOM_WEIGHTS[a] for a in affordable]
        total = sum(weights)
        normalized = [w / total for w in weights]
        return random.choices(affordable, weights=normalized, k=1)[0]
