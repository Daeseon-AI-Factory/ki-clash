"""Tests for game engine: outcome matrix, turn resolution, engine lifecycle."""

import pytest

from app.core.game_engine.types import (
    Action,
    ACTION_KI_COST,
    GameState,
    KI_CAP,
    MatchStatus,
    MatchType,
    ROUNDS_TO_WIN,
    RoundWinner,
    TURN_LIMIT,
    TurnOutcome,
)
from app.core.game_engine.outcome_matrix import (
    calculate_ki_after,
    resolve_actions,
    resolve_turn,
    validate_action,
)
from app.core.game_engine.engine import GameEngine


# ──────────────────────────────────────────────
# Outcome Matrix Tests (all 25 combinations)
# ──────────────────────────────────────────────

class TestOutcomeMatrix:
    """Test every action pair in the 5x5 outcome matrix."""

    # Charge row
    def test_charge_vs_charge(self) -> None:
        assert resolve_actions(Action.CHARGE, Action.CHARGE) == TurnOutcome.NEUTRAL

    def test_charge_vs_block(self) -> None:
        assert resolve_actions(Action.CHARGE, Action.BLOCK) == TurnOutcome.NEUTRAL

    def test_charge_vs_attack(self) -> None:
        assert resolve_actions(Action.CHARGE, Action.ATTACK) == TurnOutcome.P2_WINS_ROUND

    def test_charge_vs_energy_wave(self) -> None:
        assert resolve_actions(Action.CHARGE, Action.ENERGY_WAVE) == TurnOutcome.P2_WINS_ROUND

    def test_charge_vs_teleport(self) -> None:
        assert resolve_actions(Action.CHARGE, Action.TELEPORT) == TurnOutcome.NEUTRAL

    # Block row
    def test_block_vs_charge(self) -> None:
        assert resolve_actions(Action.BLOCK, Action.CHARGE) == TurnOutcome.NEUTRAL

    def test_block_vs_block(self) -> None:
        assert resolve_actions(Action.BLOCK, Action.BLOCK) == TurnOutcome.NEUTRAL

    def test_block_vs_attack(self) -> None:
        assert resolve_actions(Action.BLOCK, Action.ATTACK) == TurnOutcome.BLOCKED

    def test_block_vs_energy_wave(self) -> None:
        assert resolve_actions(Action.BLOCK, Action.ENERGY_WAVE) == TurnOutcome.P2_WINS_ROUND

    def test_block_vs_teleport(self) -> None:
        assert resolve_actions(Action.BLOCK, Action.TELEPORT) == TurnOutcome.NEUTRAL

    # Attack row
    def test_attack_vs_charge(self) -> None:
        assert resolve_actions(Action.ATTACK, Action.CHARGE) == TurnOutcome.P1_WINS_ROUND

    def test_attack_vs_block(self) -> None:
        assert resolve_actions(Action.ATTACK, Action.BLOCK) == TurnOutcome.BLOCKED

    def test_attack_vs_attack(self) -> None:
        assert resolve_actions(Action.ATTACK, Action.ATTACK) == TurnOutcome.CLASH

    def test_attack_vs_energy_wave(self) -> None:
        assert resolve_actions(Action.ATTACK, Action.ENERGY_WAVE) == TurnOutcome.P2_WINS_ROUND

    def test_attack_vs_teleport(self) -> None:
        assert resolve_actions(Action.ATTACK, Action.TELEPORT) == TurnOutcome.DODGED

    # Energy Wave row
    def test_energy_wave_vs_charge(self) -> None:
        assert resolve_actions(Action.ENERGY_WAVE, Action.CHARGE) == TurnOutcome.P1_WINS_ROUND

    def test_energy_wave_vs_block(self) -> None:
        assert resolve_actions(Action.ENERGY_WAVE, Action.BLOCK) == TurnOutcome.P1_WINS_ROUND

    def test_energy_wave_vs_attack(self) -> None:
        assert resolve_actions(Action.ENERGY_WAVE, Action.ATTACK) == TurnOutcome.P1_WINS_ROUND

    def test_energy_wave_vs_energy_wave(self) -> None:
        assert resolve_actions(Action.ENERGY_WAVE, Action.ENERGY_WAVE) == TurnOutcome.CLASH

    def test_energy_wave_vs_teleport(self) -> None:
        assert resolve_actions(Action.ENERGY_WAVE, Action.TELEPORT) == TurnOutcome.DODGED

    # Teleport row
    def test_teleport_vs_charge(self) -> None:
        assert resolve_actions(Action.TELEPORT, Action.CHARGE) == TurnOutcome.NEUTRAL

    def test_teleport_vs_block(self) -> None:
        assert resolve_actions(Action.TELEPORT, Action.BLOCK) == TurnOutcome.NEUTRAL

    def test_teleport_vs_attack(self) -> None:
        assert resolve_actions(Action.TELEPORT, Action.ATTACK) == TurnOutcome.DODGED

    def test_teleport_vs_energy_wave(self) -> None:
        assert resolve_actions(Action.TELEPORT, Action.ENERGY_WAVE) == TurnOutcome.DODGED

    def test_teleport_vs_teleport(self) -> None:
        assert resolve_actions(Action.TELEPORT, Action.TELEPORT) == TurnOutcome.NEUTRAL


