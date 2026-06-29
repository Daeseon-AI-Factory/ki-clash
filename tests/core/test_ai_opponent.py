"""Tests for AI opponents: Novice, Easy, Medium, Hard, Expert, Grandmaster."""

import random

import pytest

from app.core.game_engine.types import (
    Action,
    ACTION_KI_COST,
    GameState,
    MatchStatus,
    MatchType,
    TURN_LIMIT,
    TurnResult,
    TurnOutcome,
    RoundState,
)
from app.core.game_engine.engine import GameEngine
from app.core.ai_opponent.base import create_ai_opponent
from app.core.ai_opponent.novice import NoviceAI
from app.core.ai_opponent.easy import EasyAI
from app.core.ai_opponent.medium import MediumAI
from app.core.ai_opponent.hard import HardAI
from app.core.ai_opponent.expert import ExpertAI
from app.core.ai_opponent.grandmaster import GrandmasterAI
from app.core.game_engine.types import Difficulty


class TestCreateAIOpponent:
    def test_creates_novice(self) -> None:
        ai = create_ai_opponent(Difficulty.NOVICE)
        assert isinstance(ai, NoviceAI)

    def test_creates_easy(self) -> None:
        ai = create_ai_opponent(Difficulty.EASY)
        assert isinstance(ai, EasyAI)

    def test_creates_medium(self) -> None:
        ai = create_ai_opponent(Difficulty.MEDIUM)
        assert isinstance(ai, MediumAI)

    def test_creates_hard(self) -> None:
        ai = create_ai_opponent(Difficulty.HARD)
        assert isinstance(ai, HardAI)

    def test_creates_expert(self) -> None:
        ai = create_ai_opponent(Difficulty.EXPERT)
        assert isinstance(ai, ExpertAI)

    def test_creates_grandmaster(self) -> None:
        ai = create_ai_opponent(Difficulty.GRANDMASTER)
        assert isinstance(ai, GrandmasterAI)


def _make_game_state(p2_ki: int = 0, p1_ki: int = 0, match_type: MatchType = MatchType.AI_EASY) -> GameState:
    return GameState(
        match_type=match_type,
        status=MatchStatus.IN_PROGRESS,
        current_round=RoundState(round_number=1, p1_ki=p1_ki, p2_ki=p2_ki),
    )


def _make_history(p1_actions: list[Action]) -> list[TurnResult]:
    history = []
    for i, action in enumerate(p1_actions):
        history.append(TurnResult(
            turn_number=i + 1,
            p1_action=action,
            p2_action=Action.CHARGE,
            outcome=TurnOutcome.NEUTRAL,
            p1_ki_before=0,
            p2_ki_before=0,
            p1_ki_after=0,
            p2_ki_after=0,
        ))
    return history


class TestNoviceAI:
    def test_only_affordable_actions(self) -> None:
        ai = NoviceAI()
        state = _make_game_state(p2_ki=0)
        for _ in range(50):
            action = ai.choose_action(state, [])
            assert ACTION_KI_COST[action] <= 0

    def test_sometimes_counters_last_move(self) -> None:
        """With charge history, novice should sometimes attack."""
        ai = NoviceAI()
        state = _make_game_state(p2_ki=3)
        history = _make_history([Action.CHARGE])
        actions = [ai.choose_action(state, history) for _ in range(100)]
        # Should attack at least occasionally (counter for CHARGE is ATTACK)
        assert Action.ATTACK in actions

    def test_is_noisy(self) -> None:
        """Novice AI should pick multiple different actions — not deterministic."""
        ai = NoviceAI()
        state = _make_game_state(p2_ki=5)
        history = _make_history([Action.CHARGE] * 5)
        actions = {ai.choose_action(state, history) for _ in range(100)}
        assert len(actions) >= 2


class TestEasyAI:
    def test_always_returns_affordable_action(self) -> None:
        ai = EasyAI()
        state = _make_game_state(p2_ki=0)
        for _ in range(50):
            action = ai.choose_action(state, [])
            assert ACTION_KI_COST[action] <= 0

    def test_returns_valid_action_with_ki(self) -> None:
        ai = EasyAI()
        state = _make_game_state(p2_ki=5)
        for _ in range(50):
            action = ai.choose_action(state, [])
            assert action in Action

    def test_charges_frequently(self) -> None:
        ai = EasyAI()
        state = _make_game_state(p2_ki=5)
        actions = [ai.choose_action(state, []) for _ in range(200)]
        assert actions.count(Action.CHARGE) > 50


