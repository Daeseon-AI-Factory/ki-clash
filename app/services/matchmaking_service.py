"""Matchmaking service — pairs players for PvP matches.

Uses Redis as a FIFO queue. Players join → service polls → pairs two
players → creates game → notifies both via WebSocket.

Pattern: Producer-Consumer
- Players PRODUCE queue entries (join_queue)
- Matchmaker CONSUMES them in pairs (match_players)

For MVP: simple FIFO (first come, first served).
For P1: add ELO score to sorted set for skill-based matching.
"""

import asyncio
import logging
import time
from uuid import UUID

import redis.asyncio as redis

from app.config import settings
from app.core.game_engine.engine import GameEngine
from app.core.game_engine.types import GameState, MatchStatus, MatchType
from app.core.ws_manager.manager import WSManager
from app.schemas import ws as ws_msg

logger = logging.getLogger(__name__)

# Redis key for the matchmaking queue
_QUEUE_KEY = "ki_clash:matchmaking:queue"

# How often the matchmaker checks for pairs (milliseconds)
_POLL_INTERVAL_MS = 500

# How long a player waits before getting an AI fallback offer (seconds)
MATCHMAKING_TIMEOUT_S = 30

# Singleton engine for creating PvP game states
_engine = GameEngine()


class MatchmakingService:
    """Manages the PvP matchmaking queue and pairing logic.

    Lifecycle:
    1. Player calls join_queue() → added to Redis sorted set
    2. Background task polls match_players() every 500ms
    3. When 2+ players in queue → pair them → create game → notify via WS
    4. If player waits > 30s → offer AI fallback
    """

    def __init__(self, redis_client: redis.Redis, ws_manager: WSManager) -> None:
        self._redis = redis_client
        self._ws = ws_manager
        # In-memory tracking of active PvP game states (game_id → GameState)
        self.active_games: dict[UUID, GameState] = {}
        # game_id → (player1_id, player2_id) mapping
        self.game_players: dict[UUID, tuple[UUID, UUID]] = {}
        # player_id → display_name for notifications
        self._player_names: dict[UUID, str] = {}
        # Background matchmaking task
        self._task: asyncio.Task | None = None

    async def join_queue(
        self,
        player_id: UUID,
        display_name: str,
    ) -> int:
        """Add a player to the matchmaking queue.

        Args:
            player_id: The player's UUID.
            display_name: Player's display name (for opponent notification).

        Returns:
            Queue position (1-indexed).
        """
        # Score = timestamp for FIFO ordering
        score = time.time()
        await self._redis.zadd(_QUEUE_KEY, {str(player_id): score})
        self._player_names[player_id] = display_name

        # Get position in queue
        position = await self._redis.zrank(_QUEUE_KEY, str(player_id))
        return (position or 0) + 1

    async def leave_queue(self, player_id: UUID) -> None:
        """Remove a player from the matchmaking queue."""
        await self._redis.zrem(_QUEUE_KEY, str(player_id))
        self._player_names.pop(player_id, None)
        logger.info("Player %s left matchmaking queue", player_id)

    async def match_players(self) -> None:
        """Check the queue and pair players.

        Called periodically by the background task. Takes the first
        two players from the queue (FIFO) and creates a game.
        """
        # Get the first 2 players in queue (sorted by join time)
        members = await self._redis.zrange(_QUEUE_KEY, 0, 1)

        if len(members) < 2:
            return

        p1_str, p2_str = members[0], members[1]
        p1_id = UUID(p1_str.decode() if isinstance(p1_str, bytes) else p1_str)
        p2_id = UUID(p2_str.decode() if isinstance(p2_str, bytes) else p2_str)

        # Remove both from queue
        await self._redis.zrem(_QUEUE_KEY, str(p1_id), str(p2_id))

        # Create a PvP game
        state = _engine.start_match(MatchType.PVP)
        game_id = state.game_id
        self.active_games[game_id] = state
        self.game_players[game_id] = (p1_id, p2_id)

        room_id = str(game_id)

        p1_name = self._player_names.pop(p1_id, "Player 1")
        p2_name = self._player_names.pop(p2_id, "Player 2")

        logger.info(
            "Match found: %s vs %s → game %s",
            p1_name, p2_name, game_id,
        )

        # Notify both players
        await self._ws.send_to_player(
            p1_id, ws_msg.match_found(str(game_id), p2_name)
        )
        await self._ws.send_to_player(
            p2_id, ws_msg.match_found(str(game_id), p1_name)
        )

    async def check_timeouts(self) -> None:
        """Check for players who have been waiting too long.

        If a player has been in queue for > MATCHMAKING_TIMEOUT_S,
        notify them that no match was found (client can offer AI fallback).
        """
        cutoff = time.time() - MATCHMAKING_TIMEOUT_S
        # Get all members with score (join time) before cutoff
        timed_out = await self._redis.zrangebyscore(
            _QUEUE_KEY, "-inf", cutoff
        )

        for member in timed_out:
            player_id = UUID(
                member.decode() if isinstance(member, bytes) else member
            )
            await self._redis.zrem(_QUEUE_KEY, str(player_id))
            self._player_names.pop(player_id, None)

            # Notify player: no match found, offer AI
            await self._ws.send_to_player(
                player_id,
                {"type": "matchmaking_timeout", "data": {}},
            )
            logger.info("Player %s timed out from matchmaking", player_id)

    async def start_background_matching(self) -> None:
        """Start the background matchmaking loop."""
        self._task = asyncio.create_task(self._matching_loop())
        logger.info("Matchmaking background task started")

    async def stop_background_matching(self) -> None:
        """Stop the background matchmaking loop."""
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Matchmaking background task stopped")

    async def _matching_loop(self) -> None:
        """Continuous loop that checks for matches and timeouts."""
        while True:
            try:
                await self.match_players()
                await self.check_timeouts()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Error in matchmaking loop")
            await asyncio.sleep(_POLL_INTERVAL_MS / 1000)
