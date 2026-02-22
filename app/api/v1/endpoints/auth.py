"""Auth endpoints — guest creation, login, registration, token refresh."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import get_current_player
from app.core.auth.guest_auth import (
    authenticate_by_email,
    create_guest,
    register_player,
)
from app.core.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.dependencies import get_db
from app.exceptions import AuthenticationError, ValidationError
from app.models.player import Player
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter()


def _token_response(player: Player) -> TokenResponse:
    """Build a token response for a player."""
    return TokenResponse(
        access_token=create_access_token(player.id),
        refresh_token=create_refresh_token(player.id),
        player_id=player.id,
        display_name=player.display_name,
    )


@router.post("/guest", response_model=TokenResponse)
async def create_guest_session(
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Create a guest account and return tokens.

    No input required — auto-generates a guest player.
    """
    player = await create_guest(db)
    return _token_response(player)


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Upgrade a guest account to a registered account with email/password."""
    try:
        player = await register_player(db, player, body.email, body.password)
    except ValueError as e:
        raise ValidationError(str(e))
    return _token_response(player)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Login with email and password."""
    player = await authenticate_by_email(db, body.email, body.password)
    if player is None:
        raise AuthenticationError("Invalid email or password")
    return _token_response(player)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Exchange a refresh token for new access + refresh tokens."""
    from sqlalchemy import select

    player_id = verify_token(body.refresh_token, expected_type="refresh")
    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    player = result.scalar_one_or_none()
    if player is None:
        raise AuthenticationError("Player not found")
    return _token_response(player)
