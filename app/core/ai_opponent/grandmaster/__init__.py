# CORE_CANDIDATE
"""Grandmaster AI package — match-aware GTO core + bounded exploitation.

Public surface:
    - ``GrandmasterAI``: the runtime :class:`AIOpponent` implementation.
    - ``warmup``: optional startup/offline preload of the strategy table.

Re-exports are intentionally **lazy** (PEP 562 ``__getattr__``). Importing a
submodule directly (e.g. ``grandmaster.transition``) must NOT drag in the
runtime agent/table modules or the offline solver. This keeps the offline
math (``solver``, ``matrix_game``) and the runtime policy strictly separable
and lets the heavy ``numpy``/``scipy`` dependencies stay out of the import
graph until they are explicitly requested.
"""

from typing import Any

__all__ = ["GrandmasterAI", "warmup"]


def __getattr__(name: str) -> Any:
    """Lazily resolve the package's public attributes (PEP 562).

    Args:
        name: Attribute being accessed on the package.

    Returns:
        The resolved attribute.

    Raises:
        AttributeError: If ``name`` is not a public attribute.
    """
    if name == "GrandmasterAI":
        from app.core.ai_opponent.grandmaster.agent import GrandmasterAI

        return GrandmasterAI
    if name == "warmup":
        from app.core.ai_opponent.grandmaster.table import warmup

        return warmup
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
