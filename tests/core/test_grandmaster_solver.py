"""Correctness tests for the Grandmaster GTO solver + committed strategy table.

These assert the game-theoretic invariants of the solved table — the same
checks an adversarial reviewer would run:

* Every stored mixed strategy is a valid probability simplex over exactly the
  affordable actions (no mass on actions the player cannot afford).
* The round value function is constant-sum: ``V(a,b,t) + V(b,a,t) == 1`` wherever
  the round draw-weight ``lambda == 0.5`` (the symmetric case).
* The Grandmaster transition adapter never drifts from the live engine.
"""

from __future__ import annotations

import pytest

from app.core.ai_opponent.grandmaster import table
from app.core.ai_opponent.grandmaster.transition import ACTION_ORDER, ki_after
from app.core.game_engine.outcome_matrix import resolve_turn
from app.core.game_engine.types import ACTION_KI_COST, Action, KI_CAP, TURN_LIMIT


@pytest.fixture(scope="module")
def loaded_table() -> dict:
    """Load the committed strategy table once for the module."""
    table.warmup()  # raises TableMissingError if the committed JSON is absent
    return table._load_table()


def test_table_is_committed(loaded_table: dict) -> None:
    """The strategy table must ship with the package (instant runtime load)."""
    assert "round_tables" in loaded_table
    assert "match_state_to_table" in loaded_table
    assert loaded_table["round_tables"], "no round tables in committed table"


def test_every_sigma_is_a_simplex_over_affordable(loaded_table: dict) -> None:
    """Each sigma is a probability dist; zero on unaffordable actions."""
    bad_simplex = 0
    mass_on_unaffordable = 0
    for lkey, rt in loaded_table["round_tables"].items():
        sigma = rt["sigma"]
        for my_ki in range(KI_CAP + 1):
            for opp_ki in range(KI_CAP + 1):
                for ti in range(TURN_LIMIT):
                    vec = sigma[my_ki][opp_ki][ti]
                    if abs(sum(vec) - 1.0) > 1e-3:
                        bad_simplex += 1
                    for idx, a in enumerate(ACTION_ORDER):
                        if ACTION_KI_COST[a] > my_ki and vec[idx] > 1e-9:
                            mass_on_unaffordable += 1
    assert bad_simplex == 0, f"{bad_simplex} sigma vectors are not simplices"
    assert mass_on_unaffordable == 0, (
        f"{mass_on_unaffordable} sigma entries put mass on unaffordable actions"
    )


def test_round_value_is_constant_sum_where_symmetric(loaded_table: dict) -> None:
    """V(a,b,t) + V(b,a,t) == 1 for every round table with lambda == 0.5."""
    checked_tables = 0
    for lkey, rt in loaded_table["round_tables"].items():
        if abs(float(rt.get("lambda", 0.5)) - 0.5) > 1e-6:
            continue  # asymmetric match states are intentionally not symmetric
        checked_tables += 1
        V = rt["v"]
        max_dev = 0.0
        for a in range(KI_CAP + 1):
            for b in range(KI_CAP + 1):
                for ti in range(TURN_LIMIT):
                    max_dev = max(max_dev, abs(V[a][b][ti] + V[b][a][ti] - 1.0))
        assert max_dev < 1e-3, f"table {lkey}: max |V(a,b)+V(b,a)-1| = {max_dev}"
    assert checked_tables > 0, "expected at least one symmetric (lambda=0.5) table"


def test_transition_matches_engine_exactly() -> None:
    """ki_after() must equal the live engine's ki computation for all inputs."""
    mismatches = 0
    for my_ki in range(KI_CAP + 1):
        for opp_ki in range(KI_CAP + 1):
            for me in Action:
                if ACTION_KI_COST[me] > my_ki:
                    continue
                for opp in Action:
                    if ACTION_KI_COST[opp] > opp_ki:
                        continue
                    engine_ki = resolve_turn(1, me, opp, my_ki, opp_ki).p1_ki_after
                    if ki_after(my_ki, me) != engine_ki:
                        mismatches += 1
    assert mismatches == 0, f"{mismatches} ki transitions drifted from the engine"


def test_sigma_lookup_is_clamped_and_affordable() -> None:
    """Out-of-range turns/ki are clamped; lookups stay affordable-only."""
    table.warmup()
    # turn beyond the limit is clamped into range, ki within bounds
    vec = table.get_sigma("0-0-0", my_ki=0, opp_ki=5, turn=999)
    assert abs(sum(vec) - 1.0) < 1e-3
    # at ki 0 only CHARGE/BLOCK (indices 0,1) may carry mass
    for idx, a in enumerate(ACTION_ORDER):
        if ACTION_KI_COST[a] > 0:
            assert vec[idx] < 1e-9
