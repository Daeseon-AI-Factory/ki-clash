# CORE_CANDIDATE
"""Redis-backed PvP room store.

A "room" is a pre-game lobby: a host creates one, gets a shareable
4-character code, a guest joins via the code, both pick characters +
mark ready, and the room hands off to the existing PvP game pipeline.

Modeled after fighting-game online lobbies (Tekken / SF) — the most
common polished flow for "invite a friend" gameplay.

Storage layout:
    KEY:   ki_clash:room:{code}
    TYPE:  string (JSON)
    TTL:   1 hour from last update
    VALUE: RoomState.model_dump_json()

Code space: 32^4 = 1,048,576 codes (excludes 0/O/1/I/L for legibility).
Collision insertion uses SET NX so the first writer wins atomically.

Lifecycle:
    created → guest_joined → both_ready → in_game → (room deleted on game end)
"""

from __future__ import annotations

import logging
import secrets
import time
from enum import Enum
from typing import Callable
from uuid import UUID

import redis.asyncio as redis
from pydantic import BaseModel, Field
from redis.exceptions import WatchError

logger = logging.getLogger(__name__)

ROOM_TTL_SECONDS = 3600
DEFAULT_MAX_RETRIES = 3

# Code alphabet — uppercase letters + digits, minus ambiguous chars.
# (0/O/1/I/L are easy to mis-type when shared verbally.)
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 4

# How many random codes to try before giving up on collision. With 1M codes
# and rooms TTL'd in 1 hour, collisions are vanishingly rare — but we still
# bound the loop to surface anomalies (Redis down, key namespace polluted).
MAX_CODE_GENERATION_ATTEMPTS = 20


class RoomNotFoundError(Exception):
    """Raised when a room code has no entry in Redis."""


class RoomFullError(Exception):
    """Raised when a guest tries to join a room that already has a guest."""


class NotInRoomError(Exception):
    """Raised when a player tries to act on a room they're not part of."""


class RoomCollisionError(Exception):
    """Raised when code generation can't find an unused slot."""


class TooManyConflictsError(Exception):
    """WATCH retries exhausted — pathological contention."""


class RoomStatus(str, Enum):
    WAITING = "waiting"           # host present, no guest yet
    BOTH_PRESENT = "both_present" # both players in room, picking characters
    IN_GAME = "in_game"           # game has started — frontend nav to /pvp
    FINISHED = "finished"         # game over, ready for rematch or close


class RoomPlayer(BaseModel):
    id: UUID
    name: str
    character_id: str | None = None
    ready: bool = False


class RoomState(BaseModel):
    code: str
    host: RoomPlayer
    guest: RoomPlayer | None = None
    status: RoomStatus = RoomStatus.WAITING
    game_id: UUID | None = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

    def is_member(self, player_id: UUID) -> bool:
        return player_id == self.host.id or (
            self.guest is not None and player_id == self.guest.id
        )

    def player_slot(self, player_id: UUID) -> str:
        """Returns "host" or "guest" — raises NotInRoomError if neither."""
        if player_id == self.host.id:
            return "host"
        if self.guest is not None and player_id == self.guest.id:
            return "guest"
        raise NotInRoomError(f"player {player_id} not in room {self.code}")

    def both_ready(self) -> bool:
        return (
            self.guest is not None
            and self.host.ready
            and self.guest.ready
            and self.host.character_id is not None
            and self.guest.character_id is not None
        )


def _key(code: str) -> str:
    return f"ki_clash:room:{code.upper()}"


def _generate_code() -> str:
    """Random uppercase alphanumeric code excluding ambiguous chars."""
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(CODE_LENGTH))


class RoomStore:
    """Redis-backed room store. All reads/writes go through here."""

    def __init__(self, redis_client: redis.Redis) -> None:
        self._redis = redis_client

    async def create(self, host: RoomPlayer) -> RoomState:
        """Create a new room with a fresh code.

        Uses SET NX (set-if-not-exists) for atomic collision detection —
        no race window between code-check and write.
        """
        for _ in range(MAX_CODE_GENERATION_ATTEMPTS):
            code = _generate_code()
            room = RoomState(code=code, host=host)
            ok = await self._redis.set(
                _key(code),
                room.model_dump_json(),
                ex=ROOM_TTL_SECONDS,
                nx=True,  # only if not exists
            )
            if ok:
                logger.info("room_created", extra={"code": code, "host_id": str(host.id)})
                return room
        raise RoomCollisionError(
            f"could not find unused room code in {MAX_CODE_GENERATION_ATTEMPTS} attempts"
        )

    async def load(self, code: str) -> RoomState | None:
        raw = await self._redis.get(_key(code))
        if raw is None:
            return None
        return RoomState.model_validate_json(raw)

    async def delete(self, code: str) -> None:
        await self._redis.delete(_key(code))

    async def watch_and_update(
        self,
        code: str,
        mutator: Callable[[RoomState], RoomState | None],
        *,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> RoomState:
        """Atomic load → mutate → save with WATCH/MULTI/EXEC.

        Same pattern as GameStore.watch_and_update (DR-14). The room is
        a contended resource — both players can update simultaneously
        (character pick, ready toggle) — so optimistic concurrency is
        not optional.
        """
        key = _key(code)
        last_exc: Exception | None = None

        for attempt in range(max_retries):
            try:
                async with self._redis.pipeline() as pipe:
                    await pipe.watch(key)
                    raw = await pipe.get(key)

                    if raw is None:
                        await pipe.unwatch()
                        raise RoomNotFoundError(f"room {code} not found")

                    room = RoomState.model_validate_json(raw)
                    mutated = mutator(room)
                    if mutated is not None:
                        room = mutated

                    room.updated_at = time.time()

                    pipe.multi()
                    await pipe.set(
                        key, room.model_dump_json(), ex=ROOM_TTL_SECONDS
                    )
                    await pipe.execute()
                    return room

            except WatchError as exc:
                last_exc = exc
                logger.debug(
                    "room_watch_conflict",
                    extra={"code": code, "attempt": attempt + 1},
                )
                continue

        raise TooManyConflictsError(
            f"watch_and_update on room {code} exhausted {max_retries} retries"
        ) from last_exc