# ──────────────────────────────────────────────
# Action Validation Tests
# ──────────────────────────────────────────────

class TestValidateAction:
    def test_charge_always_affordable(self) -> None:
        assert validate_action(Action.CHARGE, 0) is True

    def test_block_always_affordable(self) -> None:
        assert validate_action(Action.BLOCK, 0) is True

    def test_attack_needs_1_ki(self) -> None:
        assert validate_action(Action.ATTACK, 0) is False
        assert validate_action(Action.ATTACK, 1) is True

    def test_energy_wave_needs_3_ki(self) -> None:
        assert validate_action(Action.ENERGY_WAVE, 2) is False
        assert validate_action(Action.ENERGY_WAVE, 3) is True

    def test_teleport_needs_1_ki(self) -> None:
        assert validate_action(Action.TELEPORT, 0) is False
        assert validate_action(Action.TELEPORT, 1) is True


# ──────────────────────────────────────────────
# Ki Calculation Tests
# ──────────────────────────────────────────────

class TestKiCalculation:
    def test_charge_gains_1_ki(self) -> None:
        result = resolve_turn(1, Action.CHARGE, Action.CHARGE, 0, 0)
        assert result.p1_ki_after == 1
        assert result.p2_ki_after == 1

    def test_attack_costs_1_ki(self) -> None:
        result = resolve_turn(1, Action.ATTACK, Action.CHARGE, 1, 0)
        assert result.p1_ki_after == 0

    def test_energy_wave_costs_3_ki(self) -> None:
        result = resolve_turn(1, Action.ENERGY_WAVE, Action.CHARGE, 3, 0)
        assert result.p1_ki_after == 0

    def test_teleport_costs_1_ki(self) -> None:
        result = resolve_turn(1, Action.TELEPORT, Action.CHARGE, 1, 0)
        assert result.p1_ki_after == 0

    def test_block_no_ki_change(self) -> None:
        result = resolve_turn(1, Action.BLOCK, Action.CHARGE, 5, 0)
        assert result.p1_ki_after == 5

    def test_ki_cap_enforced(self) -> None:
        result = resolve_turn(1, Action.CHARGE, Action.CHARGE, KI_CAP, KI_CAP)
        assert result.p1_ki_after == KI_CAP
        assert result.p2_ki_after == KI_CAP

    def test_ki_never_negative(self) -> None:
        # Attack costs 1, start with 1 → 0
        result = resolve_turn(1, Action.ATTACK, Action.BLOCK, 1, 0)
        assert result.p1_ki_after >= 0


# ──────────────────────────────────────────────
# GameEngine Lifecycle Tests
# ──────────────────────────────────────────────

