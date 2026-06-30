#!/usr/bin/env python3
"""Offline generator for the Grandmaster strategy table (build-only).

This is the ONLY place ``numpy``/``scipy`` may be used (behind the optional
``gen`` dependency group). It runs the offline backward-induction solver,
asserts every correctness invariant, and writes the committed JSON artifact
that the stdlib-only runtime loads.

Regenerate:
    pip install -e .[gen] && python3 scripts/generate_strategy_table.py

The resulting ``app/core/ai_opponent/grandmaster/data/strategy_table.json``
MUST be committed to git (treated like a checked-in lockfile) so CI/Docker/prod
need no numpy/scipy and start instantly.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Bootstrap: make the repo root importable when run as `python3 scripts/...`.
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from app.core.ai_opponent.grandmaster.solver import (  # noqa: E402
    _assert_invariants,
    build_full_strategy,
    save_json,
    serialize,
)

_OUTPUT_PATH = (
    _REPO_ROOT
    / "app"
    / "core"
    / "ai_opponent"
    / "grandmaster"
    / "data"
    / "strategy_table.json"
)


def main() -> None:
    """Build, validate, serialize and write the strategy table."""
    print("Building Grandmaster strategy table (offline backward induction)...")
    start = time.perf_counter()
    strategy = build_full_strategy(prefer_lp=True)
    build_secs = time.perf_counter() - start

    print("Asserting correctness invariants...")
    _assert_invariants(strategy)

    # Symmetry max-error stat across mirrored lambda tables.
    serialized = serialize(strategy)
    sym_err = _symmetry_max_error(serialized)

    save_json(strategy, _OUTPUT_PATH)
    size_kb = _OUTPUT_PATH.stat().st_size / 1024.0

    distinct_lambdas = sorted(
        {t["lambda"] for t in strategy["round_tables"].values()}
    )
    n_match_states = len(strategy["match_state_to_lambda"])

    print("-" * 60)
    print(f"  output:            {_OUTPUT_PATH}")
    print(f"  size:              {size_kb:.1f} KiB")
    print(f"  build time:        {build_secs:.1f}s")
    print(f"  solver:            {strategy['meta']['solver']}")
    print(f"  engine fingerprint:{strategy['meta']['engine_fingerprint']}")
    print(f"  match states:      {n_match_states}")
    print(f"  distinct lambdas:  {len(distinct_lambdas)} -> {distinct_lambdas}")
    print(f"  round tables:      {len(strategy['round_tables'])}")
    print(f"  symmetry max-err:  {sym_err:.2e}")
    print("-" * 60)
    print("Done. COMMIT the generated JSON.")


def _symmetry_max_error(strategy: dict) -> float:
    """Compute max |V_lam(a,b,t) + V_{1-lam}(b,a,t) - 1| across mirrored tables.

    Args:
        strategy: A built (serialized) strategy dict.

    Returns:
        The maximum constant-sum symmetry deviation (0 if no mirror pairs).
    """
    n_ki = strategy["meta"]["ki_cap"] + 1
    turn_limit = strategy["meta"]["turn_limit"]
    by_lambda = {
        round(t["lambda"], 6): t for t in strategy["round_tables"].values()
    }
    worst = 0.0
    for lam, table in by_lambda.items():
        mirror = by_lambda.get(round(1.0 - lam, 6))
        if mirror is None:
            continue
        v = table["v"]
        vm = mirror["v"]
        for a in range(n_ki):
            for b in range(n_ki):
                for ti in range(turn_limit):
                    worst = max(worst, abs(v[a][b][ti] + vm[b][a][ti] - 1.0))
    return worst


if __name__ == "__main__":
    main()
