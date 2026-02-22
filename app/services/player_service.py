"""Player service — profile and match history queries."""

from uuid import UUID

from sqlalchemy import select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match
from app.models.player import Player
from app.schemas.player import MatchSummaryResponse


async def get_match_history(
    db: AsyncSession,
    player_id: UUID,
    limit: int = 20,
) -> list[MatchSummaryResponse]:
    """Get a player's recent match history.

    Args:
        db: Database session.
        player_id: The player's UUID.
        limit: Max number of matches to return.

    Returns:
        List of match summaries, most recent first.
    """
    result = await db.execute(
        select(Match)
        .where(
            or_(
                Match.player1_id == player_id,
                Match.player2_id == player_id,
            )
        )
        .order_by(desc(Match.created_at))
        .limit(limit)
    )
    matches = result.scalars().all()

    summaries = []
    for match in matches:
        is_player1 = match.player1_id == player_id

        if match.status != "completed":
            match_result = "in_progress"
        elif match.winner_id == player_id:
            match_result = "win"
        elif match.winner_id is None:
            match_result = "draw"
        else:
            match_result = "loss"

        summaries.append(MatchSummaryResponse(
            id=match.id,
            match_type=match.match_type,
            status=match.status,
            winner_id=match.winner_id,
            rounds_won_p1=match.rounds_won_p1,
            rounds_won_p2=match.rounds_won_p2,
            created_at=match.created_at,
            completed_at=match.completed_at,
            is_player1=is_player1,
            result=match_result,
        ))

    return summaries
