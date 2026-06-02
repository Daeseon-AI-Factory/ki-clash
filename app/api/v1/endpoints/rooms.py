"""Room endpoints — host creates room, guest joins via code, both ready up.

Flow:
    POST /rooms                       host creates → gets code
    POST /rooms/{code}/join           guest joins → 2-player lobby
    PUT  /rooms/{code}/character      either player sets their character
    PUT  /rooms/{code}/ready          either player toggles ready
    POST /rooms/{code}/start          (host only) both ready → spawn game
    POST /rooms/{code}/leave          either player leaves
    GET  /rooms/{code}                poll current state

The state model is REST-pollable from the frontend (1-2s interval).
Real-time push could be layered on top later via the existing per-player
Redis pub/sub channels (DR-13) — kept out of v1 to ship faster.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.auth.dependencies import get_current_player
from app.core.game_engine.engine import GameEngine
from app.core.game_engine.types import MatchType
from app.core.game_store import GameStore, PvPSessionState
from app.core.room_store import (
    NotInRoomError,
    RoomFullError,
    RoomNotFoundError,
    RoomPlayer,
    RoomState,
    RoomStatus,
    RoomStore,
)
from app.models.player import Player
from app.schemas.room import (
    CreateRoomResponse,
    RoomPlayerResponse,
    RoomResponse,
    SetCharacterRequest,
    SetReadyRequest,
    StartRoomGameResponse,
)

router = APIRouter()

# Engine singleton — pure / stateless; safe to share.
_engine = GameEngine()


def _get_room_store(request: Request) -> RoomStore:
    """Lazy-create the room store on first use, cache on app.state.

    Avoids touching `main.py` lifespan for this MVP — the RoomStore wraps
    the existing Redis client. If the room store needs background work
    later (TTL sweeper, presence pings), promote to lifespan init.
    """
    store = getattr(request.app.state, "room_store", None)
    if store is None:
        store = RoomStore(request.app.state.redis)
        request.app.state.room_store = store
    return store


def _to_response(room: RoomState) -> RoomResponse:
    return RoomResponse(
        code=room.code,
        host=RoomPlayerResponse(**room.host.model_dump()),
        guest=(
            RoomPlayerResponse(**room.guest.model_dump())
            if room.guest is not None
            else None
        ),
        status=room.status.value,
        game_id=room.game_id,
        created_at=room.created_at,
        updated_at=room.updated_at,
    )


def _to_player(player: Player) -> RoomPlayer:
    return RoomPlayer(id=player.id, name=player.display_name)


# ────────────────────────────────────────────────────────────────────────────
# REST endpoints
# ────────────────────────────────────────────────────────────────────────────


@router.post("", response_model=CreateRoomResponse, status_code=201)
async def create_room(
    request: Request,
    player: Player = Depends(get_current_player),
) -> CreateRoomResponse:
    """Create a new room as host. Returns the shareable code."""
    store = _get_room_store(request)
    room = await store.create(host=_to_player(player))
    return CreateRoomResponse(code=room.code, room=_to_response(room))


@router.get("/{code}", response_model=RoomResponse)
async def get_room(
    code: str,
    request: Request,
    player: Player = Depends(get_current_player),
) -> RoomResponse:
    """Poll the current room state. Caller must be a member."""
    store = _get_room_store(request)
    room = await store.load(code)
    if room is None:
        raise HTTPException(status_code=404, detail="room not found")
    if not room.is_member(player.id):
        raise HTTPException(status_code=403, detail="not a member of this room")
    return _to_response(room)


@router.post("/{code}/join", response_model=RoomResponse)
async def join_room(
    code: str,
    request: Request,
    player: Player = Depends(get_current_player),
) -> RoomResponse:
    """Join an existing room as the guest.

    Rejects if: room doesn't exist, room already has a guest, the joiner
    is already the host.
    """
    store = _get_room_store(request)

    def mutate(room: RoomState) -> RoomState:
        if room.host.id == player.id:
            # Host re-loading the page hits this — treat as no-op rather
            # than error so the frontend can be naive.
            return room
        if room.guest is not None and room.guest.id != player.id:
            raise RoomFullError(f"room {code} already has a guest")
        room.guest = _to_player(player)
        room.status = RoomStatus.BOTH_PRESENT
        return room

    try:
        room = await store.watch_and_update(code, mutate)
    except RoomNotFoundError:
        raise HTTPException(status_code=404, detail="room not found")
    except RoomFullError:
        raise HTTPException(status_code=409, detail="room is full")
    return _to_response(room)


@router.put("/{code}/character", response_model=RoomResponse)
async def set_character(
    code: str,
    body: SetCharacterRequest,
    request: Request,
    player: Player = Depends(get_current_player),
) -> RoomResponse:
    """Set the caller's character. Resets their ready flag (must re-ready)."""
    store = _get_room_store(request)

    def mutate(room: RoomState) -> RoomState:
        slot = room.player_slot(player.id)  # raises NotInRoomError if neither
        if slot == "host":
            room.host.character_id = body.character_id
            room.host.ready = False
        else:
            assert room.guest is not None  # invariant: player_slot returned guest
            room.guest.character_id = body.character_id
            room.guest.ready = False
        return room

    try:
        room = await store.watch_and_update(code, mutate)
    except RoomNotFoundError:
        raise HTTPException(status_code=404, detail="room not found")
    except NotInRoomError:
        raise HTTPException(status_code=403, detail="not a member of this room")
    return _to_response(room)


