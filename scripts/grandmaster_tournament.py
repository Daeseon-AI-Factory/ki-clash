#!/usr/bin/env python3
"""Grandmaster AI strength tournament.

Plays the GrandmasterAI (as player P2) against every other AI tier plus a set
of scripted reference bots, and prints win/loss/draw rates per matchup. This is
the objective, reproducible measure of how strong the Grandmaster tier is.

The existing tier AIs are hard-wired to play as P2 (they read ``p2_ki``), so to
field one as the P1 opponent we present it a *mirrored* view of the game state
in which the two players' ki, round scores, and action histories are swapped.

Usage:
    python3 scripts/grandmaster_tournament.py [N]      # N matches per matchup

Run from the repo root (so ``app`` is importable), e.g.:
    PYTHONPATH=. python3 scripts/grandmaster_tournament.py 400
"""

from __future__ import annotations

import random
import sys

from app.core.ai_opponent.easy import EasyAI
from app.core.ai_opponent.expert import ExpertAI
from app.core.ai_opponent.grandmaster import GrandmasterAI
from app.core.ai_opponent.hard import HardAI
from app.core.ai_opponent.medium import MediumAI
from app.core.ai_opponent.novice import NoviceAI
from app.core.game_engine.engine import GameEngine
from app.core.game_engine.types import (
    ACTION_KI_COST,
    Action,
    GameState,
    MatchStatus,
    MatchType,
    RoundState,
    RoundWinner,
    TurnOutcome,
    TurnResult,
)


def _mirror_state(st: GameState) -> GameState:
    """Return a P1<->P2 mirrored view so a P2-coded AI can act as P1."""
    cr = st.current_round
    assert cr is not None
    return GameState(
        game_id=st.game_id,
        match_type=st.match_type,
        status=st.status,
        rounds_won_p1=st.rounds_won_p2,
        rounds_won_p2=st.rounds_won_p1,
        current_round=RoundState(
            round_number=cr.round_number,
            p1_ki=cr.p2_ki,
            p2_ki=cr.p1_ki,
            turn_number=cr.turn_number,
            turn_history=[],
        ),
        round_results=st.round_results,
    )


_OUTCOME_SWAP = {
    TurnOutcome.P1_WINS_ROUND: TurnOutcome.P2_WINS_ROUND,
    TurnOutcome.P2_WINS_ROUND: TurnOutcome.P1_WINS_ROUND,
}


def _mirror_history(history: list[TurnResult]) -> list[TurnResult]:
    """Mirror a turn history (swap each turn's P1/P2 fields)."""
    out: list[TurnResult] = []
    for t in history:
        out.append(
            TurnResult(
                turn_number=t.turn_number,
                p1_action=t.p2_action,
                p2_action=t.p1_action,
                outcome=_OUTCOME_SWAP.get(t.outcome, t.outcome),
                p1_ki_before=t.p2_ki_before,
                p2_ki_before=t.p1_ki_before,
                p1_ki_after=t.p2_ki_after,
                p2_ki_after=t.p1_ki_after,
            )
        )
    return out


def _as_p1(ai) -> callable:  # type: ignore[type-arg]
    """Wrap a P2-coded AI so it plays correctly as P1 via the mirrored view."""

    def fn(st: GameState, history: list[TurnResult], rng: random.Random) -> Action:
        return ai.choose_action(_mirror_state(st), _mirror_history(history))

    return fn


def bot_always_charge(st: GameState, history, rng) -> Action:
    return Action.CHARGE


def bot_random(st: GameState, history, rng: random.Random) -> Action:
    ki = st.current_round.p1_ki  # type: ignore[union-attr]
    return rng.choice([a for a in Action if ACTION_KI_COST[a] <= ki])


def bot_greedy_attack(st: GameState, history, rng) -> Action:
    ki = st.current_round.p1_ki  # type: ignore[union-attr]
    if ki >= 3:
        return Action.ENERGY_WAVE
    if ki >= 1:
        return Action.ATTACK
    return Action.CHARGE


def play_match(p1_fn, gm: GrandmasterAI, engine: GameEngine, rng: random.Random) -> RoundWinner:
    """Play one best-of-3 match; return the winner (P2 == Grandmaster)."""
    st = engine.start_match(MatchType.PVP)
    for _ in range(70):  # safety bound on total turns
        if st.status != MatchStatus.IN_PROGRESS:
            break
        cr = st.current_round
        assert cr is not None
        history = cr.turn_history
        a1 = p1_fn(st, history, rng)
        a2 = gm.choose_action(st, history)
        st, _turn, _round, match_result = engine.submit_turn(st, a1, a2)
        if match_result is not None:
            return match_result.winner
    return RoundWinner.DRAW


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    engine = GameEngine()
    rng = random.Random(12345)
    gm = GrandmasterAI(seed=999)

    matchups = [
        ("always_charge", bot_always_charge),
        ("random", bot_random),
        ("greedy_attack", bot_greedy_attack),
        ("Novice", _as_p1(NoviceAI())),
        ("Easy", _as_p1(EasyAI())),
        ("Medium", _as_p1(MediumAI())),
        ("Hard", _as_p1(HardAI())),
        ("Expert", _as_p1(ExpertAI())),
        ("Grandmaster", _as_p1(GrandmasterAI(seed=7))),
    ]

    print(f"Grandmaster tournament — Grandmaster is P2 — N={n} matches/matchup")
    print(f"{'opponent (P1)':16s} {'GM win%':>8s} {'loss%':>8s} {'draw%':>8s}")
    print("-" * 44)
    for name, p1_fn in matchups:
        w = loss = draw = 0
        for _ in range(n):
            res = play_match(p1_fn, gm, engine, rng)
            if res == RoundWinner.P2:
                w += 1
            elif res == RoundWinner.P1:
                loss += 1
            else:
                draw += 1
        print(f"{name:16s} {100*w/n:7.1f}% {100*loss/n:7.1f}% {100*draw/n:7.1f}%")


if __name__ == "__main__":
    main()
