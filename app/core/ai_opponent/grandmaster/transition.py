# CORE_CANDIDATE
"""Transition + rules adapter — single source of truth for game mechanics.

This module is the ONE place where the Grandmaster AI talks to the live
Ki Clash engine. Both the offline solver and the online exploitation layer
import their mechanics from here so they can never drift from the engine.

Everything is expressed from the **acting player's** perspective ("me" vs
"opp"). The key verified facts this module encodes:

* Ki after a turn depends ONLY on the acting player's own action
  (mirrors :func:`app.core.game_engine.outcome_matrix.calculate_ki_after`):
  ``ki' = clamp(ki - COST[a] + GAIN[a], 0, KI_CAP)``.
* A turn is an immediate WIN for me iff ``resolve_actions(me, opp)`` is
  ``P1_WINS_ROUND`` (me=ATTACK & opp=CHARGE, or me=ENERGY_WAVE &
  opp in {CHARGE, BLOCK, ATTACK}); an immediate LOSS iff it is
  ``P2_WINS_ROUND``; otherwise the turn is non-terminal.
* At most one player can win on any given turn.

It also owns the normalized stage-payoff used by both the solver and the
best-response, plus the match-state key helpers for the best-of-3 induction.
"""

from __future__ import annotations

from typing import Callable

from app.core.game_engine.outcome_matrix import resolve_actions
from app.core.game_engine.types import (
    ACTION_KI_COST,
    ACTION_KI_GAIN,
    KI_CAP,
    ROUNDS_TO_WIN,
    TURN_LIMIT,
    Action,
    GameState,
    TurnOutcome,
)

# Canonical action ordering. Every length-5 strategy/sigma vector in the
# Grandmaster subsystem is indexed by this tuple, in this order.
ACTION_ORDER: tuple[Action, ...] = (
    Action.CHARGE,
    Action.BLOCK,
    Action.ATTACK,
    Action.ENERGY_WAVE,
    Action.TELEPORT,
)

_ACTION_INDEX: dict[Action, int] = {a: i for i, a in enumerate(ACTION_ORDER)}


def action_index(a: Action) -> int:
    """Return the canonical index of ``a`` within :data:`ACTION_ORDER`.

    Args:
        a: The action.

    Returns:
        Integer index in ``[0, 5)``.
    """
    return _ACTION_INDEX[a]


def ki_after(ki: int, action: Action) -> int:
    """Compute a player's ki after taking ``action``.

    Mirrors :func:`app.core.game_engine.outcome_matrix.calculate_ki_after`:
    only the acting player's own cost/gain matter; the opponent's move and
    the resolved outcome never change ki.

    Args:
        ki: Ki before the turn (assumed already in ``[0, KI_CAP]``).
        action: The action taken.

    Returns:
        Ki after the turn, clamped to ``[0, KI_CAP]``.
    """
    nxt = ki - ACTION_KI_COST[action] + ACTION_KI_GAIN[action]
    return max(0, min(nxt, KI_CAP))


def affordable_actions(ki: int) -> list[Action]:
    """List the actions affordable at ``ki``, in :data:`ACTION_ORDER`.

    Args:
        ki: Current ki.

    Returns:
        Actions ``a`` with ``ACTION_KI_COST[a] <= ki``.
    """
    return [a for a in ACTION_ORDER if ACTION_KI_COST[a] <= ki]


def affordable_mask(ki: int) -> list[bool]:
    """Boolean affordability mask aligned to :data:`ACTION_ORDER`.

    Args:
        ki: Current ki.

    Returns:
        Length-5 list; ``True`` where the action is affordable.
    """
    return [ACTION_KI_COST[a] <= ki for a in ACTION_ORDER]


def immediate_outcome(me: Action, opp: Action) -> int:
    """Classify a stage cell from the acting player's perspective.

    Args:
        me: My action.
        opp: Opponent's action.

    Returns:
        ``+1`` if I win the round this turn, ``-1`` if I lose it this turn,
        ``0`` if the turn is non-terminal.
    """
    outcome = resolve_actions(me, opp)
    if outcome == TurnOutcome.P1_WINS_ROUND:
        return 1
    if outcome == TurnOutcome.P2_WINS_ROUND:
        return -1
    return 0


def is_immediate_win(me: Action, opp: Action) -> bool:
    """Return whether ``(me, opp)`` is an immediate round win for me."""
    return immediate_outcome(me, opp) == 1


def is_immediate_loss(me: Action, opp: Action) -> bool:
    """Return whether ``(me, opp)`` is an immediate round loss for me."""
    return immediate_outcome(me, opp) == -1