class TestGameEngine:
    @pytest.fixture()
    def engine(self) -> GameEngine:
        return GameEngine()

    def test_start_match_initializes_state(self, engine: GameEngine) -> None:
        state = engine.start_match(MatchType.AI_EASY)
        assert state.status == MatchStatus.IN_PROGRESS
        assert state.match_type == MatchType.AI_EASY
        assert state.rounds_won_p1 == 0
        assert state.rounds_won_p2 == 0
        assert state.current_round is not None
        assert state.current_round.round_number == 1
        assert state.current_round.p1_ki == 0
        assert state.current_round.p2_ki == 0

    def test_submit_turn_updates_state(self, engine: GameEngine) -> None:
        state = engine.start_match(MatchType.PVP)
        state, turn_result, round_result, match_result = engine.submit_turn(
            state, Action.CHARGE, Action.CHARGE
        )
        assert turn_result.turn_number == 1
        assert turn_result.outcome == TurnOutcome.NEUTRAL
        assert state.current_round is not None
        assert state.current_round.p1_ki == 1
        assert state.current_round.p2_ki == 1
        assert round_result is None
        assert match_result is None

    def test_p1_wins_round_on_attack_vs_charge(self, engine: GameEngine) -> None:
        state = engine.start_match(MatchType.PVP)
        # Charge up
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        # P1 attacks charging P2
        state, turn_result, round_result, _ = engine.submit_turn(
            state, Action.ATTACK, Action.CHARGE
        )
        assert turn_result.outcome == TurnOutcome.P1_WINS_ROUND
        assert round_result is not None
        assert round_result.winner == RoundWinner.P1
        assert state.rounds_won_p1 == 1

    def test_full_match_p1_wins_2_0(self, engine: GameEngine) -> None:
        state = engine.start_match(MatchType.PVP)

        # Round 1: charge then attack
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, round_result, match_result = engine.submit_turn(
            state, Action.ATTACK, Action.CHARGE
        )
        assert round_result is not None
        assert round_result.winner == RoundWinner.P1
        assert match_result is None  # need 2 rounds

        # Round 2: charge then attack
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, round_result, match_result = engine.submit_turn(
            state, Action.ATTACK, Action.CHARGE
        )
        assert round_result is not None
        assert round_result.winner == RoundWinner.P1
        assert match_result is not None
        assert match_result.winner == RoundWinner.P1
        assert state.status == MatchStatus.COMPLETED

    def test_invalid_action_raises(self, engine: GameEngine) -> None:
        state = engine.start_match(MatchType.PVP)
        with pytest.raises(ValueError, match="P1 cannot afford attack"):
            engine.submit_turn(state, Action.ATTACK, Action.CHARGE)

    def test_submit_on_completed_match_raises(self, engine: GameEngine) -> None:
        state = engine.start_match(MatchType.PVP)
        # Win 2 rounds quickly
        for _ in range(2):
            state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
            state, _, _, _ = engine.submit_turn(state, Action.ATTACK, Action.CHARGE)

        with pytest.raises(ValueError, match="not in progress"):
            engine.submit_turn(state, Action.CHARGE, Action.CHARGE)

    def test_turn_limit_ki_tiebreak(self, engine: GameEngine) -> None:
        """When turn limit reached, player with more ki wins the round."""
        state = engine.start_match(MatchType.PVP)

        # Play 19 turns of both charging (no combat)
        for _ in range(TURN_LIMIT - 1):
            state, _, round_result, _ = engine.submit_turn(
                state, Action.CHARGE, Action.CHARGE
            )
            assert round_result is None

        # P1 charges (ki goes up), P2 blocks (ki stays same)
        # After 19 turns of charging, both at ki cap (10).
        # On turn 20: P1 charges (stays 10), P2 blocks (stays 10) → draw
        state, _, round_result, _ = engine.submit_turn(
            state, Action.CHARGE, Action.BLOCK
        )
        assert round_result is not None
        assert round_result.total_turns == TURN_LIMIT
        # Both hit KI_CAP, so both are at 10 → draw
        assert round_result.winner == RoundWinner.DRAW

    def test_turn_limit_p1_wins_by_ki(self, engine: GameEngine) -> None:
        """P1 has more ki at turn limit → P1 wins round."""
        state = engine.start_match(MatchType.PVP)

        # Play 19 turns of both charging
        for _ in range(TURN_LIMIT - 1):
            state, _, _, _ = engine.submit_turn(
                state, Action.CHARGE, Action.CHARGE
            )

        # On turn 20: P1 charges, P2 uses teleport (costs 1 ki)
        # P1 ki: 10 (capped), P2 ki: 10 - 1 = 9
        state, _, round_result, _ = engine.submit_turn(
            state, Action.CHARGE, Action.TELEPORT
        )
        assert round_result is not None
        assert round_result.winner == RoundWinner.P1

    def test_forfeit_p1(self, engine: GameEngine) -> None:
        state = engine.start_match(MatchType.PVP)
        state, match_result = engine.forfeit(state, RoundWinner.P1)
        assert state.status == MatchStatus.ABANDONED
        assert match_result.winner == RoundWinner.P2

    def test_forfeit_p2(self, engine: GameEngine) -> None:
        state = engine.start_match(MatchType.PVP)
        state, match_result = engine.forfeit(state, RoundWinner.P2)
        assert state.status == MatchStatus.ABANDONED
        assert match_result.winner == RoundWinner.P1

    def test_new_round_resets_ki(self, engine: GameEngine) -> None:
        """After a round ends, ki resets to 0 for the next round."""
        state = engine.start_match(MatchType.PVP)
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, round_result, _ = engine.submit_turn(
            state, Action.ATTACK, Action.CHARGE
        )
        assert round_result is not None
        # New round should have ki=0
        assert state.current_round is not None
        assert state.current_round.p1_ki == 0
        assert state.current_round.p2_ki == 0
        assert state.current_round.round_number == 2

    def test_draw_match_after_3_rounds(self, engine: GameEngine) -> None:
        """1-1 with a draw round → match draw."""
        state = engine.start_match(MatchType.PVP)

        # Round 1: P1 wins
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, _, _ = engine.submit_turn(state, Action.ATTACK, Action.CHARGE)

        # Round 2: P2 wins
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.ATTACK)

        # Round 3: draw via turn limit (both charge to cap, then same ki)
        for _ in range(TURN_LIMIT):
            state, _, round_result, match_result = engine.submit_turn(
                state, Action.CHARGE, Action.CHARGE
            )
            if match_result is not None:
                break

        assert match_result is not None
        assert match_result.winner == RoundWinner.DRAW
        assert state.rounds_won_p1 == 1
        assert state.rounds_won_p2 == 1

    def test_energy_wave_pierces_block(self, engine: GameEngine) -> None:
        """Energy wave beats block → attacker wins round."""
        state = engine.start_match(MatchType.PVP)
        # Charge up P1 to 3 ki
        for _ in range(3):
            state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        # Energy wave vs block
        state, turn_result, round_result, _ = engine.submit_turn(
            state, Action.ENERGY_WAVE, Action.BLOCK
        )
        # Energy wave hits charging opponent? No — block. But energy wave pierces block.
        # Wait, P2 is blocking not charging. Energy Wave vs Block = P1 wins.
        assert turn_result.outcome == TurnOutcome.P1_WINS_ROUND
        assert round_result is not None
        assert round_result.winner == RoundWinner.P1

    def test_teleport_dodges_energy_wave(self, engine: GameEngine) -> None:
        """Teleport dodges energy wave → wasted ki for attacker."""
        state = engine.start_match(MatchType.PVP)
        # Charge both up
        for _ in range(3):
            state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        # Energy wave vs teleport
        state, turn_result, round_result, _ = engine.submit_turn(
            state, Action.ENERGY_WAVE, Action.TELEPORT
        )
        assert turn_result.outcome == TurnOutcome.DODGED
        assert round_result is None  # no winner
        assert turn_result.p1_ki_after == 0  # spent 3 ki
        assert turn_result.p2_ki_after == 2  # spent 1 ki

    def test_clash_both_lose_ki(self, engine: GameEngine) -> None:
        """Attack vs Attack → clash, both lose 1 ki."""
        state = engine.start_match(MatchType.PVP)
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, turn_result, round_result, _ = engine.submit_turn(
            state, Action.ATTACK, Action.ATTACK
        )
        assert turn_result.outcome == TurnOutcome.CLASH
        assert turn_result.p1_ki_after == 0
        assert turn_result.p2_ki_after == 0
        assert round_result is None


