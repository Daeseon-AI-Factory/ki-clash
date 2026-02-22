# CORE_CANDIDATE
"""JWT token creation and verification.

Handles access tokens and refresh tokens with configurable expiry.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt

from app.config import settings
from app.exceptions import AuthenticationError


def create_access_token(player_id: UUID) -> str:
    """Create a JWT access token for a player.

    Args:
        player_id: The player's UUID.

    Returns:
        Encoded JWT string.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    payload = {
        "sub": str(player_id),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(player_id: UUID) -> str:
    """Create a JWT refresh token for a player.

    Args:
        player_id: The player's UUID.

    Returns:
        Encoded JWT string.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_refresh_token_expire_minutes
    )
    payload = {
        "sub": str(player_id),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_token(token: str, expected_type: str = "access") -> UUID:
    """Verify and decode a JWT token.

    Args:
        token: The JWT string.
        expected_type: Expected token type ("access" or "refresh").

    Returns:
        The player UUID from the token.

    Raises:
        AuthenticationError: If token is invalid, expired, or wrong type.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {e}")

    token_type = payload.get("type")
    if token_type != expected_type:
        raise AuthenticationError(f"Expected {expected_type} token, got {token_type}")

    sub = payload.get("sub")
    if sub is None:
        raise AuthenticationError("Token missing subject")

    try:
        return UUID(sub)
    except ValueError:
        raise AuthenticationError("Invalid player ID in token")
