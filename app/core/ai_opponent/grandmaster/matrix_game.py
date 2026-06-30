# CORE_CANDIDATE
"""Two-player constant-sum matrix game solver.

A single clean facade, :func:`solve_zero_sum`, returns the row player's
equilibrium mixed strategy and the game value for a payoff matrix in which
the row player maximizes and the column player minimizes.

Two engines back the facade:

* ``scipy.optimize.linprog`` (exact LP) when SciPy is importable. This is the
  preferred path for offline table generation.
* A pure-Python regret-matching solver (Hart & Mas-Colell) that converges to
  Nash for zero-sum games via time-averaged strategies. No external deps.

This module is **offline-only** by role: it is imported by the solver during
table generation, never on the runtime request path.
"""

from __future__ import annotations

import random


def has_scipy() -> bool:
    """Return whether ``scipy.optimize.linprog`` is importable.

    Returns:
        True if SciPy is available.
    """
    try:
        import scipy.optimize  # noqa: F401
    except ImportError:
        return False
    return True


def _normalize(weights: list[float]) -> list[float]:
    """Clamp tiny negatives and renormalize a weight vector to a simplex.

    Args:
        weights: Raw (possibly slightly negative) weights.

    Returns:
        A non-negative vector summing to 1. Falls back to uniform if the
        total mass is non-positive.
    """
    clamped = [w if w > 0.0 else 0.0 for w in weights]
    total = sum(clamped)
    if total <= 0.0:
        n = len(weights)
        return [1.0 / n] * n
    return [w / total for w in clamped]


def solve_lp(payoff: list[list[float]]) -> tuple[list[float], list[float], float]:
    """Solve a constant-sum matrix game exactly via linear programming.

    Solves two LPs: the row player's maximin and the column player's minimax.

    Row LP: maximize ``v`` s.t. ``sum_i x_i * A[i][j] >= v`` for all columns
    ``j``, ``sum_i x_i = 1``, ``x >= 0``.

    Args:
        payoff: ``A[i][j]`` = row player's payoff for ``(row i, col j)``.

    Returns:
        ``(row_strategy, col_strategy, value)``.

    Raises:
        ImportError: If SciPy is not available.
        RuntimeError: If either LP fails to solve.
    """
    from scipy.optimize import linprog

    n = len(payoff)
    m = len(payoff[0])

    # ----- Row player's maximin LP. Variables: x_0..x_{n-1}, v. -----
    c_row = [0.0] * n + [-1.0]  # minimize -v  <=>  maximize v
    # For each column j: v - sum_i x_i A[i][j] <= 0
    a_ub_row = [[-payoff[i][j] for i in range(n)] + [1.0] for j in range(m)]
    b_ub_row = [0.0] * m
    a_eq_row = [[1.0] * n + [0.0]]
    b_eq_row = [1.0]
    bounds_row = [(0.0, None)] * n + [(None, None)]
    res_row = linprog(
        c_row,
        A_ub=a_ub_row,
        b_ub=b_ub_row,
        A_eq=a_eq_row,
        b_eq=b_eq_row,
        bounds=bounds_row,
        method="highs",
    )
    if not res_row.success:
        raise RuntimeError(f"Row LP failed: {res_row.message}")
    row = _normalize(list(res_row.x[:n]))
    value = float(res_row.x[n])

    # ----- Column player's minimax LP. Variables: y_0..y_{m-1}, w. -----
    c_col = [0.0] * m + [1.0]  # minimize w
    # For each row i: sum_j A[i][j] y_j - w <= 0
    a_ub_col = [[payoff[i][j] for j in range(m)] + [-1.0] for i in range(n)]
    b_ub_col = [0.0] * n
    a_eq_col = [[1.0] * m + [0.0]]
    b_eq_col = [1.0]
    bounds_col = [(0.0, None)] * m + [(None, None)]
    res_col = linprog(
        c_col,
        A_ub=a_ub_col,
        b_ub=b_ub_col,
        A_eq=a_eq_col,
        b_eq=b_eq_col,
        bounds=bounds_col,
        method="highs",
    )
    if not res_col.success:
        raise RuntimeError(f"Col LP failed: {res_col.message}")
    col = _normalize(list(res_col.x[:m]))

    return row, col, value


