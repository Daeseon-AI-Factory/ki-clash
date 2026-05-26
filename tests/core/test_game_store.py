"""Tests for the Redis-backed game store.

Uses real Redis (docker stack) with per-test key flush for isolation.
Auto-skips if Redis isn't running.
"""

from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
import redis.asyncio as aioredis

from app.core.game_engine.engine import GameEngine
from app.core.game_engine.types import Action, MatchType
from app.core.game_store import (
    DEFAULT_MAX_RETRIES,
    GAME_TTL_SECONDS,
    GameNotFoundError,
    GameStore,
    PvPSessionState,
    TooManyConflictsError,
    _key,
)


# ────────────────────────────────────────────────────────────────────────────
# Fixtures
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


@pytest_asyncio.fixture
async def redis_client():
    client = aioredis.from_url("redis://localhost:6379/0", decode_responses=False)
    yield client
    await client.aclose()


@pytest_asyncio.fixture
async def store(redis_client: aioredis.Redis) -> GameStore:
    return GameStore(redis_client)


def _make_session(
    p1_id: UUID | None = None,
    p2_id: UUID | None = None,
) -> PvPSessionState:
    """Build a fresh PvPSessionState with a new game."""
    engine = GameEngine()
    state = engine.start_match(MatchType.PVP)
    return PvPSessionState(
        game_state=state,
        player1_id=p1_id or uuid4(),
        player2_id=p2_id or uuid4(),
    )


@pytest_asyncio.fixture
async def cleanup_session(redis_client: aioredis.Redis):
    """Track created game_ids and clean them up after each test."""
    created: list[UUID] = []
    yield created
    for game_id in created:
        await redis_client.delete(_key(game_id))


# ════════════════════════════════════════════════════════════════════════════
# Basic CRUD
# ════════════════════════════════════════════════════════════════════════════


class TestBasicCrud:
    async def test_save_and_load_round_trip(
        self,
        store: GameStore,
        cleanup_session: list[UUID],
    ) -> None:
        session = _make_session()
        cleanup_session.append(session.game_state.game_id)

        await store.save(session)
        loaded = await store.load(session.game_state.game_id)

        assert loaded is not None
        assert loaded.game_state.game_id == session.game_state.game_id
        assert loaded.player1_id == session.player1_id
        assert loaded.player2_id == session.player2_id
        assert loaded.started is False
        assert loaded.p1_action is None
        assert loaded.p2_action is None

    async def test_load_unknown_returns_none(
        self, store: GameStore
    ) -> None:
        assert await store.load(uuid4()) is None

    async def test_exists_reports_correctly(
        self,
        store: GameStore,
        cleanup_session: list[UUID],
    ) -> None:
        session = _make_session()
        cleanup_session.append(session.game_state.game_id)

        assert await store.exists(session.game_state.game_id) is False
        await store.save(session)
        assert await store.exists(session.game_state.game_id) is True

    async def test_delete_removes_key(
        self,
        store: GameStore,
        cleanup_session: list[UUID],
    ) -> None:
        session = _make_session()
        cleanup_session.append(session.game_state.game_id)

        await store.save(session)
        await store.delete(session.game_state.game_id)

        assert await store.load(session.game_state.game_id) is None

    async def test_delete_unknown_is_idempotent(
        self, store: GameStore
    ) -> None:
        # Should not raise
        await store.delete(uuid4())


class TestSerialization:
    async def test_complex_state_survives_round_trip(
        self,
        store: GameStore,
        cleanup_session: list[UUID],
    ) -> None:
        """Round-trip a session with non-default values in every field."""
        engine = GameEngine()
        state = engine.start_match(MatchType.PVP)
        # Play a turn so the state has history
        state, _, _, _ = engine.submit_turn(state, Action.CHARGE, Action.CHARGE)

        session = PvPSessionState(
            game_state=state,
            player1_id=uuid4(),
            player2_id=uuid4(),
            connected_players=[uuid4(), uuid4()],
            started=True,
            p1_action=Action.ATTACK,
            p2_action=None,
        )
        cleanup_session.append(session.game_state.game_id)

        await store.save(session)
        loaded = await store.load(session.game_state.game_id)

        assert loaded is not None
        assert loaded.connected_players == session.connected_players
        assert loaded.started is True
        assert loaded.p1_action == Action.ATTACK
        assert loaded.p2_action is None
        # Game state turn_history must round-trip
        assert loaded.game_state.current_round is not None
        assert len(loaded.game_state.current_round.turn_history) == 1