@router.put("/{code}/ready", response_model=RoomResponse)
async def set_ready(
    code: str,
    body: SetReadyRequest,
    request: Request,
    player: Player = Depends(get_current_player),
) -> RoomResponse:
    """Toggle the caller's ready state. Must have a character picked first."""
    store = _get_room_store(request)

    def mutate(room: RoomState) -> RoomState:
        slot = room.player_slot(player.id)
        if slot == "host":
            if body.ready and room.host.character_id is None:
                raise HTTPException(
                    status_code=400, detail="pick a character first"
                )
            room.host.ready = body.ready
        else:
            assert room.guest is not None
            if body.ready and room.guest.character_id is None:
                raise HTTPException(
                    status_code=400, detail="pick a character first"
                )
            room.guest.ready = body.ready
        return room

    try:
        room = await store.watch_and_update(code, mutate)
    except RoomNotFoundError:
        raise HTTPException(status_code=404, detail="room not found")
    except NotInRoomError:
        raise HTTPException(status_code=403, detail="not a member of this room")
    return _to_response(room)


@router.post("/{code}/start", response_model=StartRoomGameResponse)
async def start_game(
    code: str,
    request: Request,
    player: Player = Depends(get_current_player),
) -> StartRoomGameResponse:
    """Spawn the PvP game for this room. Either player can trigger once
    both are ready. Idempotent — re-calling on an in_game room returns
    the existing game_id.
    """
    store = _get_room_store(request)
    game_store: GameStore = request.app.state.game_store

    # Step 1: idempotency check + ready gate (atomic via WATCH).
    def mutate(room: RoomState) -> RoomState:
        if not room.is_member(player.id):
            raise NotInRoomError(f"player {player.id} not in room {code}")
        if room.status == RoomStatus.IN_GAME:
            return room  # idempotent
        if not room.both_ready():
            raise HTTPException(
                status_code=400, detail="both players must be ready"
            )
        # Spawn the engine match here so its id flows into the room record
        # before we exit the WATCH critical section.
        state = _engine.start_match(MatchType.PVP)
        assert room.guest is not None
        room.game_id = state.game_id
        room.status = RoomStatus.IN_GAME
        # Stash the engine state on the mutator closure for the post-WATCH save.
        nonlocal_state["state"] = state
        return room

    nonlocal_state: dict = {}

    try:
        room = await store.watch_and_update(code, mutate)
    except RoomNotFoundError:
        raise HTTPException(status_code=404, detail="room not found")
    except NotInRoomError:
        raise HTTPException(status_code=403, detail="not a member of this room")

    # Step 2: if we just created the game (not idempotent re-call), persist
    # the PvP session in the game store. This lives outside watch_and_update
    # so the WATCH stays scoped to room state only.
    if "state" in nonlocal_state:
        state = nonlocal_state["state"]
        assert room.guest is not None
        session = PvPSessionState(
            game_state=state,
            player1_id=room.host.id,
            player2_id=room.guest.id,
        )
        await game_store.save(session)

    assert room.game_id is not None
    return StartRoomGameResponse(game_id=room.game_id, room=_to_response(room))


@router.post("/{code}/leave", status_code=204)
async def leave_room(
    code: str,
    request: Request,
    player: Player = Depends(get_current_player),
) -> None:
    """Leave the room. Host leaving destroys the room entirely."""
    store = _get_room_store(request)
    room = await store.load(code)
    if room is None:
        return  # already gone — idempotent
    if not room.is_member(player.id):
        raise HTTPException(status_code=403, detail="not a member of this room")

    if room.host.id == player.id:
        # Host quit — tear down whole room. Guest will get 404 on next poll
        # and the frontend bounces them back to lobby.
        await store.delete(code)
        return

    # Guest leaves — null them out, room becomes waiting again.
    def mutate(r: RoomState) -> RoomState:
        r.guest = None
        r.status = RoomStatus.WAITING
        return r

    try:
        await store.watch_and_update(code, mutate)
    except RoomNotFoundError:
        return  # raced with delete — fine
