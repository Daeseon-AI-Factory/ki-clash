# CORE_CANDIDATE
"""WebSocket connection manager with room-based message routing.

Tracks active WebSocket connections, organizes them into rooms,
and provides broadcasting capabilities. Reusable for any real-time
multiplayer product (games, chat, auctions, collaboration).

Pattern: Observer — rooms are subjects, connected players are observers.
All observers in a room receive broadcast messages simultaneously.

For MVP (single server), connections are tracked in-memory.
For scale, swap to Redis pub/sub for cross-server messaging.
"""

import logging
from typing import Any
from uuid import UUID

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


class WSManager:
    """Manages WebSocket connections, rooms, and message broadcasting.

    Thread-safe for asyncio (single event loop). Not thread-safe
    for multi-threaded servers — use Redis pub/sub for that.
    """

    def __init__(self) -> None:
        # player_id → active WebSocket connection
        self._connections: dict[UUID, WebSocket] = {}
        # room_id → set of player_ids in that room
        self._rooms: dict[str, set[UUID]] = {}
        # player_id → room_id (reverse lookup for fast disconnect cleanup)
        self._player_rooms: dict[UUID, str] = {}

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

        logger.info("Player %s disconnected from room %s", player_id, room_id)
        return room_id

    async def send_to_player(
        self,
        player_id: UUID,
        message: dict[str, Any],
    ) -> bool:
        """Send a JSON message to a specific player.

        Args:
            player_id: Target player's UUID.
            message: JSON-serializable message dict.

        Returns:
            True if sent successfully, False if player not connected.
        """
        ws = self._connections.get(player_id)
        if ws is None or ws.client_state != WebSocketState.CONNECTED:
            return False

        try:
            await ws.send_json(message)
            return True
        except Exception:
            logger.warning("Failed to send to player %s", player_id)
            await self.disconnect(player_id)
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
