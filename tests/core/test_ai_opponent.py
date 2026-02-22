"""Tests for AI opponents: Easy, Medium, Hard."""

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
from app.core.ai_opponent.easy import EasyAI
from app.core.ai_opponent.medium import MediumAI
from app.core.ai_opponent.hard import HardAI
from app.core.game_engine.types import Difficulty


class TestCreateAIOpponent:
    def test_creates_easy(self) -> None:
        ai = create_ai_opponent(Difficulty.EASY)
        assert isinstance(ai, EasyAI)

    def test_creates_medium(self) -> None:
        ai = create_ai_opponent(Difficulty.MEDIUM)
        assert isinstance(ai, MediumAI)

    def test_creates_hard(self) -> None:
        ai = create_ai_opponent(Difficulty.HARD)
        assert isinstance(ai, HardAI)


def _make_game_state(p2_ki: int = 0) -> GameState:
    """Helper to create a game state with specific P2 ki."""
    state = GameState(
        match_type=MatchType.AI_EASY,
        status=MatchStatus.IN_PROGRESS,
        current_round=RoundState(round_number=1, p1_ki=0, p2_ki=p2_ki),
    )
    return state


def _make_history(p1_actions: list[Action]) -> list[TurnResult]:
    """Helper to create a turn history with given P1 actions."""
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


class TestEasyAI:
    def test_always_returns_affordable_action(self) -> None:
        ai = EasyAI()
        # With 0 ki, should only return Charge or Block
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
        """Easy AI should charge more often than other actions."""
        ai = EasyAI()
        state = _make_game_state(p2_ki=5)
        actions = [ai.choose_action(state, []) for _ in range(200)]
        charge_count = actions.count(Action.CHARGE)
        # Charge has 0.45 weight, so should be at least 25% of the time
        assert charge_count > 50


class TestMediumAI:
    def test_counters_charge_with_attack(self) -> None:
        """If opponent keeps charging, medium AI should attack."""
        ai = MediumAI()
        state = _make_game_state(p2_ki=3)
        history = _make_history([Action.CHARGE, Action.CHARGE, Action.CHARGE])
        # Should counter charge with attack
        action = ai.choose_action(state, history)
        assert action == Action.ATTACK

    def test_counters_attack_with_block(self) -> None:
        """If opponent keeps attacking, medium AI should block."""
        ai = MediumAI()
        state = _make_game_state(p2_ki=3)
        history = _make_history([Action.ATTACK, Action.ATTACK, Action.ATTACK])
        action = ai.choose_action(state, history)
        assert action == Action.BLOCK

    def test_counters_energy_wave_with_teleport(self) -> None:
        """If opponent keeps using energy wave, medium AI should teleport."""
        ai = MediumAI()
        state = _make_game_state(p2_ki=3)
        history = _make_history([
            Action.ENERGY_WAVE, Action.ENERGY_WAVE, Action.ENERGY_WAVE,
        ])
        action = ai.choose_action(state, history)
        assert action == Action.TELEPORT

    def test_falls_back_when_cant_afford_counter(self) -> None:
        """If AI can't afford the counter, pick a fallback."""
        ai = MediumAI()
        state = _make_game_state(p2_ki=0)
        history = _make_history([Action.CHARGE, Action.CHARGE, Action.CHARGE])
        # Counter for Charge is Attack (costs 1 ki), but AI has 0 ki
        action = ai.choose_action(state, history)
        # Should fall back to Charge (always free)
        assert action == Action.CHARGE

    def test_random_on_no_history(self) -> None:
        """With no history, medium AI picks randomly."""
        ai = MediumAI()
        state = _make_game_state(p2_ki=5)
        actions = {ai.choose_action(state, []) for _ in range(100)}
        # Should pick at least 2 different actions over 100 tries
        assert len(actions) >= 2


class TestHardAI:
    def test_always_returns_affordable_action(self) -> None:
        ai = HardAI()
        state = _make_game_state(p2_ki=0)
        for _ in range(50):
            action = ai.choose_action(state, [])
            assert ACTION_KI_COST[action] <= 0

    def test_uses_mixed_strategy(self) -> None:
        """Hard AI should use multiple different actions (not deterministic)."""
        ai = HardAI()
        state = _make_game_state(p2_ki=5)
        actions = {ai.choose_action(state, []) for _ in range(200)}
        # Nash equilibrium means mixing — should use at least 3 actions
        assert len(actions) >= 3

    def test_adapts_to_charge_heavy_opponent(self) -> None:
        """If opponent charges a lot, hard AI should attack more."""
        ai = HardAI()
        state = _make_game_state(p2_ki=5)
        history = _make_history([Action.CHARGE] * 10)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        attack_count = actions.count(Action.ATTACK)
        energy_wave_count = actions.count(Action.ENERGY_WAVE)
        # Should punish charging with attacks
        assert (attack_count + energy_wave_count) > 60

    def test_adapts_to_attack_heavy_opponent(self) -> None:
        """If opponent attacks a lot, hard AI should block/teleport more."""
        ai = HardAI()
        state = _make_game_state(p2_ki=5)
        history = _make_history([Action.ATTACK] * 10)
        actions = [ai.choose_action(state, history) for _ in range(200)]
        block_count = actions.count(Action.BLOCK)
        teleport_count = actions.count(Action.TELEPORT)
        assert (block_count + teleport_count) > 60


class TestAIFullMatch:
    """Integration test: AI can play a full best-of-3 match."""

    @pytest.mark.parametrize("difficulty", [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD])
    def test_ai_plays_full_match(self, difficulty: Difficulty) -> None:
        engine = GameEngine()
        ai = create_ai_opponent(difficulty)
        match_type = {
            Difficulty.EASY: MatchType.AI_EASY,
            Difficulty.MEDIUM: MatchType.AI_MEDIUM,
            Difficulty.HARD: MatchType.AI_HARD,
        }[difficulty]

        state = engine.start_match(match_type)
        max_total_turns = TURN_LIMIT * 3 + 10  # safety limit

        for _ in range(max_total_turns):
            if state.status != MatchStatus.IN_PROGRESS:
                break

            assert state.current_round is not None
            history = state.current_round.turn_history

            ai_action = ai.choose_action(state, history)

            # P1 always charges (simple strategy for test)
            p1_ki = state.current_round.p1_ki
            p1_action = Action.CHARGE

            state, _, _, match_result = engine.submit_turn(
                state, p1_action, ai_action
            )

            if match_result is not None:
                break

        # Match should have ended
        assert state.status == MatchStatus.COMPLETED
