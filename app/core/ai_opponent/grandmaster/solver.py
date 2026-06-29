"""Offline backward-induction solver + full strategy table builder.

This module is **offline-only**: it is imported during table generation or
from tests, never on the runtime request path. It may transitively use
``scipy``/``numpy`` via :mod:`matrix_game`.

Two coupled backward inductions, both in win-probability units (win=1,
loss=0, draw=0.5):

ROUND game (per ``lam``):
    For a fixed match-draw weight ``lam`` in ``[0, 1]``, solve the single
    round by backward induction over turns ``20 -> 1`` and all
    ``(my_ki, opp_ki)`` in ``0..10``. Each state's stage game (over affordable
    actions) is solved for the row player's Nash mixed strategy and value.

MATCH game (best-of-3):
    Decompose the best-of-3 into a tiny backward induction over the 8 reachable
    pre-round score states. Each state's round is played with a draw weight
    ``lam(s)`` derived from the match-continuation values, and its
    continuation value is ``U(s) = L + (W - L) * R(lam(s))`` where
    ``R(lam) = V_lam(0, 0, turn=1)`` is the normalized round-start value.

By the affine invariance of the round game, only a handful of distinct
``lam`` values arise across the 8 states, so only a few full round tables
must be solved.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from app.core.ai_opponent.grandmaster.matrix_game import has_scipy, solve_zero_sum
from app.core.ai_opponent.grandmaster.transition import (
    ACTION_ORDER,
    action_index,
    affordable_mask,
    build_stage_matrix,
    match_state_key,
    reachable_match_states,
)
from app.core.game_engine.outcome_matrix import resolve_actions
from app.core.game_engine.types import (
    ACTION_KI_COST,
    ACTION_KI_GAIN,
    KI_CAP,
    ROUNDS_TO_WIN,
    TURN_LIMIT,
)

_LAMBDA_DECIMALS = 6  # rounding for lambda keys and serialized floats


@dataclass
class RoundTable:
    """A solved single-round table for a fixed match-draw weight ``lam``.

    Attributes:
        lam: The match-draw weight this table was solved for.
        v: Value table indexed ``v[my_ki][opp_ki][turn_idx]`` where
            ``turn_idx = turn - 1`` in ``[0, TURN_LIMIT)``.
        sigma: Strategy table indexed
            ``sigma[my_ki][opp_ki][turn_idx][action_idx]`` (length-5 over
            :data:`ACTION_ORDER`, zero on unaffordable actions).
    """

    lam: float
    v: list[list[list[float]]]
    sigma: list[list[list[list[float]]]]


def solve_round_table(lam: float, *, prefer_lp: bool = True) -> RoundTable:
    """Solve one round table via backward induction for a fixed ``lam``.

    Args:
        lam: Match-draw weight in ``[0, 1]``.
        prefer_lp: Prefer the exact LP solver when SciPy is available.

    Returns:
        The solved :class:`RoundTable`.
    """
    n_ki = KI_CAP + 1
    # v[my_ki][opp_ki][turn_idx]
    v: list[list[list[float]]] = [
        [[0.0] * TURN_LIMIT for _ in range(n_ki)] for _ in range(n_ki)
    ]
    # sigma[my_ki][opp_ki][turn_idx][action_idx]
    sigma: list[list[list[list[float]]]] = [
        [[[0.0] * len(ACTION_ORDER) for _ in range(TURN_LIMIT)] for _ in range(n_ki)]
        for _ in range(n_ki)
    ]

    def value_fn(my_ki: int, opp_ki: int, turn: int) -> float:
        # Continuation lookup; called only for turn in [2, TURN_LIMIT],
        # which is already computed when solving earlier turns backward.
        return v[my_ki][opp_ki][turn - 1]

    # Backward induction: turn = TURN_LIMIT .. 1.
    for turn in range(TURN_LIMIT, 0, -1):
        ti = turn - 1
        for my_ki in range(n_ki):
            for opp_ki in range(n_ki):
                rows, _cols, matrix = build_stage_matrix(
                    my_ki, opp_ki, turn, lam, value_fn
                )
                row_strat, value = solve_zero_sum(matrix, prefer_lp=prefer_lp)
                v[my_ki][opp_ki][ti] = value
                cell = sigma[my_ki][opp_ki][ti]
                for k, action in enumerate(rows):
                    cell[action_index(action)] = row_strat[k]

    return RoundTable(lam=lam, v=v, sigma=sigma)


def round_start_value(table: RoundTable) -> float:
    """Return ``R(lam) = V_lam(my_ki=0, opp_ki=0, turn=1)``.

    Args:
        table: A solved round table.

    Returns:
        The normalized round-start value.
    """
    return table.v[0][0][0]


# --------------------------------------------------------------------------- #
# Match-level backward induction
# --------------------------------------------------------------------------- #


def _terminal_match_value(my: int, opp: int, rounds_played: int) -> float | None:
    """Return the terminal match value, or None if the state is non-terminal.

    Args:
        my: My round wins.
        opp: Opponent round wins.
        rounds_played: Rounds completed (including draws).

    Returns:
        ``1.0`` if I have clinched, ``0.0`` if the opponent has, ``0.5`` if all
        rounds are exhausted with neither at :data:`ROUNDS_TO_WIN`, else None.
    """
    if my >= ROUNDS_TO_WIN:
        return 1.0
    if opp >= ROUNDS_TO_WIN:
        return 0.0
    if rounds_played >= 3:
        return 0.5
    return None


def _match_induction(
    r_value: Callable[[float], float],
) -> tuple[dict[str, float], dict[str, float]]:
    """Run the best-of-3 backward induction.

    Args:
        r_value: ``lam -> R(lam)`` round-start value oracle.

    Returns:
        ``(lambdas, values)`` mapping each non-terminal pre-round match-state
        key to its round draw-weight ``lam`` and its continuation value ``U``.
    """
    lambdas: dict[str, float] = {}
    values: dict[str, float] = {}
    memo: dict[tuple[int, int, int], float] = {}

    def u(my: int, opp: int, rounds_played: int) -> float:
        terminal = _terminal_match_value(my, opp, rounds_played)
        if terminal is not None:
            return terminal

        key = (my, opp, rounds_played)
        if key in memo:
            return memo[key]

        win = u(my + 1, opp, rounds_played + 1)
        loss = u(my, opp + 1, rounds_played + 1)
        draw = u(my, opp, rounds_played + 1)

        if win == loss:
            # Degenerate: the round cannot change the match value (e.g. a
            # guaranteed-draw decider). lam is irrelevant; pin it to 0.5.
            lam = 0.5
            result = loss
        else:
            lam = (draw - loss) / (win - loss)
            result = loss + (win - loss) * r_value(lam)

        skey = match_state_key(my, opp, rounds_played)
        lambdas[skey] = lam
        values[skey] = result
        memo[key] = result
        return result

    # Force evaluation of every reachable pre-round state.
    for my, opp, rounds_played in reachable_match_states():
        u(my, opp, rounds_played)

    return lambdas, values


def _table_cache_r_value(
    cache: dict[float, RoundTable], *, prefer_lp: bool
) -> Callable[[float], float]:
    """Build an ``R(lam)`` oracle backed by a memoizing table cache.

    Args:
        cache: Mutable ``rounded_lam -> RoundTable`` store, populated lazily.
        prefer_lp: Prefer the LP solver.

    Returns:
        A function ``lam -> R(lam)`` that solves (and caches) tables on demand.
    """

    def r_value(lam: float) -> float:
        key = round(lam, _LAMBDA_DECIMALS)
        table = cache.get(key)
        if table is None:
            table = solve_round_table(key, prefer_lp=prefer_lp)
            cache[key] = table
        return round_start_value(table)

    return r_value


def compute_match_lambdas(*, prefer_lp: bool = True) -> dict[str, float]:
    """Compute the per-match-state round draw weights.

    Args:
        prefer_lp: Prefer the LP solver.

    Returns:
        ``match_state_key -> lam`` for all 8 pre-round states.
    """
    cache: dict[float, RoundTable] = {}
    lambdas, _values = _match_induction(
        _table_cache_r_value(cache, prefer_lp=prefer_lp)
    )
    return lambdas


def compute_match_values(*, prefer_lp: bool = True) -> dict[str, float]:
    """Compute the per-match-state continuation values ``U``.

    Args:
        prefer_lp: Prefer the LP solver.

    Returns:
        ``match_state_key -> U`` for all 8 pre-round states.
    """
    cache: dict[float, RoundTable] = {}
    _lambdas, values = _match_induction(
        _table_cache_r_value(cache, prefer_lp=prefer_lp)
    )
    return values


# --------------------------------------------------------------------------- #
# Full strategy assembly + serialization
# --------------------------------------------------------------------------- #


def _lambda_key(lam: float) -> str:
    """Stable string key for a round table keyed by its lambda.

    Args:
        lam: The lambda value.

    Returns:
        Key of the form ``"lam_0.123456"``.
    """
    return f"lam_{round(lam, _LAMBDA_DECIMALS):.{_LAMBDA_DECIMALS}f}"


def _engine_fingerprint() -> str:
    """Hash the engine rules so a stale table can be detected.

    Returns:
        A short hex digest over ki costs/gains, caps, limits and the full
        outcome matrix.
    """
    parts: list[str] = [
        f"KI_CAP={KI_CAP}",
        f"TURN_LIMIT={TURN_LIMIT}",
        f"ROUNDS_TO_WIN={ROUNDS_TO_WIN}",
    ]
    for a in ACTION_ORDER:
        parts.append(f"cost[{a.value}]={ACTION_KI_COST[a]}")
        parts.append(f"gain[{a.value}]={ACTION_KI_GAIN[a]}")
    for me in ACTION_ORDER:
        for opp in ACTION_ORDER:
            parts.append(f"{me.value}x{opp.value}={resolve_actions(me, opp).value}")
    blob = "|".join(parts).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()[:16]


def build_full_strategy(*, prefer_lp: bool = True) -> dict:
    """Build the full serializable strategy: round tables + match maps.

    Runs the interleaved match induction (which lazily solves every distinct
    round table), then assembles the maps from match state to lambda and to
    the lambda-keyed round table.

    Args:
        prefer_lp: Prefer the LP solver when SciPy is available.

    Returns:
        A nested dict matching the committed JSON schema (pre-rounding).
    """
    cache: dict[float, RoundTable] = {}
    lambdas, values = _match_induction(
        _table_cache_r_value(cache, prefer_lp=prefer_lp)
    )

    round_tables: dict[str, dict] = {}
    match_state_to_lambda: dict[str, float] = {}
    match_state_to_table: dict[str, str] = {}

    for skey, lam in lambdas.items():
        rounded = round(lam, _LAMBDA_DECIMALS)
        table = cache.get(rounded)
        if table is None:
            table = solve_round_table(rounded, prefer_lp=prefer_lp)
            cache[rounded] = table
        lkey = _lambda_key(lam)
        match_state_to_lambda[skey] = rounded
        match_state_to_table[skey] = lkey
        if lkey not in round_tables:
            round_tables[lkey] = {
                "lambda": rounded,
                "v": table.v,
                "sigma": table.sigma,
            }

    strategy: dict = {
        "meta": {
            "version": 1,
            "ki_cap": KI_CAP,
            "turn_limit": TURN_LIMIT,
            "rounds_to_win": ROUNDS_TO_WIN,
            "solver": "scipy-linprog" if (prefer_lp and has_scipy()) else "regret-matching",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "engine_fingerprint": _engine_fingerprint(),
        },
        "actions": [a.value for a in ACTION_ORDER],
        "match_state_to_lambda": match_state_to_lambda,
        "match_state_to_table": match_state_to_table,
        "match_state_to_value": values,
        "round_tables": round_tables,
    }
    return strategy


def _round_floats(obj: object, ndigits: int) -> object:
    """Recursively round all floats in a nested structure.

    Args:
        obj: Arbitrary JSON-like nested structure.
        ndigits: Decimal places.

    Returns:
        The structure with every float rounded.
    """
    if isinstance(obj, float):
        return round(obj, ndigits)
    if isinstance(obj, list):
        return [_round_floats(x, ndigits) for x in obj]
    if isinstance(obj, dict):
        return {k: _round_floats(v, ndigits) for k, v in obj.items()}
    return obj


def serialize(strategy: dict) -> dict:
    """Round all floats for compact, stable JSON output.

    Args:
        strategy: Strategy dict from :func:`build_full_strategy`.

    Returns:
        A new dict with floats rounded to :data:`_LAMBDA_DECIMALS` places.
    """
    return _round_floats(strategy, _LAMBDA_DECIMALS)  # type: ignore[return-value]


def save_json(strategy: dict, path: str | Path) -> None:
    """Serialize and write the strategy table to ``path``.

    Args:
        strategy: Strategy dict from :func:`build_full_strategy`.
        path: Destination file path; parent dirs are created.
    """
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        json.dump(serialize(strategy), fh, separators=(",", ":"), sort_keys=True)
        fh.write("\n")


def _assert_invariants(strategy: dict, *, tol: float = 1e-3) -> None:
    """Assert all correctness invariants on a built strategy.

    Checks, for every round table: sigma vectors are simplices and zero on
    unaffordable actions; values lie in ``[0, 1]``. Across mirrored tables:
    the constant-sum symmetry ``V_lam(a,b,t) + V_{1-lam}(b,a,t) == 1``. On the
    match maps: ``U(0,0,0) == 0.5`` and ``U(1,0,2) + U(0,1,2) == 1``.

    Args:
        strategy: A built (pre- or post-serialize) strategy dict.
        tol: Numeric tolerance.

    Raises:
        AssertionError: If any invariant is violated.
    """
    n_ki = KI_CAP + 1
    round_tables = strategy["round_tables"]

    # Per-table simplex / affordability / value-range invariants.
    masks = [affordable_mask(ki) for ki in range(n_ki)]
    for lkey, table in round_tables.items():
        v = table["v"]
        sigma = table["sigma"]
        for my_ki in range(n_ki):
            for opp_ki in range(n_ki):
                for ti in range(TURN_LIMIT):
                    val = v[my_ki][opp_ki][ti]
                    assert -tol <= val <= 1.0 + tol, (
                        f"value out of range in {lkey} at "
                        f"({my_ki},{opp_ki},{ti}): {val}"
                    )
                    vec = sigma[my_ki][opp_ki][ti]
                    assert all(p >= -tol for p in vec), (
                        f"negative sigma in {lkey} at ({my_ki},{opp_ki},{ti})"
                    )
                    assert abs(sum(vec) - 1.0) <= tol, (
                        f"sigma not simplex in {lkey} at "
                        f"({my_ki},{opp_ki},{ti}): sum={sum(vec)}"
                    )
                    for idx, affordable in enumerate(masks[my_ki]):
                        if not affordable:
                            assert vec[idx] <= tol, (
                                f"mass on unaffordable action {idx} in {lkey} "
                                f"at ({my_ki},{opp_ki},{ti})"
                            )

    # Constant-sum symmetry across mirrored lambdas.
    by_lambda = {round(t["lambda"], _LAMBDA_DECIMALS): t for t in round_tables.values()}
    for lam, table in by_lambda.items():
        mirror = by_lambda.get(round(1.0 - lam, _LAMBDA_DECIMALS))
        if mirror is None:
            continue
        v = table["v"]
        vm = mirror["v"]
        for my_ki in range(n_ki):
            for opp_ki in range(n_ki):
                for ti in range(TURN_LIMIT):
                    s = v[my_ki][opp_ki][ti] + vm[opp_ki][my_ki][ti]
                    assert abs(s - 1.0) <= tol, (
                        f"symmetry violated lam={lam} at "
                        f"({my_ki},{opp_ki},{ti}): {s}"
                    )

    # Match-level invariants.
    values = strategy["match_state_to_value"]
    assert abs(values["0-0-0"] - 0.5) <= tol, f"U(0,0,0)={values['0-0-0']}"
    assert abs(values["0-0-1"] - 0.5) <= tol, f"U(0,0,1)={values['0-0-1']}"
    assert abs(values["1-1-2"] - 0.5) <= tol, f"U(1,1,2)={values['1-1-2']}"
    pair = values["1-0-2"] + values["0-1-2"]
    assert abs(pair - 1.0) <= tol, f"U(1,0,2)+U(0,1,2)={pair}"
