# CORE_CANDIDATE
"""Expert AI — expected-value maximizer with opponent modeling.

Models the opponent's next action as a probability distribution using
recency-decayed frequency analysis, filtered by what they can afford.
Evaluates the expected value (EV) of every affordable AI action against
that distribution and picks the highest-EV play.

A 10% noise floor keeps the AI unpredictable even under full information.
Also applies ki pressure and match-score adjustments to the EV scores.
"""

import math
import random

from app.core.game_engine.types import (
    ACTION_KI_COST,
    Action,
    GameState,
    TurnResult,
)

# EV[ai_action][opp_action] = value from the AI's perspective.
# +20 = AI wins the round on this turn
# -20 = opponent wins the round on this turn
# Smaller values = ki waste or advantage
_EV: dict[Action, dict[Action, float]] = {
    Action.CHARGE: {
        Action.CHARGE: 0.5,        # neutral; AI gains 1 ki
        Action.BLOCK: 0.5,         # neutral; AI gains 1 ki
        Action.ATTACK: -20.0,      # opponent wins round (attack beats charge)
        Action.ENERGY_WAVE: -20.0, # opponent wins round (burst beats charge)
        Action.TELEPORT: 1.0,      # AI gains 1 ki; opp wasted 1 ki on teleport
    },
    Action.BLOCK: {
        Action.CHARGE: 0.0,
        Action.BLOCK: 0.0,
        Action.ATTACK: 3.0,        # their attack blocked; they waste 1 ki
        Action.ENERGY_WAVE: -20.0, # burst pierces block; opp wins round
        Action.TELEPORT: 0.0,
    },
    Action.ATTACK: {
        Action.CHARGE: 20.0,       # AI wins round!
        Action.BLOCK: -2.0,        # blocked; AI wastes 1 ki
        Action.ATTACK: -2.0,       # clash; both lose 1 ki
        Action.ENERGY_WAVE: -21.0, # burst beats attack; opp wins round AND AI loses 1 ki
        Action.TELEPORT: -2.0,     # dodged; AI wastes 1 ki
    },
    Action.ENERGY_WAVE: {
        Action.CHARGE: 20.0,       # burst wins round!
        Action.BLOCK: 20.0,        # burst pierces block; wins round!
        Action.ATTACK: 20.0,       # burst beats attack; wins round!
        Action.ENERGY_WAVE: -6.0,  # clash; both lose 3 ki
        Action.TELEPORT: -6.0,     # dodged; AI wastes 3 ki
    },
    Action.TELEPORT: {
        Action.CHARGE: -1.0,       # neutral; AI wastes 1 ki
        Action.BLOCK: -1.0,        # neutral; AI wastes 1 ki
        Action.ATTACK: 3.0,        # dodge; opp wastes 1 ki
        Action.ENERGY_WAVE: 9.0,   # dodge burst; opp wastes 3 ki = big ki swing
        Action.TELEPORT: -1.0,     # both waste 1 ki
    },
}

_HISTORY_BLEND = 0.70       # weight of observed history vs uniform prior
_RECENCY_DECAY = 0.80       # older turns count less
_HISTORY_WINDOW = 10        # turns to look back
_SOFTMAX_TEMP = 0.15        # controls exploration; lower = more random, higher = greedier


class ExpertAI:
    """EV-maximizing AI with opponent modeling and match-pressure adjustments."""

    def choose_action(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        current_round = game_state.current_round
        ai_ki = current_round.p2_ki if current_round else 0
        opp_ki = current_round.p1_ki if current_round else 0

        opp_probs = self._model_opponent(history, opp_ki)
        affordable = [a for a in Action if ai_ki >= ACTION_KI_COST[a]]

        evs: dict[Action, float] = {}
        for ai_action in affordable:
            ev = sum(
                prob * _EV[ai_action].get(opp_action, 0.0)
                for opp_action, prob in opp_probs.items()
            )
            ev += self._pressure_bonus(ai_action, ai_ki, opp_ki, game_state)
            evs[ai_action] = ev

        # Softmax sampling: higher-EV actions chosen more often but not exclusively.
        # This keeps the AI unpredictable even when one action dominates.
        return self._softmax_sample(evs)

    def _softmax_sample(self, evs: dict[Action, float]) -> Action:
        """Sample from a softmax distribution over EV scores."""
        max_ev = max(evs.values())
        exp_evs = {a: math.exp(_SOFTMAX_TEMP * (ev - max_ev)) for a, ev in evs.items()}
        total = sum(exp_evs.values())
        actions = list(exp_evs.keys())
        weights = [exp_evs[a] / total for a in actions]
        return random.choices(actions, weights=weights, k=1)[0]

    def _model_opponent(
        self,
        history: list[TurnResult],
        opp_ki: int,
    ) -> dict[Action, float]:
        """Return probability distribution over opponent's next action."""
        affordable = [a for a in Action if opp_ki >= ACTION_KI_COST[a]]
        prior = 1.0 / len(affordable)
        probs: dict[Action, float] = {a: prior for a in affordable}

        if not history:
            return probs

        # Recency-weighted frequency, limited to what opp can afford
        freq: dict[Action, float] = {}
        total_w = 0.0
        for i, turn in enumerate(reversed(history[-_HISTORY_WINDOW:])):
            w = _RECENCY_DECAY ** i
            action = turn.p1_action
            if action in affordable:
                freq[action] = freq.get(action, 0.0) + w
            total_w += w

        if total_w == 0:
            return probs

        for action in affordable:
            hist_prob = freq.get(action, 0.0) / total_w
            probs[action] = _HISTORY_BLEND * hist_prob + (1 - _HISTORY_BLEND) * prior

        # Normalize
        total = sum(probs.values())
        return {a: p / total for a, p in probs.items()}

    def _pressure_bonus(
        self,
        action: Action,
        ai_ki: int,
        opp_ki: int,
        game_state: GameState,
    ) -> float:
        """Small adjustments for ki state and match-score pressure."""
        bonus = 0.0

        # If we're behind on rounds, boost aggressive moves
        ai_rounds = game_state.rounds_won_p2
        opp_rounds = game_state.rounds_won_p1
        if ai_rounds < opp_rounds:
            if action in (Action.ATTACK, Action.ENERGY_WAVE):
                bonus += 1.5
        elif ai_rounds > opp_rounds:
            # Leading — reward defensive/safe plays slightly
            if action in (Action.BLOCK, Action.CHARGE):
                bonus += 0.5

        # If opponent is ki-poor, attacking is safer
        if opp_ki == 0 and action == Action.ATTACK:
            bonus += 2.0

        # If we're sitting on high ki, Energy Wave is underweighted in EV
        if ai_ki >= 5 and action == Action.ENERGY_WAVE:
            bonus += 1.0

        return bonus
