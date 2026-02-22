"""Ranked mode request/response schemas."""

from uuid import UUID

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    player_id: str
    display_name: str
    elo_rating: int
    ranked_wins: int
    ranked_losses: int


class PlayerRankResponse(BaseModel):
    rank: int
    player_id: str
    display_name: str
    elo_rating: int
    ranked_wins: int
    ranked_losses: int


class EloChangeResponse(BaseModel):
    player_id: str
    old_elo: int
    new_elo: int
    change: int
