"""Room API schemas — request/response shapes for /rooms endpoints."""

from uuid import UUID

from pydantic import BaseModel, Field


class CreateRoomResponse(BaseModel):
    """Server response after POST /rooms — host gets the shareable code."""

    code: str
    room: "RoomResponse"


class JoinRoomRequest(BaseModel):
    """POST /rooms/{code}/join body — currently empty (code is in the URL)."""


class SetCharacterRequest(BaseModel):
    """PUT /rooms/{code}/character body."""

    character_id: str = Field(..., min_length=1, max_length=50)


class SetReadyRequest(BaseModel):
    """PUT /rooms/{code}/ready body."""

    ready: bool


class StartRoomGameResponse(BaseModel):
    """POST /rooms/{code}/start response — returns the spawned game id."""

    game_id: UUID
    room: "RoomResponse"


class RoomPlayerResponse(BaseModel):
    id: UUID
    name: str
    character_id: str | None = None
    ready: bool = False


class RoomResponse(BaseModel):
    code: str
    host: RoomPlayerResponse
    guest: RoomPlayerResponse | None = None
    status: str
    game_id: UUID | None = None
    created_at: float
    updated_at: float


# Forward-ref resolution
CreateRoomResponse.model_rebuild()
StartRoomGameResponse.model_rebuild()