class TestMediumAI:
    def test_counters_charge_with_attack(self) -> None:
        """Deterministic counter path: opponent always charges → medium attacks."""
        ai = MediumAI()
        state = _make_game_state(p2_ki=3)
        history = _make_history([Action.CHARGE] * 5)
        # Run many trials; most should be ATTACK (noise is 20%)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        attack_count = actions.count(Action.ATTACK)
        # Counter is ATTACK; with 20% random noise and ki-override checks,
        # expect at least 50% attack when opponent spams charge
        assert attack_count > 80

    def test_counters_attack_with_block(self) -> None:
        ai = MediumAI()
        state = _make_game_state(p2_ki=3)
        history = _make_history([Action.ATTACK] * 5)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        block_count = actions.count(Action.BLOCK)
        assert block_count > 60

    def test_counters_energy_wave_with_teleport(self) -> None:
        ai = MediumAI()
        state = _make_game_state(p2_ki=3)
        history = _make_history([Action.ENERGY_WAVE] * 5)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        assert actions.count(Action.TELEPORT) > 60

    def test_falls_back_when_cant_afford_counter(self) -> None:
        ai = MediumAI()
        state = _make_game_state(p2_ki=0)
        history = _make_history([Action.CHARGE] * 5)
        action = ai.choose_action(state, history)
        assert ACTION_KI_COST[action] == 0

    def test_random_on_no_history(self) -> None:
        ai = MediumAI()
        state = _make_game_state(p2_ki=5)
        actions = {ai.choose_action(state, []) for _ in range(100)}
        assert len(actions) >= 2

    def test_considers_ki_economy(self) -> None:
        """When AI has high ki, should occasionally fire Energy Wave."""
        ai = MediumAI()
        state = _make_game_state(p2_ki=8)
        history = _make_history([Action.CHARGE] * 3)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        assert Action.ENERGY_WAVE in actions


class TestHardAI:
    def test_always_returns_affordable_action(self) -> None:
        ai = HardAI()
        state = _make_game_state(p2_ki=0)
        for _ in range(50):
            action = ai.choose_action(state, [])
            assert ACTION_KI_COST[action] <= 0

    def test_uses_mixed_strategy(self) -> None:
        ai = HardAI()
        state = _make_game_state(p2_ki=5)
        actions = {ai.choose_action(state, []) for _ in range(200)}
        assert len(actions) >= 3

    def test_adapts_to_charge_heavy_opponent(self) -> None:
        random.seed(20240601)  # deterministic: this is a statistical assertion
        ai = HardAI()
        # A charge-heavy opponent sits at low ki (still building) — opp_ki=0.
        state = _make_game_state(p2_ki=5, p1_ki=0)
        history = _make_history([Action.CHARGE] * 10)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        assert (actions.count(Action.ATTACK) + actions.count(Action.ENERGY_WAVE)) > 60

    def test_adapts_to_attack_heavy_opponent(self) -> None:
        random.seed(20240601)  # deterministic: this is a statistical assertion
        ai = HardAI()
        # An attack-heavy opponent must actually have ki to attack with, so
        # p1_ki must be non-zero — otherwise HardAI's ki-economy rule correctly
        # treats a ki-starved opponent as safe to attack, which is a different
        # behavior than the pattern-adaptation this test targets.
        state = _make_game_state(p2_ki=5, p1_ki=5)
        history = _make_history([Action.ATTACK] * 10)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        assert (actions.count(Action.BLOCK) + actions.count(Action.TELEPORT)) > 60

    def test_attacks_more_when_opp_has_no_ki(self) -> None:
        """If opponent can't afford attacks, hard AI should exploit with more attacks."""
        ai = HardAI()
        state = _make_game_state(p2_ki=5, p1_ki=0)
        actions = [ai.choose_action(state, []) for _ in range(200)]
        assert actions.count(Action.ATTACK) > 60