class TestTtl:
    async def test_ttl_is_set_on_save(
        self,
        store: GameStore,
        redis_client: aioredis.Redis,
        cleanup_session: list[UUID],
    ) -> None:
        session = _make_session()
        cleanup_session.append(session.game_state.game_id)

        await store.save(session)
        ttl = await redis_client.ttl(_key(session.game_state.game_id))
        # Should be close to GAME_TTL_SECONDS, allowing for tiny clock skew
        assert 0 < ttl <= GAME_TTL_SECONDS


# ════════════════════════════════════════════════════════════════════════════
# Helper methods on the model
# ════════════════════════════════════════════════════════════════════════════


class TestSessionStateHelpers:
    def test_has_connected_false_by_default(self) -> None:
        session = _make_session()
        assert session.has_connected(session.player1_id) is False

    def test_mark_connected_then_has_connected(self) -> None:
        session = _make_session()
        session.mark_connected(session.player1_id)
        assert session.has_connected(session.player1_id) is True

    def test_mark_connected_is_idempotent(self) -> None:
        session = _make_session()
        session.mark_connected(session.player1_id)
        session.mark_connected(session.player1_id)
        assert len(session.connected_players) == 1

    def test_is_player_true_for_either(self) -> None:
        session = _make_session()
        assert session.is_player(session.player1_id) is True
        assert session.is_player(session.player2_id) is True
        assert session.is_player(uuid4()) is False


# ════════════════════════════════════════════════════════════════════════════
# Atomic update (WATCH/MULTI/EXEC) — DR-14
# ════════════════════════════════════════════════════════════════════════════


class TestWatchAndUpdate:
    async def test_basic_mutation_persists(
        self,
        store: GameStore,
        cleanup_session: list[UUID],
    ) -> None:
        session = _make_session()
        cleanup_session.append(session.game_state.game_id)
        await store.save(session)

        def mutator(s: PvPSessionState) -> PvPSessionState:
            s.started = True
            s.mark_connected(s.player1_id)
            return s

        result = await store.watch_and_update(
            session.game_state.game_id, mutator
        )
        assert result.started is True
        assert session.player1_id in result.connected_players

        # Verify persisted
        loaded = await store.load(session.game_state.game_id)
        assert loaded is not None
        assert loaded.started is True
        assert session.player1_id in loaded.connected_players

    async def test_unknown_game_raises_not_found(
        self, store: GameStore
    ) -> None:
        with pytest.raises(GameNotFoundError):
            await store.watch_and_update(
                uuid4(),
                lambda s: s,
            )

    async def test_mutator_can_return_none_to_mutate_in_place(
        self,
        store: GameStore,
        cleanup_session: list[UUID],
    ) -> None:
        session = _make_session()
        cleanup_session.append(session.game_state.game_id)
        await store.save(session)

        def mutator(s: PvPSessionState) -> None:
            s.started = True
            # Return None — in-place mutation should still persist

        result = await store.watch_and_update(
            session.game_state.game_id, mutator
        )
        assert result.started is True

    async def test_concurrent_mutations_serialize_correctly(
        self,
        store: GameStore,
        cleanup_session: list[UUID],
    ) -> None:
        """Two concurrent mutations should both eventually apply with
        optimistic retry — last writer doesn't lose first writer's work."""
        session = _make_session()
        cleanup_session.append(session.game_state.game_id)
        await store.save(session)

        async def mark_p1() -> None:
            await store.watch_and_update(
                session.game_state.game_id,
                lambda s: s.mark_connected(session.player1_id) or s,  # type: ignore[func-returns-value]
            )

        async def mark_p2() -> None:
            await store.watch_and_update(
                session.game_state.game_id,
                lambda s: s.mark_connected(session.player2_id) or s,  # type: ignore[func-returns-value]
            )

        # Run both concurrently — WATCH/MULTI/EXEC should serialize them
        await asyncio.gather(mark_p1(), mark_p2())

        loaded = await store.load(session.game_state.game_id)
        assert loaded is not None
        assert session.player1_id in loaded.connected_players
        assert session.player2_id in loaded.connected_players

    async def test_default_max_retries_is_3(self) -> None:
        """Guards against accidental change to the retry budget — Phase 3
        DR-14 chose 3 deliberately and other tuning should be a conscious
        decision."""
        assert DEFAULT_MAX_RETRIES == 3
