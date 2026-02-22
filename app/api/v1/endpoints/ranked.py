"""Ranked mode endpoints — leaderboard and player rank."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import get_current_player
from app.dependencies import get_db
from app.models.player import Player
from app.schemas.ranked import LeaderboardEntry, PlayerRankResponse
from app.services import ranked_service

router = APIRouter()


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> list[LeaderboardEntry]:
    """Get the top players by ELO rating."""
    entries = await ranked_service.get_leaderboard(db, limit=min(limit, 100))
    return [LeaderboardEntry(**e) for e in entries]


@router.get("/me", response_model=PlayerRankResponse | None)
async def get_my_rank(
    player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
) -> PlayerRankResponse | None:
    """Get the current player's rank and ELO stats."""
    data = await ranked_service.get_player_rank(db, player.id)
    if data is None:
        return None
    return PlayerRankResponse(**data)