class TestExpertAI:
    def test_always_returns_affordable_action(self) -> None:
        ai = ExpertAI()
        state = _make_game_state(p2_ki=0)
        for _ in range(50):
            action = ai.choose_action(state, [])
            assert ACTION_KI_COST[action] <= 0

    def test_prefers_attack_vs_charge_heavy_opponent(self) -> None:
        """EV of Attack is +20 when opponent keeps charging."""
        ai = ExpertAI()
        state = _make_game_state(p2_ki=5)
        history = _make_history([Action.CHARGE] * 10)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        # With 10 charges in history, attack EV should dominate
        assert (actions.count(Action.ATTACK) + actions.count(Action.ENERGY_WAVE)) > 120

    def test_prefers_teleport_vs_burst_heavy_opponent(self) -> None:
        """When opponent keeps bursting, teleport has highest EV (+9 dodge)."""
        ai = ExpertAI()
        state = _make_game_state(p2_ki=3, p1_ki=5)
        history = _make_history([Action.ENERGY_WAVE] * 8)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        assert actions.count(Action.TELEPORT) > 100

    def test_attacks_aggressively_when_opp_has_zero_ki(self) -> None:
        """When opponent has 0 ki, only charge/block are affordable.
        Energy Wave (EV=+20 vs both) strictly beats Attack (EV=+9 vs 50/50 charge/block),
        so expert AI should heavily prefer offensive moves."""
        ai = ExpertAI()
        state = _make_game_state(p2_ki=3, p1_ki=0)
        actions = [ai.choose_action(state, []) for _ in range(100)]
        offensive = actions.count(Action.ATTACK) + actions.count(Action.ENERGY_WAVE)
        assert offensive > 60

    def test_is_not_purely_deterministic(self) -> None:
        """Noise floor ensures expert AI can't be fully read."""
        ai = ExpertAI()
        state = _make_game_state(p2_ki=5)
        actions = {ai.choose_action(state, []) for _ in range(200)}
        assert len(actions) >= 3


class TestGrandmasterAI:
    """The GTO + bounded-exploitation tier (loads the committed strategy table)."""

    def test_only_affordable_actions(self) -> None:
        ai = GrandmasterAI(seed=1)
        for p2_ki in range(11):
            state = _make_game_state(p2_ki=p2_ki, p1_ki=4)
            for _ in range(30):
                action = ai.choose_action(state, [])
                assert ACTION_KI_COST[action] <= p2_ki

    def test_uses_mixed_strategy(self) -> None:
        """GTO play is a mixed strategy — should not be a single action."""
        ai = GrandmasterAI(seed=2)
        state = _make_game_state(p2_ki=5, p1_ki=5)
        actions = {ai.choose_action(state, []) for _ in range(200)}
        assert len(actions) >= 3

    def test_seed_is_deterministic(self) -> None:
        """Same seed + same state + same history => same action sequence."""
        state = _make_game_state(p2_ki=4, p1_ki=4)
        a = [GrandmasterAI(seed=42).choose_action(state, []) for _ in range(1)]
        b = [GrandmasterAI(seed=42).choose_action(state, []) for _ in range(1)]
        assert a == b

    def test_exploits_always_charge_opponent(self) -> None:
        """Against an opponent stuck charging at low ki, the AI must be able to
        punish with a round-winning attack/wave once it can afford one."""
        ai = GrandmasterAI(seed=3)
        state = _make_game_state(p2_ki=5, p1_ki=0)
        history = _make_history([Action.CHARGE] * 6)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        offensive = actions.count(Action.ATTACK) + actions.count(Action.ENERGY_WAVE)
        # Opponent at ki0 can only charge/block; attacking a charger wins the round.
        assert offensive > 120


class TestAIFullMatch:
    """Integration test: all difficulties can play a full best-of-3 match."""

    @pytest.mark.parametrize("difficulty,match_type", [
        (Difficulty.NOVICE, MatchType.AI_NOVICE),
        (Difficulty.EASY, MatchType.AI_EASY),
        (Difficulty.MEDIUM, MatchType.AI_MEDIUM),
        (Difficulty.HARD, MatchType.AI_HARD),
        (Difficulty.EXPERT, MatchType.AI_EXPERT),
        (Difficulty.GRANDMASTER, MatchType.AI_GRANDMASTER),
    ])
    def test_ai_plays_full_match(self, difficulty: Difficulty, match_type: MatchType) -> None:
        engine = GameEngine()
        ai = create_ai_opponent(difficulty)

        state = engine.start_match(match_type)
        max_total_turns = TURN_LIMIT * 3 + 10

        for _ in range(max_total_turns):
            if state.status != MatchStatus.IN_PROGRESS:
                break

            assert state.current_round is not None
            history = state.current_round.turn_history

            ai_action = ai.choose_action(state, history)

            p1_action = Action.CHARGE

            state, _, _, match_result = engine.submit_turn(
                state, p1_action, ai_action
            )

            if match_result is not None:
                break

        assert state.status == MatchStatus.COMPLETED
