# CORE_CANDIDATE
"""Redis-backed PvP session store.

This module is the single source of truth for PvP game runtime state.
Implements DR-12 (single JSON blob per game), DR-14 (WATCH/MULTI/EXEC
optimistic concurrency), and DR-15 (stateless workers — every read/write
goes through Redis).

# CORE_CANDIDATE — generic state-store pattern reusable for any
real-time multiplayer product whose state fits in a small JSON blob.

Storage layout:
    KEY: ki_clash:game:{game_id}
    TYPE: string (JSON)
    TTL: 1 hour from last update (auto-cleanup of abandoned games)
    VALUE: PvPSessionState.model_dump_json()
"""

from __future__ import annotations

import logging
from typing import Awaitable, Callable
from uuid import UUID

import redis.asyncio as redis
from pydantic import BaseModel, Field
from redis.exceptions import WatchError

from app.core.game_engine.types import Action, GameState

logger = logging.getLogger(__name__)

# TTL on stored game keys. Abandoned games (no activity for an hour)
# auto-clean themselves — cheap insurance against unbounded growth.
GAME_TTL_SECONDS = 3600

# Maximum WATCH retries on optimistic-concurrency conflicts (DR-14).
# 3 covers ~99.99% of contention; beyond that, surface the error.
DEFAULT_MAX_RETRIES = 3


# ────────────────────────────────────────────────────────────────────────────
# Errors
# ────────────────────────────────────────────────────────────────────────────


class GameNotFoundError(Exception):
    """Raised when a game_id has no corresponding session in Redis."""


class TooManyConflictsError(Exception):
    """Raised when WATCH retries exhaust without a successful EXEC.

    Indicates pathological contention (more than DEFAULT_MAX_RETRIES racing
    writers) — investigate caller logic, don't just bump the retry count.
    """


# ────────────────────────────────────────────────────────────────────────────
# Session state model — combines pure GameState + PvP runtime fields
# ────────────────────────────────────────────────────────────────────────────


class PvPSessionState(BaseModel):
    """Distributed runtime state for a single PvP game session.

    Wraps the pure-engine `GameState` with PvP-specific runtime fields
    (player ids, connection tracking, pending turn actions) that don't
    belong in the engine layer. This separation keeps `GameState`
    portable for non-PvP use (AI matches, replays) while letting the
    PvP layer own its session protocol.

    The `connected_players` field uses `list[UUID]` rather than `set[UUID]`
    because JSON has no native set type — list keeps serialization
    trivially round-trippable. Membership is O(n) but n ≤ 2 per game.
    """

    game_state: GameState
    player1_id: UUID
    player2_id: UUID
    connected_players: list[UUID] = Field(default_factory=list)
    started: bool = False
    p1_action: Action | None = None
    p2_action: Action | None = None

    def has_connected(self, player_id: UUID) -> bool:
        return player_id in self.connected_players

    def mark_connected(self, player_id: UUID) -> None:
        if player_id not in self.connected_players:
            self.connected_players.append(player_id)

    def is_player(self, player_id: UUID) -> bool:
        return player_id in (self.player1_id, self.player2_id)


# ────────────────────────────────────────────────────────────────────────────
# Game store
# ────────────────────────────────────────────────────────────────────────────


def _key(game_id: UUID) -> str:
    return f"ki_clash:game:{game_id}"


class GameStore:
    """Redis-backed game state store.

    All PvP runtime state reads and writes go through this object. Workers
    hold no in-memory PvP state — only WebSocket connections. This is the
    DR-15 statelessness contract.
    """

    def __init__(self, redis_client: redis.Redis) -> None:
        self._redis = redis_client

    async def save(self, session: PvPSessionState) -> None:
        """Persist session state with TTL.

        Caller-controlled save — use this for non-contended writes
        (e.g., initial session creation). For mutations under concurrent
        writers, use `watch_and_update()` instead.
        """
        key = _key(session.game_state.game_id)
        await self._redis.set(
            key, session.model_dump_json(), ex=GAME_TTL_SECONDS
        )

    async def load(self, game_id: UUID) -> PvPSessionState | None:
        """Load session state. Returns None if the game_id is unknown."""
        raw = await self._redis.get(_key(game_id))
        if raw is None:
            return None
        return PvPSessionState.model_validate_json(raw)

    async def delete(self, game_id: UUID) -> None:
        """Remove session state. Idempotent — no error if already gone."""
        await self._redis.delete(_key(game_id))

    async def exists(self, game_id: UUID) -> bool:
        return bool(await self._redis.exists(_key(game_id)))

    async def watch_and_update(
        self,
        game_id: UUID,
        mutator: Callable[[PvPSessionState], PvPSessionState | None],
        *,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> PvPSessionState:
        """Atomic load → mutate → save with optimistic concurrency.

        Implements DR-14 — Redis WATCH/MULTI/EXEC with retry on WatchError.

        Args:
            game_id: Target game.
            mutator: Function that takes the loaded session and either
                mutates it in-place (returning None or the same object)
                or returns a fresh PvPSessionState to persist.
            max_retries: Cap on retry attempts before surfacing
                TooManyConflictsError.

        Returns:
            The final state that was persisted.

        Raises:
            GameNotFoundError: The key didn't exist when the operation
                started.
            TooManyConflictsError: WATCH retries exhausted without a
                successful EXEC — indicates pathological contention.
        """
        key = _key(game_id)
        last_exc: Exception | None = None

        for attempt in range(max_retries):
            try:
                async with self._redis.pipeline() as pipe:
                    await pipe.watch(key)
                    raw = await pipe.get(key)

                    if raw is None:
                        await pipe.unwatch()
                        raise GameNotFoundError(
                            f"game {game_id} not found in Redis"
                        )

                    session = PvPSessionState.model_validate_json(raw)
                    mutated = mutator(session)
                    if mutated is not None:
                        session = mutated

                    pipe.multi()
                    await pipe.set(
                        key, session.model_dump_json(), ex=GAME_TTL_SECONDS
                    )
                    await pipe.execute()
                    return session

            except WatchError as exc:
                last_exc = exc
                logger.debug(
                    "watch_conflict",
                    extra={
                        "game_id": str(game_id),
                        "attempt": attempt + 1,
                        "max_retries": max_retries,
                    },
                )
                continue

        raise TooManyConflictsError(
            f"watch_and_update on game {game_id} exhausted "
            f"{max_retries} retries"
        ) from last_exc
