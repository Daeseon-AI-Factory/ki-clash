# CORE_CANDIDATE
"""WebSocket connection manager with room-based message routing.

Tracks active WebSocket connections, organizes them into rooms,
and provides broadcasting capabilities. Reusable for any real-time
multiplayer product (games, chat, auctions, collaboration).

Pattern: Observer — rooms are subjects, connected players are observers.
All observers in a room receive broadcast messages simultaneously.

For single-worker deployments, all routing is in-memory. When constructed
with a Redis client, the manager also implements DR-13 (per-player
pub/sub channels) so messages can cross worker boundaries — any worker
can call `send_to_player(X)` and the message reaches X regardless of
which worker holds X's WebSocket.

Pub/sub semantics:
  - send_to_player(X, msg) — local-first. If X is connected on THIS
    worker, send directly. Otherwise publish to the channel.
  - On `connect(X)`, a subscriber task starts listening on X's channel
    and forwarding to the local WebSocket.
  - On `disconnect(X)`, the subscriber task is cancelled.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from uuid import UUID

import redis.asyncio as redis
from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


def _player_channel(player_id: UUID) -> str:
    """Per-player pub/sub channel name (DR-13)."""
    return f"ki_clash:player:{player_id}"


class WSManager:
    """Manages WebSocket connections, rooms, and message broadcasting.

    Single-worker mode (no Redis): tracks connections in-memory; sends
    are direct.

    Multi-worker mode (Redis client provided): tracks local connections
    AND subscribes each connected player to a per-player Redis channel
    so messages from other workers can reach them. Senders publish to
    the channel only when the target isn't locally connected — local
    sends bypass Redis to save a round-trip.

    Thread-safe for asyncio (single event loop per process). Not
    thread-safe for multi-threaded servers.
    """

    def __init__(self, redis_client: redis.Redis | None = None) -> None:
        # player_id → active WebSocket connection
        self._connections: dict[UUID, WebSocket] = {}
        # room_id → set of player_ids in that room
        self._rooms: dict[str, set[UUID]] = {}
        # player_id → room_id (reverse lookup for fast disconnect cleanup)
        self._player_rooms: dict[UUID, str] = {}
        # Optional Redis client for cross-worker pub/sub (DR-13)
        self._redis = redis_client
        # player_id → background subscriber task (cancels on disconnect)
        self._subscribers: dict[UUID, asyncio.Task] = {}

    async def connect(
        self,
        websocket: WebSocket,
        room_id: str,
        player_id: UUID,
    ) -> None:
        """Accept a WebSocket connection and add the player to a room.

        If the player already has a connection (reconnect scenario),
        the old connection is replaced.

        Args:
            websocket: The FastAPI WebSocket instance.
            room_id: The room to join (typically a game_id).
            player_id: The player's UUID.
        """
        await websocket.accept()

        # Clean up old connection if player is reconnecting
        if player_id in self._connections:
            old_ws = self._connections[player_id]
            await self._safe_close(old_ws)

        self._connections[player_id] = websocket

        # Add to room
        if room_id not in self._rooms:
            self._rooms[room_id] = set()
        self._rooms[room_id].add(player_id)
        self._player_rooms[player_id] = room_id

        # Subscribe this worker to the player's cross-worker channel so
        # messages from other workers reach them (DR-13).
        if self._redis is not None and player_id not in self._subscribers:
            self._subscribers[player_id] = asyncio.create_task(
                self._listen_for_player(player_id)
            )

        logger.info(
            "Player %s connected to room %s (%d in room)",
            player_id,
            room_id,
            len(self._rooms[room_id]),
        )

    async def disconnect(self, player_id: UUID) -> str | None:
        """Remove a player's connection and clean up room membership.

        Args:
            player_id: The player's UUID.

        Returns:
            The room_id the player was in, or None if not found.
        """
        self._connections.pop(player_id, None)
        room_id = self._player_rooms.pop(player_id, None)

        if room_id and room_id in self._rooms:
            self._rooms[room_id].discard(player_id)
            # Clean up empty rooms
            if not self._rooms[room_id]:
                del self._rooms[room_id]

        # Cancel pub/sub subscriber if present
        sub = self._subscribers.pop(player_id, None)
        if sub:
            sub.cancel()

        logger.info("Player %s disconnected from room %s", player_id, room_id)
        return room_id

    async def send_to_player(
        self,
        player_id: UUID,
        message: dict[str, Any],
    ) -> bool:
        """Send a JSON message to a specific player.

        Local-first routing (DR-13):
          - If the player has a live WebSocket on THIS worker, send
            directly (no Redis round-trip).
          - Otherwise, if a Redis client is configured, publish to the
            player's channel so the worker that owns their WebSocket
            picks it up via subscriber and forwards.
          - Without Redis and no local connection → returns False.

        Args:
            player_id: Target player's UUID.
            message: JSON-serializable message dict.

        Returns:
            True if delivered locally or published; False if there's no
            local connection and no Redis to fall back on.
        """
        ws = self._connections.get(player_id)
        if ws is not None and ws.client_state == WebSocketState.CONNECTED:
            try:
                await ws.send_json(message)
                return True
            except Exception:
                logger.warning("Failed to send to player %s", player_id)
                await self.disconnect(player_id)
                # Fall through — maybe pub/sub can deliver to another worker
                # that has the player connected (after reconnect)

        if self._redis is not None:
            try:
                await self._redis.publish(
                    _player_channel(player_id), json.dumps(message)
                )
                return True
            except Exception:
                logger.exception(
                    "publish_failed", extra={"player_id": str(player_id)}
                )
                return False

        return False

    async def broadcast_to_room(
        self,
        room_id: str,
        message: dict[str, Any],
        exclude: UUID | None = None,
    ) -> None:
        """Send a JSON message to all players in a room.

        Args:
            room_id: The target room.
            message: JSON-serializable message dict.
            exclude: Optional player_id to skip (e.g., sender).
        """
        player_ids = self._rooms.get(room_id, set()).copy()
        for player_id in player_ids:
            if player_id != exclude:
                await self.send_to_player(player_id, message)

    async def send_personal_to_room(
        self,
        room_id: str,
        message_fn: "callable[[UUID], dict[str, Any]]",
    ) -> None:
        """Send personalized messages to each player in a room.

        Useful when each player needs different data (e.g., hiding
        the opponent's action until both have submitted).

        Args:
            room_id: The target room.
            message_fn: Function that takes player_id, returns message dict.
        """
        player_ids = self._rooms.get(room_id, set()).copy()
        for player_id in player_ids:
            message = message_fn(player_id)
            await self.send_to_player(player_id, message)

    def get_room_players(self, room_id: str) -> set[UUID]:
        """Get all player IDs currently in a room."""
        return self._rooms.get(room_id, set()).copy()

    def get_player_room(self, player_id: UUID) -> str | None:
        """Get the room a player is currently in."""
        return self._player_rooms.get(player_id)

    def is_connected(self, player_id: UUID) -> bool:
        """Check if a player has an active connection."""
        ws = self._connections.get(player_id)
        return ws is not None and ws.client_state == WebSocketState.CONNECTED

    def room_size(self, room_id: str) -> int:
        """Get the number of connected players in a room."""
        return len(self._rooms.get(room_id, set()))

    async def _safe_close(self, ws: WebSocket) -> None:
        """Close a WebSocket connection, ignoring errors."""
        try:
            if ws.client_state == WebSocketState.CONNECTED:
                await ws.close()
        except Exception:
            pass

    async def _listen_for_player(self, player_id: UUID) -> None:
        """Background task: receive messages from Redis for this player
        and forward to their local WebSocket.

        Started in `connect()` when Redis is configured, cancelled in
        `disconnect()`. If the local WebSocket dies mid-listen, messages
        are silently dropped — the next reconnect (likely on another
        worker) will start a fresh subscriber.
        """
        if self._redis is None:
            return
        channel = _player_channel(player_id)
        try:
            pubsub = self._redis.pubsub()
            try:
                await pubsub.subscribe(channel)
                # Poll with a short timeout instead of `pubsub.listen()`. listen()
                # blocks on a raw socket read that raises (and gets mis-wrapped as
                # a TimeoutError) whenever the connection has a read timeout or the
                # task is cancelled — which spammed ERROR "pubsub_listener_crashed"
                # on every normal disconnect/idle. get_message returns None on
                # idle, so we just loop and re-check the WS state. No crash.
                while True:
                    ws = self._connections.get(player_id)
                    if ws is None or ws.client_state != WebSocketState.CONNECTED:
                        break  # player gone — stop quietly
                    raw = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=1.0
                    )
                    if raw is None or raw.get("type") != "message":
                        continue
                    try:
                        payload = json.loads(raw["data"])
                    except (ValueError, TypeError):
                        logger.warning(
                            "pubsub_bad_payload",
                            extra={"player_id": str(player_id)},
                        )
                        continue

                    ws = self._connections.get(player_id)
                    if ws is None or ws.client_state != WebSocketState.CONNECTED:
                        continue
                    try:
                        await ws.send_json(payload)
                    except Exception:
                        logger.warning(
                            "pubsub_forward_failed",
                            extra={"player_id": str(player_id)},
                        )
            finally:
                try:
                    await pubsub.unsubscribe(channel)
                    await pubsub.aclose()
                except Exception:
                    pass
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "pubsub_listener_crashed",
                extra={"player_id": str(player_id)},
            )
