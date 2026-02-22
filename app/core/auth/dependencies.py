"""Auth dependencies for FastAPI route injection."""

from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.jwt_handler import verify_token
from app.dependencies import get_db
from app.exceptions import AuthenticationError, NotFoundError
from app.models.player import Player

_bearer_scheme = HTTPBearer()


async def get_current_player(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Player:
    """Extract and validate JWT, return the current player.

    Args:
        credentials: Bearer token from Authorization header.
        db: Database session.

    Returns:
        The authenticated Player.

    Raises:
        AuthenticationError: If token is invalid.
        NotFoundError: If player no longer exists.
    """
    player_id = verify_token(credentials.credentials)

    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    player = result.scalar_one_or_none()
    if player is None:
        raise NotFoundError("Player", str(player_id))

    return player
