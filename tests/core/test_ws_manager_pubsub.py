"""Tests for WSManager cross-worker pub/sub (DR-13).

Validates the local-first send routing and Redis publish fallback that
make distributed multi-worker deployments possible. Uses real Redis
(docker stack); auto-skips if unreachable.
"""

from __future__ import annotations

import asyncio
import json
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
import redis.asyncio as aioredis

from app.core.ws_manager.manager import WSManager, _player_channel


# ────────────────────────────────────────────────────────────────────────────
# Redis fixture
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
async def redis_client() -> aioredis.Redis:
    client = aioredis.from_url("redis://localhost:6379/0", decode_responses=False)
    yield client
    await client.aclose()


# ────────────────────────────────────────────────────────────────────────────
# Channel name contract — DR-13 spec
# ────────────────────────────────────────────────────────────────────────────


class TestChannelNames:
    def test_per_player_channel_format(self) -> None:
        pid = UUID("00000000-0000-0000-0000-000000000123")
        assert _player_channel(pid) == "ki_clash:player:00000000-0000-0000-0000-000000000123"


# ────────────────────────────────────────────────────────────────────────────
# send_to_player routing
# ────────────────────────────────────────────────────────────────────────────


class TestSendRouting:
    """Validates the local-first / publish-fallback contract."""

    async def test_no_redis_and_no_local_returns_false(self) -> None:
        """Single-worker mode with no connection → False."""
        mgr = WSManager(redis_client=None)
        ok = await mgr.send_to_player(uuid4(), {"type": "test", "data": {}})
        assert ok is False

    async def test_redis_publishes_when_player_not_local(
        self,
        redis_client: aioredis.Redis,
    ) -> None:
        """Multi-worker mode: send to a not-locally-connected player
        publishes to the channel. We verify by subscribing externally."""
        mgr = WSManager(redis_client=redis_client)
        player_id = uuid4()
        channel = _player_channel(player_id)

        # Subscribe externally so we can observe the publish
        pubsub = redis_client.pubsub()
        try:
            await pubsub.subscribe(channel)
            # Drain the subscribe-confirmation message
            await pubsub.get_message(timeout=0.5)

            payload = {"type": "test", "data": {"x": 1}}
            ok = await mgr.send_to_player(player_id, payload)
            assert ok is True

            # Should arrive on the channel
            for _ in range(10):
                msg = await pubsub.get_message(timeout=0.1)
                if msg and msg.get("type") == "message":
                    received = json.loads(msg["data"])
                    assert received == payload
                    break
            else:
                pytest.fail("Did not observe published message within timeout")
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

    async def test_redis_subscriber_forwards_received_messages_to_local_ws(
        self,
        redis_client: aioredis.Redis,
    ) -> None:
        """When a player is connected on this worker, the subscriber task
        should forward Redis-published messages to the local WS."""
        mgr = WSManager(redis_client=redis_client)
        player_id = uuid4()

        # Stand in for a real FastAPI WebSocket — only the methods the
        # manager actually calls need to exist.
        from starlette.websockets import WebSocketState

        sent: list[dict] = []

        class FakeWebSocket:
            def __init__(self) -> None:
                self.client_state = WebSocketState.CONNECTED
                self._accepted = False

            async def accept(self) -> None:
                self._accepted = True

            async def send_json(self, payload: dict) -> None:
                sent.append(payload)

            async def close(self) -> None:
                self.client_state = WebSocketState.DISCONNECTED

        fake_ws = FakeWebSocket()

        await mgr.connect(fake_ws, room_id="game-x", player_id=player_id)
        # Wait for the subscriber to actually subscribe — pub/sub
        # subscribe is fire-and-await but the listener needs a beat to
        # pull the first frame.
        await asyncio.sleep(0.1)

        # Publish from "another worker" (just direct PUBLISH here)
        payload = {"type": "test", "data": {"src": "other_worker"}}
        await redis_client.publish(_player_channel(player_id), json.dumps(payload))

        # Listener forwards it to the fake local WS
        for _ in range(20):
            if sent:
                break
            await asyncio.sleep(0.05)
        assert sent == [payload]

        await mgr.disconnect(player_id)


class TestSubscriberLifecycle:
    async def test_connect_starts_subscriber_task(
        self,
        redis_client: aioredis.Redis,
    ) -> None:
        mgr = WSManager(redis_client=redis_client)
        player_id = uuid4()

        from starlette.websockets import WebSocketState

        class FakeWS:
            client_state = WebSocketState.CONNECTED

            async def accept(self) -> None: ...
            async def send_json(self, _: dict) -> None: ...
            async def close(self) -> None: ...

        await mgr.connect(FakeWS(), room_id="rm", player_id=player_id)
        assert player_id in mgr._subscribers
        assert not mgr._subscribers[player_id].done()

        await mgr.disconnect(player_id)

    async def test_disconnect_cancels_subscriber(
        self,
        redis_client: aioredis.Redis,
    ) -> None:
        mgr = WSManager(redis_client=redis_client)
        player_id = uuid4()

        from starlette.websockets import WebSocketState

        class FakeWS:
            client_state = WebSocketState.CONNECTED

            async def accept(self) -> None: ...
            async def send_json(self, _: dict) -> None: ...
            async def close(self) -> None: ...

        await mgr.connect(FakeWS(), room_id="rm", player_id=player_id)
        sub_task = mgr._subscribers[player_id]

        await mgr.disconnect(player_id)
        # Subscriber should be removed + cancelled
        assert player_id not in mgr._subscribers
        # Give cancellation a beat to propagate
        await asyncio.sleep(0.05)
        assert sub_task.cancelled() or sub_task.done()

    async def test_no_redis_no_subscriber_started(self) -> None:
        """Single-worker mode shouldn't spawn subscriber tasks."""
        mgr = WSManager(redis_client=None)
        player_id = uuid4()

        from starlette.websockets import WebSocketState

        class FakeWS:
            client_state = WebSocketState.CONNECTED

            async def accept(self) -> None: ...
            async def send_json(self, _: dict) -> None: ...
            async def close(self) -> None: ...

        await mgr.connect(FakeWS(), room_id="rm", player_id=player_id)
        assert player_id not in mgr._subscribers
        await mgr.disconnect(player_id)
