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
# Regression tests — these document the 4 bugs discovered on 2026-05-26
# and FIXED in Phase 3. They were `xfail` until the fixes landed; they are
# now plain assertions so any regression turns the suite red.
# ════════════════════════════════════════════════════════════════════════════


class TestPhase3Regressions:
    """Each test corresponds to a bug from the 2026-05-26 simulator session.
    Phase 3 fixed all four; these tests now guard against regression."""

    def test_no_spurious_opponent_reconnected_on_first_connect(
        self, match: MatchRecording
    ) -> None:
        """Phase 3 Bug 1 — `opponent_reconnected` must NOT fire when the
        opponent first connects to the game WS (only on actual reconnect
        after disconnect)."""
        spurious = match.of_type("opponent_reconnected")
        assert len(spurious) == 0, (
            f"Got {len(spurious)} opponent_reconnected events but no player "
            f"disconnected during this match. "
            f"Regression of Phase 3 Bug 1 — check PvPGameSession.handle_connect()."
        )

    def test_waiting_for_action_exactly_once_per_turn_per_player(
        self, match: MatchRecording
    ) -> None:
        """Phase 3 Bug 2 — each (round, turn) combo must trigger exactly one
        `waiting_for_action` per player. Duplicates indicate `session.start()`
        is being called more than once (lost idempotency)."""
        for player in ("P1", "P2"):
            keys = []
            for event in match.for_player_of_type(player, "waiting_for_action"):
                keys.append((event.data["round_number"], event.data["turn"]))
            duplicates = [k for k, c in Counter(keys).items() if c > 1]
            assert not duplicates, (
                f"{player} received waiting_for_action multiple times for "
                f"these (round, turn) combos: {duplicates}. "
                f"Regression of Phase 3 Bug 2 — check session.start() idempotency."
            )

    def test_action_confirmed_arrives_before_subsequent_turn_result(
        self, match: MatchRecording
    ) -> None:
        """Phase 3 Bug 3 — for each submit_action, the corresponding
        action_confirmed should arrive before the next turn_result. Out-of-
        order delivery confuses client-side turn correlation."""
        for player in ("P1", "P2"):
            events = match.for_player(player)
            submit_indices = [
                i for i, e in enumerate(events)
                if e.direction == "send" and e.type == "submit_action"
            ]
            for idx in submit_indices:
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
                    f"at events[{idx}]. Regression of Phase 3 Bug 3."
                )

    def test_turn_result_carries_turn_sequence_number(
        self, match: MatchRecording
    ) -> None:
        """`turn_result` must include turn_number so clients can correlate
        with their submissions and ignore stale messages."""
        for player in ("P1", "P2"):
            results = match.for_player_of_type(player, "turn_result")
            turn_numbers = [r.data.get("turn_number") for r in results]
            assert all(t is not None for t in turn_numbers), (
                f"{player}: not all turn_results have turn_number "
                f"(got: {turn_numbers})"
            )

    def test_action_confirmed_carries_turn_number(
        self, match: MatchRecording
    ) -> None:
        """Phase 3 Bug 4 — `action_confirmed` must include turn_number so
        clients can correlate the confirmation with the specific
        submission it answers."""
        for player in ("P1", "P2"):
            confirmeds = match.for_player_of_type(player, "action_confirmed")
            for c in confirmeds:
                assert "turn_number" in c.data, (
                    f"{player}: action_confirmed missing turn_number "
                    f"(payload: {c.data}). "
                    f"Regression of Phase 3 Bug 4 — check ws_msg.action_confirmed()."
                )
