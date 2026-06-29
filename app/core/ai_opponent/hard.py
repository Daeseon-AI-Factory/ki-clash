# CORE_CANDIDATE
"""Hard AI — Nash equilibrium with ki pressure, round awareness, and deep adaptation.

Improvements over the original:
- Adaptation threshold lowered to 25% (was 35%) — reacts faster to patterns
- Adaptation strength raised to 0.6 (was 0.4)
- Recency decay over last 7 moves (vs flat last-3 window)
- Ki economy: shifts weights based on AI and opponent ki levels
- Round pressure: plays more aggressively when behind in rounds
"""

import random
from collections import Counter

from app.core.game_engine.types import (
    ACTION_KI_COST,
    Action,
    GameState,
    TurnResult,
)

_NASH_WEIGHTS: dict[Action, float] = {
    Action.CHARGE: 0.28,
    Action.BLOCK: 0.15,
    Action.ATTACK: 0.32,
    Action.ENERGY_WAVE: 0.10,
    Action.TELEPORT: 0.15,
}

_EXPLOIT: dict[Action, dict[Action, float]] = {
    Action.CHARGE: {Action.ATTACK: 0.25, Action.ENERGY_WAVE: 0.15},
    Action.BLOCK: {Action.ENERGY_WAVE: 0.20, Action.CHARGE: 0.15},
    Action.ATTACK: {Action.BLOCK: 0.20, Action.TELEPORT: 0.15},
    Action.ENERGY_WAVE: {Action.TELEPORT: 0.30},
    Action.TELEPORT: {Action.CHARGE: 0.15, Action.ATTACK: 0.15},
}

_ADAPTATION_THRESHOLD = 0.25
_ADAPTATION_STRENGTH = 0.6
_RECENCY_DECAY = 0.82


class HardAI:
    """Game-theory AI with ki pressure and round-pressure adaptation."""

    def choose_action(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        current_round = game_state.current_round
        ai_ki = current_round.p2_ki if current_round else 0
        opp_ki = current_round.p1_ki if current_round else 0

        weights = dict(_NASH_WEIGHTS)

        # Adjust for ki economy
        weights = self._adjust_for_ki(weights, ai_ki, opp_ki)

        # Adjust for round score pressure
        weights = self._adjust_for_round_pressure(weights, game_state)

        # Adapt to opponent patterns with recency decay
        if len(history) >= 3:
            weights = self._adapt_weights(weights, history)

        affordable = [a for a in Action if ai_ki >= ACTION_KI_COST[a]]
        final_weights = [max(weights.get(a, 0.0), 0.0) for a in affordable]
        total = sum(final_weights)
        if total == 0:
            return Action.CHARGE

        normalized = [w / total for w in final_weights]
        return random.choices(affordable, weights=normalized, k=1)[0]

    def _adjust_for_ki(
        self,
        weights: dict[Action, float],
        ai_ki: int,
        opp_ki: int,
    ) -> dict[Action, float]:
        w = dict(weights)

        if ai_ki == 0:
            # Must charge or block — set other weights to 0
            return {Action.CHARGE: 0.65, Action.BLOCK: 0.35}

        if ai_ki >= 5:
            # High ki — Energy Wave becomes very attractive
            w[Action.ENERGY_WAVE] = w.get(Action.ENERGY_WAVE, 0) + 0.20

        if opp_ki == 0:
            # Opponent must charge or block — Attack is very safe
            w[Action.ATTACK] = w.get(Action.ATTACK, 0) + 0.20

        if opp_ki >= 3:
            # Opponent can burst — consider dodging
            w[Action.TELEPORT] = w.get(Action.TELEPORT, 0) + 0.12

        return w

    def _adjust_for_round_pressure(
        self,
        weights: dict[Action, float],
        game_state: GameState,
    ) -> dict[Action, float]:
        w = dict(weights)
        ai_rounds = game_state.rounds_won_p2
        opp_rounds = game_state.rounds_won_p1

        if ai_rounds < opp_rounds:
            # Losing — play more aggressively
            w[Action.ATTACK] = w.get(Action.ATTACK, 0) + 0.10
            w[Action.ENERGY_WAVE] = w.get(Action.ENERGY_WAVE, 0) + 0.10
        elif ai_rounds > opp_rounds:
            # Leading — play slightly more defensively
            w[Action.BLOCK] = w.get(Action.BLOCK, 0) + 0.08
            w[Action.TELEPORT] = w.get(Action.TELEPORT, 0) + 0.08

        return w

    def _adapt_weights(
        self,
        base_weights: dict[Action, float],
        history: list[TurnResult],
    ) -> dict[Action, float]:
        """Recency-decay frequency analysis over last 7 moves."""
        w = dict(base_weights)

        recent = list(reversed(history[-7:]))
        weighted_freq: dict[Action, float] = {}
        total_weight = 0.0

        for i, turn in enumerate(recent):
            decay_w = _RECENCY_DECAY ** i
            action = turn.p1_action
            weighted_freq[action] = weighted_freq.get(action, 0.0) + decay_w
            total_weight += decay_w

        for action, wf in weighted_freq.items():
            freq = wf / total_weight
            if freq > _ADAPTATION_THRESHOLD and action in _EXPLOIT:
                for counter_action, shift in _EXPLOIT[action].items():
                    adjusted = shift * _ADAPTATION_STRENGTH * freq
                    w[counter_action] = w.get(counter_action, 0.0) + adjusted

        return w