# ──────────────────────────────────────────────
# Phase 2.2 — Gap-filling tests for high-value scenarios
# missed by the original suite.
# ──────────────────────────────────────────────


class TestEnergyWaveClash:
    """Energy Wave vs Energy Wave: both pay 3 ki, no winner."""

    def test_energy_wave_clash_both_lose_3_ki(self) -> None:
        """Direct outcome_matrix call — Energy Wave clash drains both by 3."""
        result = resolve_turn(
            turn_number=1,
            p1_action=Action.ENERGY_WAVE,
            p2_action=Action.ENERGY_WAVE,
            p1_ki=3,
            p2_ki=3,
        )
        assert result.outcome == TurnOutcome.CLASH
        assert result.p1_ki_after == 0
        assert result.p2_ki_after == 0

    def test_energy_wave_clash_does_not_end_round(self) -> None:
        engine = GameEngine()
        state = engine.start_match(MatchType.PVP)
        # Charge both to 3 ki
        for _ in range(3):
            state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, turn_result, round_result, _ = engine.submit_turn(
            state, Action.ENERGY_WAVE, Action.ENERGY_WAVE
        )
        assert turn_result.outcome == TurnOutcome.CLASH
        assert round_result is None  # clash never ends a round
        assert state.current_round is not None
        assert state.current_round.p1_ki == 0
        assert state.current_round.p2_ki == 0


