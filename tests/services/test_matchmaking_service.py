"""Unit tests for the matchmaking service.

Uses real Redis (assumes `docker compose up -d` is running) but flushes the
matchmaking queue before each test for isolation. WSManager is replaced
with a minimal FakeWSManager that records sent messages so we can assert
on notification behavior without spinning up real WebSocket connections.

Auto-skips if Redis isn't reachable on localhost:6379.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
import redis.asyncio as aioredis

from app.core.game_store import GameStore, _key as game_key
from app.services.matchmaking_service import (
    MATCHMAKING_TIMEOUT_S,
    MatchmakingService,
)

TEST_QUEUE_KEY = "ki_clash:test:matchmaking:queue"


# ────────────────────────────────────────────────────────────────────────────
# Redis availability — auto-skip if not running
# ────────────────────────────────────────────────────────────────────────────


async def _redis_reachable() -> bool:
    try:
        client = aioredis.from_url(
            "redis://localhost:6379/0", socket_connect_timeout=1.5
        )
        await client.ping()
        await client.aclose()
        return True
    except Exception:
        return False


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _require_redis() -> None:
    if not await _redis_reachable():
        pytest.skip(
            "Redis not reachable on localhost:6379. Run `docker compose up -d`.",
            allow_module_level=True,
        )


# ────────────────────────────────────────────────────────────────────────────
# Fake WSManager — records sends, no real sockets
# ────────────────────────────────────────────────────────────────────────────


class FakeWSManager:
    """Minimal WSManager substitute that records every send_to_player call."""

    def __init__(self) -> None:
        self.sent: list[tuple[UUID, dict[str, Any]]] = []

    async def send_to_player(self, player_id: UUID, message: dict) -> bool:
        self.sent.append((player_id, message))
        return True

    def messages_for(self, player_id: UUID) -> list[dict]:
        return [msg for pid, msg in self.sent if pid == player_id]

    def messages_of_type(self, msg_type: str) -> list[tuple[UUID, dict]]:
        return [(pid, msg) for pid, msg in self.sent if msg.get("type") == msg_type]


# ────────────────────────────────────────────────────────────────────────────
# Per-test fixtures
# ────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def redis_client() -> aioredis.Redis:
    """Fresh Redis client. Flushes the matchmaking queue + any game keys
    created during the test (using SCAN since we don't know game_ids
    upfront)."""
    client = aioredis.from_url("redis://localhost:6379/0", decode_responses=False)
    await client.delete(TEST_QUEUE_KEY)
    yield client
    await client.delete(TEST_QUEUE_KEY)
    # Best-effort cleanup of any game keys this test created
    async for key in client.scan_iter(match="ki_clash:game:*", count=100):
        await client.delete(key)
    await client.aclose()


@pytest_asyncio.fixture
async def ws_manager() -> FakeWSManager:
    return FakeWSManager()


@pytest_asyncio.fixture
async def game_store(redis_client: aioredis.Redis) -> GameStore:
    return GameStore(redis_client)


@pytest_asyncio.fixture
async def service(
    redis_client: aioredis.Redis,
    ws_manager: FakeWSManager,
    game_store: GameStore,
) -> MatchmakingService:
    return MatchmakingService(
        redis_client=redis_client,
        ws_manager=ws_manager,  # type: ignore[arg-type]
        game_store=game_store,
        queue_key=TEST_QUEUE_KEY,
    )


# ════════════════════════════════════════════════════════════════════════════
# join_queue / leave_queue
# ════════════════════════════════════════════════════════════════════════════


class TestJoinAndLeaveQueue:
    async def test_join_queue_returns_position_one_for_first_player(
        self, service: MatchmakingService
    ) -> None:
        p1 = uuid4()
        position = await service.join_queue(p1, "Player1")
        assert position == 1

    async def test_join_queue_returns_increasing_positions(
        self, service: MatchmakingService
    ) -> None:
        positions = []
        for i in range(5):
            pid = uuid4()
            pos = await service.join_queue(pid, f"P{i}")
            positions.append(pos)
        assert positions == [1, 2, 3, 4, 5]

    async def test_leave_queue_removes_player_from_redis(
        self,
        service: MatchmakingService,
        redis_client: aioredis.Redis,
    ) -> None:
        p1 = uuid4()
        await service.join_queue(p1, "Player1")
        assert await redis_client.zcard(TEST_QUEUE_KEY) == 1

        await service.leave_queue(p1)
        assert await redis_client.zcard(TEST_QUEUE_KEY) == 0

    async def test_leave_queue_clears_display_name_cache(
        self, service: MatchmakingService
    ) -> None:
        p1 = uuid4()
        await service.join_queue(p1, "Player1")
        assert p1 in service._player_names

        await service.leave_queue(p1)
        assert p1 not in service._player_names

    async def test_leave_queue_for_nonexistent_player_is_noop(
        self, service: MatchmakingService
    ) -> None:
        """Should not raise — leaving a player not in queue is idempotent."""
        await service.leave_queue(uuid4())  # should not raise


# ════════════════════════════════════════════════════════════════════════════
# match_players — pairing logic
# ════════════════════════════════════════════════════════════════════════════


class TestMatchPlayers:
    """Phase 4 note: match_players now persists pairs via the GameStore in
    Redis (not in-memory dicts). Tests verify by querying Redis state via
    ws_manager notifications + key existence rather than the old
    `service.active_games` / `service.game_players` dicts (removed in DR-15)."""

    async def test_no_players_in_queue_does_nothing(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
    ) -> None:
        await service.match_players()  # should not raise
        assert ws_manager.messages_of_type("match_found") == []

    async def test_one_player_in_queue_does_not_pair(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
    ) -> None:
        await service.join_queue(uuid4(), "Solo")
        await service.match_players()
        assert ws_manager.messages_of_type("match_found") == []

    async def test_two_players_create_game_and_clear_queue(
        self,
        service: MatchmakingService,
        redis_client: aioredis.Redis,
        ws_manager: FakeWSManager,
        game_store: GameStore,
    ) -> None:
        p1, p2 = uuid4(), uuid4()
        await service.join_queue(p1, "Player1")
        await service.join_queue(p2, "Player2")
        await service.match_players()

        # Queue drained
        assert await redis_client.zcard(TEST_QUEUE_KEY) == 0
        # Game state persisted in Redis (verify via the match_found event)
        match_founds = ws_manager.messages_of_type("match_found")
        assert len(match_founds) == 2
        game_id_str = match_founds[0][1]["data"]["game_id"]
        game_id = UUID(game_id_str)
        loaded = await game_store.load(game_id)
        assert loaded is not None
        assert {loaded.player1_id, loaded.player2_id} == {p1, p2}

    async def test_match_pairs_players_in_fifo_order(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
    ) -> None:
        """First two in queue should be paired; 3rd waits."""
        p1, p2, p3 = uuid4(), uuid4(), uuid4()
        await service.join_queue(p1, "First")
        # Tiny sleep so scores (timestamps) differ
        await asyncio.sleep(0.01)
        await service.join_queue(p2, "Second")
        await asyncio.sleep(0.01)
        await service.join_queue(p3, "Third")

        await service.match_players()

        # P1 and P2 should be paired (notified), P3 still waiting
        match_found_recipients = {
            pid for pid, _ in ws_manager.messages_of_type("match_found")
        }
        assert match_found_recipients == {p1, p2}
        assert p3 not in match_found_recipients

    async def test_match_notifies_both_with_correct_opponent_name(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
    ) -> None:
        p1, p2 = uuid4(), uuid4()
        await service.join_queue(p1, "Alice")
        await service.join_queue(p2, "Bob")
        await service.match_players()

        p1_msgs = ws_manager.messages_for(p1)
        p2_msgs = ws_manager.messages_for(p2)
        assert len(p1_msgs) == 1
        assert len(p2_msgs) == 1
        assert p1_msgs[0]["data"]["opponent_name"] == "Bob"
        assert p2_msgs[0]["data"]["opponent_name"] == "Alice"

    async def test_match_notifies_both_with_same_game_id(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
    ) -> None:
        p1, p2 = uuid4(), uuid4()
        await service.join_queue(p1, "P1")
        await service.join_queue(p2, "P2")
        await service.match_players()

        p1_game_id = ws_manager.messages_for(p1)[0]["data"]["game_id"]
        p2_game_id = ws_manager.messages_for(p2)[0]["data"]["game_id"]
        assert p1_game_id == p2_game_id

    async def test_match_persists_player_pair_in_store(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
        game_store: GameStore,
    ) -> None:
        """Replaces the old in-memory-dict assertion (active_games / game_players
        removed in DR-15). Now verifies the pair is recorded in PvPSessionState
        persisted to Redis."""
        p1, p2 = uuid4(), uuid4()
        await service.join_queue(p1, "P1")
        await service.join_queue(p2, "P2")
        await service.match_players()

        game_id_str = ws_manager.messages_of_type("match_found")[0][1]["data"]["game_id"]
        loaded = await game_store.load(UUID(game_id_str))
        assert loaded is not None
        assert {loaded.player1_id, loaded.player2_id} == {p1, p2}

    async def test_four_players_create_two_games_over_two_cycles(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
    ) -> None:
        """Two consecutive match_players() calls should each pair one game."""
        players = [uuid4() for _ in range(4)]
        for i, pid in enumerate(players):
            await service.join_queue(pid, f"P{i}")
            await asyncio.sleep(0.005)  # timestamp ordering

        await service.match_players()
        first_pair_count = len(ws_manager.messages_of_type("match_found"))
        assert first_pair_count == 2  # two players notified

        await service.match_players()
        all_match_found = ws_manager.messages_of_type("match_found")
        assert len(all_match_found) == 4  # four total players notified across two pairings
        # Distinct game_ids
        game_ids = {m[1]["data"]["game_id"] for m in all_match_found}
        assert len(game_ids) == 2


# ════════════════════════════════════════════════════════════════════════════
# check_timeouts — players waiting too long
# ════════════════════════════════════════════════════════════════════════════


class TestCheckTimeouts:
    async def test_recent_players_not_timed_out(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
        redis_client: aioredis.Redis,
    ) -> None:
        p1 = uuid4()
        await service.join_queue(p1, "Recent")
        await service.check_timeouts()

        # Still in queue, no notifications
        assert await redis_client.zcard(TEST_QUEUE_KEY) == 1
        assert len(ws_manager.messages_of_type("matchmaking_timeout")) == 0

    async def test_old_players_are_removed_and_notified(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
        redis_client: aioredis.Redis,
    ) -> None:
        p1 = uuid4()
        # Insert directly with a stale timestamp (T - timeout - 5s)
        stale_score = time.time() - MATCHMAKING_TIMEOUT_S - 5
        await redis_client.zadd(TEST_QUEUE_KEY, {str(p1): stale_score})
        service._player_names[p1] = "OldOne"

        await service.check_timeouts()

        assert await redis_client.zcard(TEST_QUEUE_KEY) == 0
        timeouts = ws_manager.messages_of_type("matchmaking_timeout")
        assert len(timeouts) == 1
        assert timeouts[0][0] == p1


# ════════════════════════════════════════════════════════════════════════════
# Background loop lifecycle
# ════════════════════════════════════════════════════════════════════════════


class TestBackgroundLoop:
    async def test_start_and_stop_cleanly(self, service: MatchmakingService) -> None:
        assert service._task is None
        await service.start_background_matching()
        assert service._task is not None
        assert not service._task.done()

        await service.stop_background_matching()
        # Task should be cancelled / done
        assert service._task.done()

    async def test_background_loop_pairs_players_within_one_cycle(
        self,
        service: MatchmakingService,
        ws_manager: FakeWSManager,
    ) -> None:
        """Players joined while loop is running should get paired automatically."""
        await service.start_background_matching()
        try:
            p1, p2 = uuid4(), uuid4()
            await service.join_queue(p1, "P1")
            await service.join_queue(p2, "P2")

            # Loop polls every 500ms — wait long enough for one cycle + slack
            await asyncio.sleep(0.8)

            assert len(ws_manager.messages_of_type("match_found")) == 2
        finally:
            await service.stop_background_matching()
