"""Player request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PlayerProfileResponse(BaseModel):
    id: UUID
    display_name: str
    email: str | None
    wins: int
    losses: int
    draws: int
    elo_rating: int
    ranked_wins: int
    ranked_losses: int
    ad_free: bool
    created_at: datetime


class MatchSummaryResponse(BaseModel):
    id: UUID
    match_type: str
    status: str
    winner_id: UUID | None
    rounds_won_p1: int
    rounds_won_p2: int
    created_at: datetime
    completed_at: datetime | None
    is_player1: bool
    result: str  # "win", "loss", "draw", "in_progress"