class TestMatchFinishedAt2_1:
    """The Bo3 path that goes the full 3 rounds (most common in real play)."""

    def test_p1_wins_2_1(self) -> None:
        """P1 wins round 1, P2 wins round 2, P1 wins round 3 → P1 takes match 2-1."""
        engine = GameEngine()
        state = engine.start_match(MatchType.PVP)

        # Round 1: P1 wins (charge + attack vs charge)
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, r1, _ = engine.submit_turn(state, Action.ATTACK, Action.CHARGE)
        assert r1 is not None and r1.winner == RoundWinner.P1

        # Round 2: P2 wins (mirror)
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, r2, _ = engine.submit_turn(state, Action.CHARGE, Action.ATTACK)
        assert r2 is not None and r2.winner == RoundWinner.P2

        # Round 3: P1 wins again
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, r3, match_result = engine.submit_turn(
            state, Action.ATTACK, Action.CHARGE
        )
        assert r3 is not None and r3.winner == RoundWinner.P1
        assert match_result is not None
        assert match_result.winner == RoundWinner.P1
        assert match_result.rounds_won_p1 == 2
        assert match_result.rounds_won_p2 == 1

    def test_p2_wins_2_1(self) -> None:
        """Mirror: P2 wins 2-1."""
        engine = GameEngine()
        state = engine.start_match(MatchType.PVP)

        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, r1, _ = engine.submit_turn(state, Action.CHARGE, Action.ATTACK)
        assert r1 is not None and r1.winner == RoundWinner.P2

        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, r2, _ = engine.submit_turn(state, Action.ATTACK, Action.CHARGE)
        assert r2 is not None and r2.winner == RoundWinner.P1

        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, r3, match_result = engine.submit_turn(
            state, Action.CHARGE, Action.ATTACK
        )
        assert r3 is not None and r3.winner == RoundWinner.P2
        assert match_result is not None
        assert match_result.winner == RoundWinner.P2
        assert match_result.rounds_won_p1 == 1
        assert match_result.rounds_won_p2 == 2


