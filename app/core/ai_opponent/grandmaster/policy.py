# CORE_CANDIDATE
"""Runtime decision pipeline — GTO + bounded exploitation, then sample.

Turns a resolved state into a final affordable-action probability vector and
samples an :class:`Action`. No solving happens here: it composes the offline
GTO table (``table.get_sigma``) with the online best response
(``exploit.best_response``) under an adaptive exploitation weight
(``exploit.adaptive_eps``), adds a small noise floor, and samples. Sub-
millisecond per call.
"""

from __future__ import annotations

import random

from app.core.ai_opponent.grandmaster import exploit, table
from app.core.ai_opponent.grandmaster.transition import (
    ACTION_ORDER,
    affordable_actions,
    is_immediate_win,
    resolve_match_state,
)
from app.core.game_engine.types import TURN_LIMIT, Action, GameState, TurnResult


def _guaranteed_finisher(my_ki: int, opp_ki: int) -> Action | None:
    """Return an action that wins the round THIS turn against every legal reply.

    If some affordable action beats *all* of the opponent's affordable actions
    (e.g. ENERGY_WAVE when the opponent is at 0 ki and can only charge/block),
    it is a guaranteed round win — value exactly 1.0. The GTO table is
    indifferent among all value-1.0 moves and may dither (e.g. keep charging a
    won position); taking the finisher realizes the win immediately without ever
    sacrificing value. Prefers the cheapest such move (ties by action order).

    Args:
        my_ki: The AI's ki.
        opp_ki: The opponent's ki.

    Returns:
        The finisher action, or ``None`` if no guaranteed-win move exists.
    """
    opp_actions = affordable_actions(opp_ki)
    for a in affordable_actions(my_ki):
        if all(is_immediate_win(a, o) for o in opp_actions):
            return a
    return None


def final_distribution(
    match_state_key: str,
    my_ki: int,
    opp_ki: int,
    turn: int,
    history: list[TurnResult],
    game_state: GameState,
) -> list[float]:
    """Build the final action distribution for a fully-resolved state.

    Pipeline: GTO sigma -> blend with the bounded best response (adaptive eps)
    -> add a uniform noise floor -> renormalize over affordable actions.

    Args:
        match_state_key: Current match-state key.
        my_ki: The AI's ki.
        opp_ki: The opponent's ki.
        turn: Upcoming turn number in ``[1, TURN_LIMIT]``.
        history: Turn history for the current round.
        game_state: Full game state (for match-score adjustments).

    Returns:
        A length-5 distribution over ``ACTION_ORDER`` (zero on unaffordable
        actions, sums to 1).

    Raises:
        TableMissingError: If the committed strategy table is unavailable.
    """
    gto = table.get_sigma(match_state_key, my_ki, opp_ki, turn)
    lam = table.get_lambda(match_state_key)

    opp_probs = exploit.model_opponent(history, opp_ki)
    bias = exploit.bias_strength(opp_probs, opp_ki)
    eps = exploit.adaptive_eps(history, game_state, bias)

    br = exploit.best_response(opp_probs, match_state_key, my_ki, opp_ki, turn, lam)
    blended = exploit.blend(gto, br, eps)

    affordable = affordable_actions(my_ki)
    # Every input vector is already zero on unaffordable actions and add_noise
    # only touches affordable slots, so the result stays affordable-only.
    return exploit.add_noise(blended, affordable)


def _sample(dist: list[float], affordable: list[Action], rng: random.Random) -> Action:
    """Sample an action from a length-5 distribution over ``ACTION_ORDER``.

    Args:
        dist: Length-5 weights (zero on unaffordable actions).
        affordable: The affordable actions (used as a safety fallback).
        rng: Seeded RNG for determinism in tests.

    Returns:
        The sampled action — always affordable.
    """
    if sum(dist) <= 0.0:
        # Degenerate guard: weights collapsed; play a uniform affordable action.
        return rng.choice(affordable)
    return rng.choices(list(ACTION_ORDER), weights=dist, k=1)[0]


def decide(
    game_state: GameState,
    history: list[TurnResult],
    *,
    rng: random.Random | None = None,
) -> Action:
    """Run the full decision pipeline for the AI (player P2).

    Extracts the AI's state (``p2_ki``), the opponent's state (``p1_ki``), and
    the upcoming turn (``turn_number + 1`` clamped to ``[1, TURN_LIMIT]``),
    resolves the match state, builds the final distribution and samples.

    Args:
        game_state: Full game state. ``current_round`` must be set.
        history: Turn history for the current round.
        rng: Optional seeded RNG; a fresh one is used if omitted.

    Returns:
        The chosen action — always affordable at the AI's current ki.

    Raises:
        TableMissingError: If the committed strategy table is unavailable.
        ValueError: If ``game_state.current_round`` is None.
    """
    current_round = game_state.current_round
    if current_round is None:
        raise ValueError("decide() requires an active current_round")

    my_ki = current_round.p2_ki
    opp_ki = current_round.p1_ki
    turn = min(current_round.turn_number + 1, TURN_LIMIT)

    # Crisp finish: if a move wins outright against every legal reply, take it.
    # Always value-1.0 optimal — just realizes the win instead of dithering.
    finisher = _guaranteed_finisher(my_ki, opp_ki)
    if finisher is not None:
        return finisher

    match_state_key = resolve_match_state(game_state)
    dist = final_distribution(
        match_state_key, my_ki, opp_ki, turn, history, game_state
    )

    rng = rng or random.Random()
    return _sample(dist, affordable_actions(my_ki), rng)
