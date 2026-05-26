"""End-to-end PvP flow integration tests.

Runs one real match against the docker-compose stack and asserts invariants
on the captured event log. Positive tests should pass today; `xfail` tests
document the 4 bugs found during the 2026-05-26 simulator session (to be
fixed in Phase 3 PvP hardening).

Run with the stack up:
    docker compose up -d
    pytest tests/integration/ -v
"""

from __future__ import annotations

from collections import Counter

import pytest

from .conftest import MatchRecording


# ════════════════════════════════════════════════════════════════════════════
# Positive invariants — should pass on current Python backend
# ════════════════════════════════════════════════════════════════════════════


class TestMatchFlowBasics:
    """The PvP architecture works end-to-end despite known concurrency bugs."""

    def test_both_players_registered(self, match: MatchRecording) -> None:
        assert match.p1_id, "P1 should have a player_id"
        assert match.p2_id, "P2 should have a player_id"
        assert match.p1_id != match.p2_id, "Players must have distinct IDs"

    def test_matchmaking_paired_into_single_game(self, match: MatchRecording) -> None:
        """Both players' match_found events agree on game_id."""
        p1_match_found = match.for_player_of_type("P1", "match_found")
        p2_match_found = match.for_player_of_type("P2", "match_found")
        assert len(p1_match_found) == 1, "P1 should receive exactly one match_found"
        assert len(p2_match_found) == 1, "P2 should receive exactly one match_found"
        assert (
            p1_match_found[0].data["game_id"]
            == p2_match_found[0].data["game_id"]
            == match.game_id
        )

    def test_both_players_received_match_result(self, match: MatchRecording) -> None:
        p1_match_result = match.for_player_of_type("P1", "match_result")
        p2_match_result = match.for_player_of_type("P2", "match_result")
        assert len(p1_match_result) == 1, "P1 should receive exactly one match_result"
        assert len(p2_match_result) == 1, "P2 should receive exactly one match_result"

    def test_perspective_inversion_on_match_result(self, match: MatchRecording) -> None:
        """If P1 says 'you won', P2 must say 'opponent won', and vice versa."""
        p1_result = match.for_player_of_type("P1", "match_result")[0].data
        p2_result = match.for_player_of_type("P2", "match_result")[0].data

        # Winner labels should be inverted (or both "draw")
        if p1_result["winner"] == "you":
            assert p2_result["winner"] == "opponent"
        elif p1_result["winner"] == "opponent":
            assert p2_result["winner"] == "you"
        else:
            assert p1_result["winner"] == p2_result["winner"] == "draw"

        # Round counts should be consistent across players
        assert p1_result["rounds_won_p1"] == p2_result["rounds_won_p1"]
        assert p1_result["rounds_won_p2"] == p2_result["rounds_won_p2"]
        assert p1_result["total_turns"] == p2_result["total_turns"]

    def test_match_terminated_under_bo3_rules(self, match: MatchRecording) -> None:
        """Winner must have 2 round wins; loser must have ≤1."""
        result = match.for_player_of_type("P1", "match_result")[0].data
        rw1, rw2 = result["rounds_won_p1"], result["rounds_won_p2"]
        assert max(rw1, rw2) == 2, "Bo3 winner must have exactly 2 round wins"
        assert min(rw1, rw2) <= 1, "Loser must have ≤1 round win"


# ════════════════════════════════════════════════════════════════════════════
# Known-bug invariants — currently xfail, will pass after Phase 3
# ════════════════════════════════════════════════════════════════════════════