class TestTurnHistoryAccumulation:
    """Each round's RoundState should accumulate a complete TurnResult log."""

    def test_turn_history_records_every_turn(self) -> None:
        engine = GameEngine()
        state = engine.start_match(MatchType.PVP)

        for _ in range(3):
            state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)

        assert state.current_round is not None
        history = state.current_round.turn_history
        assert len(history) == 3
        for i, turn in enumerate(history, start=1):
            assert turn.turn_number == i
            assert turn.p1_action == Action.CHARGE
            assert turn.p2_action == Action.CHARGE

    def test_turn_history_resets_on_new_round(self) -> None:
        """When a round ends, the next round's history should start empty."""
        engine = GameEngine()
        state = engine.start_match(MatchType.PVP)

        # Round 1: 2 turns (charge then P1 attack wins)
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, round_result, _ = engine.submit_turn(
            state, Action.ATTACK, Action.CHARGE
        )
        assert round_result is not None

        # Round 2 should be fresh
        assert state.current_round is not None
        assert state.current_round.round_number == 2
        assert state.current_round.turn_history == []


class TestRoundResultsAccumulation:
    """GameState should keep a complete history of round_results."""

    def test_round_results_grow_per_round(self) -> None:
        engine = GameEngine()
        state = engine.start_match(MatchType.PVP)

        assert state.round_results == []

        # Win round 1
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, _, _ = engine.submit_turn(state, Action.ATTACK, Action.CHARGE)
        assert len(state.round_results) == 1
        assert state.round_results[0].winner == RoundWinner.P1

        # Win round 2 → match ends
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)
        state, _, _, match_result = engine.submit_turn(
            state, Action.ATTACK, Action.CHARGE
        )
        assert len(state.round_results) == 2
        assert match_result is not None
        assert len(match_result.round_results) == 2


class TestTurnResultKiBeforeAudit:
    """TurnResult should record p1_ki_before / p2_ki_before for audit / replay."""

    def test_ki_before_matches_pre_turn_state(self) -> None:
        engine = GameEngine()
        state = engine.start_match(MatchType.PVP)

        # First turn: both start at 0
        state, turn_result, _, _ = engine.submit_turn(
            state, Action.CHARGE, Action.CHARGE
        )
        assert turn_result.p1_ki_before == 0
        assert turn_result.p2_ki_before == 0
        assert turn_result.p1_ki_after == 1
        assert turn_result.p2_ki_after == 1

        # Second turn: both start at 1
        state, turn_result, _, _ = engine.submit_turn(
            state, Action.CHARGE, Action.CHARGE
        )
        assert turn_result.p1_ki_before == 1
        assert turn_result.p2_ki_before == 1
        assert turn_result.p1_ki_after == 2
        assert turn_result.p2_ki_after == 2

    def test_ki_before_records_actual_pre_cost_value(self) -> None:
        """When attack is used, ki_before should reflect the pre-cost ki."""
        engine = GameEngine()
        state = engine.start_match(MatchType.PVP)

        # Charge to ki=2 for P1
        for _ in range(2):
            state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)

        # P1 attacks (costs 1, lands on blocked) — but block doesn't end round
        state, turn_result, _, _ = engine.submit_turn(
            state, Action.ATTACK, Action.BLOCK
        )
        # p1_ki_before should be the pre-attack ki (2), after should be 1
        assert turn_result.p1_ki_before == 2
        assert turn_result.p1_ki_after == 1


class TestTimeoutDefaultAction:
    """DEFAULT_TIMEOUT_ACTION constant must remain CHARGE.

    This is what `PvPGameSession._turn_timeout()` falls back to when a
    player doesn't act in 5 seconds. Changing it without intent would
    silently alter PvP behavior.
    """

    def test_default_timeout_action_is_charge(self) -> None:
        from app.core.game_engine.types import DEFAULT_TIMEOUT_ACTION
        assert DEFAULT_TIMEOUT_ACTION == Action.CHARGE

    def test_default_timeout_action_is_always_affordable(self) -> None:
        """The fallback action must be free so timeouts never fail validation."""
        from app.core.game_engine.types import DEFAULT_TIMEOUT_ACTION
        assert ACTION_KI_COST[DEFAULT_TIMEOUT_ACTION] == 0


class TestGameIdUniqueness:
    """Each new match must get a fresh UUID."""

    def test_each_match_has_unique_game_id(self) -> None:
        engine = GameEngine()
        ids = {engine.start_match(MatchType.PVP).game_id for _ in range(20)}
        assert len(ids) == 20, "start_match should produce unique UUIDs"
