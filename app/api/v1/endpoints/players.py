"""Player endpoints — profile, stats, match history."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import get_current_player
from app.dependencies import get_db
from app.models.player import Player
from app.schemas.player import MatchSummaryResponse, PlayerProfileResponse
from app.services import player_service

router = APIRouter()


@router.get("/me", response_model=PlayerProfileResponse)
async def get_my_profile(
    player: Player = Depends(get_current_player),
) -> PlayerProfileResponse:
    """Get the current player's profile and stats."""
    return PlayerProfileResponse(
        id=player.id,
        display_name=player.display_name,
        email=player.email,
        wins=player.wins,
        losses=player.losses,
        draws=player.draws,
        elo_rating=player.elo_rating,
        ranked_wins=player.ranked_wins,
        ranked_losses=player.ranked_losses,
        ad_free=player.ad_free,
        created_at=player.created_at,
    )


@router.get("/me/matches", response_model=list[MatchSummaryResponse])
async def get_my_matches(
    player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
) -> list[MatchSummaryResponse]:
    """Get the current player's match history."""
    return await player_service.get_match_history(db, player.id)
