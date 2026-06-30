# CORE_CANDIDATE
"""Runtime strategy-table loader — lazy, load-once, module-cached.

This is the ONLY runtime bridge to the offline-solved strategy table. It is
pure stdlib (``json`` + ``importlib.resources``) so the production image needs
neither ``numpy`` nor ``scipy`` and starts instantly.

Design constraints (see the build contract):

* NO compute on the request path. The committed JSON is the source of truth.
  If the file is absent we raise :class:`TableMissingError` so the agent can
  degrade to :class:`ExpertAI` rather than block the FastAPI event loop with a
  multi-second solve.
* Lazy compute is an explicit opt-in (``warmup(compute_if_missing=True)``) for
  dev/tests/offline only — never triggered implicitly.
* The cache is **module-global** (not per-instance). ``game_service`` recreates
  the AI every turn, so per-turn re-instantiation must stay O(1).
"""

from __future__ import annotations

import importlib.resources
import json
from importlib.abc import Traversable

from app.exceptions import AppError

# Module-global parsed table. Loaded once, then reused across every AI instance
# and every turn. ``None`` means "not yet loaded".
_TABLE: dict | None = None

_DATA_PACKAGE = "app.core.ai_opponent.grandmaster.data"
_TABLE_FILENAME = "strategy_table.json"

# Engine constants duplicated as plain ints so this module never imports the
# offline solver/transition layer at load time. They only bound array indices.
_KI_CAP = 10
_TURN_LIMIT = 20

# Fallback match-state key for the (theoretically unreachable) case where a
# resolved match state is not present in the committed maps — the match start.
_DEFAULT_MATCH_STATE = "0-0-0"


class TableMissingError(AppError):
    """Raised when the committed strategy table cannot be found.

    The agent catches this and degrades to :class:`ExpertAI`. It is never
    raised on a healthy production deploy because the JSON ships in the wheel.
    """

    def __init__(self, message: str = "Grandmaster strategy table is missing") -> None:
        super().__init__(
            code="grandmaster_table_missing",
            message=message,
            status_code=500,
        )


def _table_path() -> Traversable:
    """Resolve the committed table path, wheel-safe.

    Returns:
        A :class:`Traversable` pointing at ``strategy_table.json`` inside the
        ``data`` subpackage. Works whether the package is on disk or zipped.
    """
    return importlib.resources.files(_DATA_PACKAGE).joinpath(_TABLE_FILENAME)


def _load_table(allow_compute: bool = False) -> dict:
    """Load (and memoize) the strategy table.

    Args:
        allow_compute: If True and the committed file is absent, lazily import
            the offline solver and build the table in-process. This is for
            dev/tests/offline ONLY and must never be enabled on the request
            path (it pulls in ``numpy``/``scipy`` and takes seconds).

    Returns:
        The parsed strategy dict (cached in :data:`_TABLE`).

    Raises:
        TableMissingError: If the file is absent and ``allow_compute`` is False.
    """
    global _TABLE
    if _TABLE is not None:
        return _TABLE

    path = _table_path()
    if path.is_file():
        with path.open("r", encoding="utf-8") as fh:
            _TABLE = json.load(fh)
        return _TABLE

    if allow_compute:
        # Explicit opt-in: import the offline solver lazily so it never enters
        # the runtime import graph.
        from app.core.ai_opponent.grandmaster.solver import (
            build_full_strategy,
            serialize,
        )

        _TABLE = serialize(build_full_strategy())
        return _TABLE

    raise TableMissingError(
        f"Strategy table not found at {_DATA_PACKAGE}/{_TABLE_FILENAME}. "
        "Generate it with `python3 scripts/generate_strategy_table.py` and "
        "commit the result, or call warmup(compute_if_missing=True) for dev."
    )


def is_loaded() -> bool:
    """Return whether the table has been loaded into the module cache."""
    return _TABLE is not None


def warmup(compute_if_missing: bool = False) -> None:
    """Optionally preload the table (e.g. at app startup or in tests).

    Args:
        compute_if_missing: Allow lazy in-process compute if the file is
            absent. Off by default to keep the request path safe.
    """
    _load_table(allow_compute=compute_if_missing)


def _round_table_for(match_state_key: str) -> dict:
    """Return the round table dict backing a match state.

    Args:
        match_state_key: ``"<my>-<opp>-<rounds_played>"``.

    Returns:
        The ``round_tables`` entry (with ``v``, ``sigma``, ``lambda``).
    """
    table = _load_table()
    state_to_table = table["match_state_to_table"]
    lkey = state_to_table.get(match_state_key) or state_to_table[_DEFAULT_MATCH_STATE]
    return table["round_tables"][lkey]


def _clamp_turn(turn: int) -> int:
    """Clamp an upcoming turn number into the valid ``[1, TURN_LIMIT]`` range."""
    if turn < 1:
        return 1
    if turn > _TURN_LIMIT:
        return _TURN_LIMIT
    return turn


def _clamp_ki(ki: int) -> int:
    """Clamp a ki value into the valid ``[0, KI_CAP]`` range."""
    if ki < 0:
        return 0
    if ki > _KI_CAP:
        return _KI_CAP
    return ki


def get_lambda(match_state_key: str) -> float:
    """Return the round draw-weight ``lam`` for a match state.

    Args:
        match_state_key: ``"<my>-<opp>-<rounds_played>"``.

    Returns:
        The match-draw weight in ``[0, 1]``.
    """
    table = _load_table()
    state_to_lambda = table["match_state_to_lambda"]
    if match_state_key in state_to_lambda:
        return float(state_to_lambda[match_state_key])
    return float(state_to_lambda[_DEFAULT_MATCH_STATE])


def get_sigma(
    match_state_key: str,
    my_ki: int,
    opp_ki: int,
    turn: int,
) -> list[float]:
    """Return the GTO mixed strategy for a state.

    Args:
        match_state_key: ``"<my>-<opp>-<rounds_played>"``.
        my_ki: The AI's ki in ``[0, KI_CAP]``.
        opp_ki: The opponent's ki in ``[0, KI_CAP]``.
        turn: Upcoming turn number; clamped to ``[1, TURN_LIMIT]``.

    Returns:
        A length-5 strategy vector over ``ACTION_ORDER`` (zero on unaffordable
        actions, sums to 1).
    """
    rt = _round_table_for(match_state_key)
    ti = _clamp_turn(turn) - 1
    vec = rt["sigma"][_clamp_ki(my_ki)][_clamp_ki(opp_ki)][ti]
    return [float(p) for p in vec]


def get_value(
    match_state_key: str,
    my_ki: int,
    opp_ki: int,
    turn: int,
) -> float:
    """Return the equilibrium value ``V`` for a state.

    Args:
        match_state_key: ``"<my>-<opp>-<rounds_played>"``.
        my_ki: The AI's ki in ``[0, KI_CAP]``.
        opp_ki: The opponent's ki in ``[0, KI_CAP]``.
        turn: Upcoming turn number; clamped to ``[1, TURN_LIMIT]``.

    Returns:
        The acting player's equilibrium round-win probability in ``[0, 1]``.
    """
    rt = _round_table_for(match_state_key)
    ti = _clamp_turn(turn) - 1
    return float(rt["v"][_clamp_ki(my_ki)][_clamp_ki(opp_ki)][ti])