def solve_regret_matching(
    payoff: list[list[float]],
    iters: int = 50000,
    seed: int = 0,
) -> tuple[list[float], list[float], float]:
    """Solve a constant-sum matrix game via regret matching.

    Both players run regret matching (Hart & Mas-Colell). The time-averaged
    strategies converge to a Nash equilibrium of the zero-sum game; the game
    value is evaluated at the averaged strategies.

    Args:
        payoff: Row player's payoff matrix.
        iters: Number of self-play iterations.
        seed: Unused placeholder for API symmetry (deterministic algorithm).

    Returns:
        ``(row_strategy, col_strategy, value)``.
    """
    _ = seed  # algorithm is deterministic; kept for signature parity
    n = len(payoff)
    m = len(payoff[0])

    row_regret = [0.0] * n
    col_regret = [0.0] * m
    row_sum = [0.0] * n
    col_sum = [0.0] * m

    def strategy_from_regret(regret: list[float], size: int) -> list[float]:
        pos = [r if r > 0.0 else 0.0 for r in regret]
        total = sum(pos)
        if total <= 0.0:
            return [1.0 / size] * size
        return [p / total for p in pos]

    for _ in range(iters):
        x = strategy_from_regret(row_regret, n)
        y = strategy_from_regret(col_regret, m)

        for i in range(n):
            row_sum[i] += x[i]
        for j in range(m):
            col_sum[j] += y[j]

        # Row player maximizes A.
        row_util = [sum(payoff[i][j] * y[j] for j in range(m)) for i in range(n)]
        row_value = sum(x[i] * row_util[i] for i in range(n))
        for i in range(n):
            row_regret[i] += row_util[i] - row_value

        # Column player maximizes -A (minimizes A).
        col_util = [-sum(payoff[i][j] * x[i] for i in range(n)) for j in range(m)]
        col_value = sum(y[j] * col_util[j] for j in range(m))
        for j in range(m):
            col_regret[j] += col_util[j] - col_value

    row = _normalize(row_sum)
    col = _normalize(col_sum)
    value = sum(
        row[i] * payoff[i][j] * col[j] for i in range(n) for j in range(m)
    )
    return row, col, value


def maxmin_gap(
    payoff: list[list[float]],
    row: list[float],
    col: list[float],
) -> float:
    """Compute the equilibrium gap (upper value minus lower value).

    The lower value is what the row strategy guarantees against the best pure
    column response; the upper value is what the column strategy concedes to
    the best pure row response. At a Nash equilibrium both equal the game
    value and the gap is ~0.

    Args:
        payoff: Row player's payoff matrix.
        row: Row mixed strategy.
        col: Column mixed strategy.

    Returns:
        ``upper - lower`` (non-negative at/near equilibrium).
    """
    n = len(payoff)
    m = len(payoff[0])
    # Lower value: row guarantees min over pure column responses.
    lower = min(
        sum(row[i] * payoff[i][j] for i in range(n)) for j in range(m)
    )
    # Upper value: column concedes max over pure row responses.
    upper = max(
        sum(payoff[i][j] * col[j] for j in range(m)) for i in range(n)
    )
    return upper - lower


def solve_zero_sum(
    payoff: list[list[float]],
    *,
    prefer_lp: bool = True,
    iters: int = 50000,
    seed: int = 0,
) -> tuple[list[float], float]:
    """Solve a constant-sum matrix game for the row player.

    Uses the exact LP solver when SciPy is available and ``prefer_lp`` is set,
    otherwise falls back to regret matching. Trivial 1xN / Nx1 / 1x1 shapes
    are handled directly.

    Args:
        payoff: ``A[i][j]`` = row player's payoff for ``(row i, col j)``.
        prefer_lp: Prefer the SciPy LP solver when available.
        iters: Regret-matching iterations (fallback path).
        seed: Seed placeholder for the regret-matching path.

    Returns:
        ``(row_strategy, value)`` — the row player's equilibrium mixed
        strategy (sums to 1) and the game value.
    """
    n = len(payoff)
    m = len(payoff[0])

    # Degenerate shapes: a single row/column collapses the maximin.
    if n == 1:
        # Only one action available: play it; value is the worst column.
        return [1.0], min(payoff[0])
    if m == 1:
        # Opponent has one action: pick the row maximizing that column.
        col_vals = [payoff[i][0] for i in range(n)]
        best = max(range(n), key=lambda i: col_vals[i])
        strat = [0.0] * n
        strat[best] = 1.0
        return strat, col_vals[best]

    if prefer_lp and has_scipy():
        row, _col, value = solve_lp(payoff)
        return row, value

    row, _col, value = solve_regret_matching(payoff, iters=iters, seed=seed)
    return row, value