class TestKnownBugs:
    """Each test captures one bug discovered by the simulator on 2026-05-26.

    These are xfail today and become real passes when Phase 3 fixes them —
    at which point remove the marker. The strict=False option allows them
    to occasionally pass without breaking the suite (concurrency timing).
    """

    @pytest.mark.xfail(
        reason="Bug 1: opponent_reconnected fires on first connect "
        "(ws.py:158-162 lacks first-connect vs reconnect distinction). "
        "Fix scheduled for Phase 3.",
        strict=False,
    )
    def test_no_spurious_opponent_reconnected_on_first_connect(
        self, match: MatchRecording
    ) -> None:
        """No player should receive opponent_reconnected when no disconnect happened."""
        spurious = match.of_type("opponent_reconnected")
        assert len(spurious) == 0, (
            f"Got {len(spurious)} opponent_reconnected events but no player "
            f"disconnected during this match."
        )

    @pytest.mark.xfail(
        reason="Bug 2: waiting_for_action fires twice per turn because "
        "session.start() is called from two paths in ws.py (lines 151 & 171). "
        "Fix scheduled for Phase 3 — add idempotency guard.",
        strict=False,
    )
    def test_waiting_for_action_exactly_once_per_turn_per_player(
        self, match: MatchRecording
    ) -> None:
        """Each (player, round, turn) combo should appear in waiting_for_action exactly once."""
        for player in ("P1", "P2"):
            keys = []
            for event in match.for_player_of_type(player, "waiting_for_action"):
                keys.append((event.data["round_number"], event.data["turn"]))
            duplicates = [k for k, c in Counter(keys).items() if c > 1]
            assert not duplicates, (
                f"{player} received waiting_for_action multiple times for "
                f"these (round, turn) combos: {duplicates}"
            )

    @pytest.mark.xfail(
        reason="Bug 3: action_confirmed and turn_result can arrive out of order "
        "because broadcasts cross between two players' sockets with awaits in "
        "between. Fix scheduled for Phase 3 — single atomic broadcast.",
        strict=False,
    )
    def test_action_confirmed_arrives_before_subsequent_turn_result(
        self, match: MatchRecording
    ) -> None:
        """After each submit_action, the action_confirmed for it should arrive
        before the turn_result that supersedes it."""
        for player in ("P1", "P2"):
            events = match.for_player(player)
            submit_indices = [
                i for i, e in enumerate(events)
                if e.direction == "send" and e.type == "submit_action"
            ]
            for idx in submit_indices:
                # Find the next action_confirmed and the next turn_result
                next_confirmed_idx = next(
                    (i for i in range(idx + 1, len(events))
                     if events[i].type == "action_confirmed"),
                    None,
                )
                next_result_idx = next(
                    (i for i in range(idx + 1, len(events))
                     if events[i].type == "turn_result"),
                    None,
                )
                if next_confirmed_idx is None or next_result_idx is None:
                    continue
                assert next_confirmed_idx < next_result_idx, (
                    f"{player} received turn_result before action_confirmed "
                    f"at events[{idx}]"
                )

    def test_turn_result_carries_turn_sequence_number(
        self, match: MatchRecording
    ) -> None:
        """turn_result events must include turn_number so clients can
        correlate them with their submissions and ignore stale ones.

        NOTE: this was originally suspected to be a bug (Bug 4 from the
        2026-05-26 simulator session). Closer reading of `app/schemas/ws.py`
        showed turn_result *does* include turn_number — so this is a
        positive regression test, not an xfail. The related concern
        (action_confirmed lacks turn_number) is tracked separately below.
        """
        for player in ("P1", "P2"):
            results = match.for_player_of_type(player, "turn_result")
            turn_numbers = [r.data.get("turn_number") for r in results]
            assert all(t is not None for t in turn_numbers), (
                f"{player}: not all turn_results have turn_number "
                f"(got: {turn_numbers})"
            )

    @pytest.mark.xfail(
        reason="Bug 4 (revised): action_confirmed lacks a turn_number, so "
        "if it arrives out of order with turn_result the client can't tell "
        "which turn it belongs to. Fix scheduled for Phase 3 — add "
        "turn_number to action_confirmed schema in app/schemas/ws.py.",
        strict=False,
    )
    def test_action_confirmed_carries_turn_number(
        self, match: MatchRecording
    ) -> None:
        """action_confirmed should include turn_number to disambiguate
        late arrivals from current-turn confirmations."""
        for player in ("P1", "P2"):
            confirmeds = match.for_player_of_type(player, "action_confirmed")
            for c in confirmeds:
                assert "turn_number" in c.data, (
                    f"{player}: action_confirmed missing turn_number "
                    f"(payload: {c.data})"
                )