def stage_payoff(
    me: Action,
    opp: Action,
    my_ki: int,
    opp_ki: int,
    turn: int,
    lam: float,
    value_fn: Callable[[int, int, int], float],
) -> float:
    """Normalized payoff of a single stage cell for the acting player.

    Leaves are normalized to win=1.0, loss=0.0, draw=``lam`` (so the game
    stays constant-sum: the opponent's effective draw weight is ``1 - lam``).

    Resolution order for cell ``(me, opp)`` at state ``(my_ki, opp_ki, turn)``:

    1. Immediate win -> ``1.0``; immediate loss -> ``0.0``.
    2. Otherwise advance ki for both players. If ``turn == TURN_LIMIT`` the
       round ends by ki comparison: ``1.0`` if my ki is higher, ``0.0`` if
       lower, ``lam`` if equal.
    3. Else recurse via ``value_fn(my_ki', opp_ki', turn + 1)`` — the already
       solved continuation value layer.

    Args:
        me: My action (assumed affordable at ``my_ki``).
        opp: Opponent's action (assumed affordable at ``opp_ki``).
        my_ki: My ki before the turn.
        opp_ki: Opponent's ki before the turn.
        turn: Upcoming turn number in ``[1, TURN_LIMIT]``.
        lam: My match-draw weight for this round in ``[0, 1]``.
        value_fn: Continuation value lookup ``(my_ki, opp_ki, turn) -> float``.

    Returns:
        Payoff in ``[0, 1]`` for the acting (row) player.
    """
    oc = immediate_outcome(me, opp)
    if oc == 1:
        return 1.0
    if oc == -1:
        return 0.0

    my_next = ki_after(my_ki, me)
    opp_next = ki_after(opp_ki, opp)

    if turn >= TURN_LIMIT:
        if my_next > opp_next:
            return 1.0
        if my_next < opp_next:
            return 0.0
        return lam

    return value_fn(my_next, opp_next, turn + 1)


def build_stage_matrix(
    my_ki: int,
    opp_ki: int,
    turn: int,
    lam: float,
    value_fn: Callable[[int, int, int], float],
) -> tuple[list[Action], list[Action], list[list[float]]]:
    """Build the affordable-action payoff matrix for a state.

    Args:
        my_ki: My ki.
        opp_ki: Opponent's ki.
        turn: Upcoming turn number in ``[1, TURN_LIMIT]``.
        lam: My match-draw weight for this round.
        value_fn: Continuation value lookup.

    Returns:
        ``(rows, cols, matrix)`` where ``rows`` are my affordable actions,
        ``cols`` are the opponent's affordable actions, and
        ``matrix[i][j]`` is the row player's payoff for ``(rows[i], cols[j])``.
    """
    rows = affordable_actions(my_ki)
    cols = affordable_actions(opp_ki)
    matrix = [
        [
            stage_payoff(me, opp, my_ki, opp_ki, turn, lam, value_fn)
            for opp in cols
        ]
        for me in rows
    ]
    return rows, cols, matrix


def match_state_key(my_round_wins: int, opp_round_wins: int, rounds_played: int) -> str:
    """Build the canonical match-state key string.

    Args:
        my_round_wins: Rounds I (the acting player) have won.
        opp_round_wins: Rounds the opponent has won.
        rounds_played: Total rounds completed (including draws).

    Returns:
        Key of the form ``"<my>-<opp>-<rounds_played>"``.
    """
    return f"{my_round_wins}-{opp_round_wins}-{rounds_played}"


def resolve_match_state(game_state: GameState) -> str:
    """Resolve the match-state key for the AI (player P2).

    The AI is always P2, so "my" wins are ``rounds_won_p2`` and "opp" wins
    are ``rounds_won_p1``. Rounds played is the number of completed rounds.

    Args:
        game_state: Current full game state.

    Returns:
        The match-state key for the upcoming round.
    """
    return match_state_key(
        game_state.rounds_won_p2,
        game_state.rounds_won_p1,
        len(game_state.round_results),
    )


def reachable_match_states() -> list[tuple[int, int, int]]:
    """Enumerate the pre-round match states reachable in a best-of-3.

    A pre-round state is one where a new round is about to start: neither
    player has reached :data:`ROUNDS_TO_WIN` and fewer than 3 rounds have
    been played. Draws consume a round without awarding a win.

    Returns:
        The list of ``(my_round_wins, opp_round_wins, rounds_played)`` tuples
        (exactly 8 states for a best-of-3).
    """
    states: list[tuple[int, int, int]] = []
    for rounds_played in range(3):
        for my_wins in range(rounds_played + 1):
            for opp_wins in range(rounds_played + 1 - my_wins):
                if my_wins >= ROUNDS_TO_WIN or opp_wins >= ROUNDS_TO_WIN:
                    continue
                states.append((my_wins, opp_wins, rounds_played))
    return states
