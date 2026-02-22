# CORE_CANDIDATE
"""Guest account creation and management.

Players start as guests with zero friction. Optionally upgrade
to a registered account with email/password.
"""

import uuid
import random
import string

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.player import Player

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Adjective-noun combos for guest display names
_ADJECTIVES = [
    "Swift", "Bold", "Fierce", "Silent", "Burning",
    "Thunder", "Shadow", "Storm", "Iron", "Crystal",
]
_NOUNS = [
    "Warrior", "Fighter", "Saiyan", "Dragon", "Phoenix",
    "Tiger", "Wolf", "Hawk", "Blaze", "Nova",
]


def _generate_display_name() -> str:
    """Generate a random display name like 'SwiftDragon42'."""
    adj = random.choice(_ADJECTIVES)
    noun = random.choice(_NOUNS)
    num = random.randint(10, 99)
    return f"{adj}{noun}{num}"


async def create_guest(db: AsyncSession) -> Player:
    """Create a new guest player account.

    Args:
        db: Async database session.

    Returns:
        The created Player instance.
    """
    guest_token = str(uuid.uuid4())
    display_name = _generate_display_name()

    player = Player(
        guest_token=guest_token,
        display_name=display_name,
    )
    db.add(player)
    await db.flush()
    return player


async def register_player(
    db: AsyncSession,
    player: Player,
    email: str,
    password: str,
) -> Player:
    """Upgrade a guest account to a registered account.

    Args:
        db: Async database session.
        player: Existing guest player to upgrade.
        email: Email address.
        password: Plain-text password (will be hashed).

    Returns:
        The updated Player instance.

    Raises:
        ValueError: If email is already taken or player already registered.
    """
    if player.email is not None:
        raise ValueError("Player already has an email registered")

    existing = await db.execute(
        select(Player).where(Player.email == email)
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("Email already registered")

    player.email = email
    player.password_hash = pwd_context.hash(password)
    await db.flush()
    return player


async def authenticate_by_email(
    db: AsyncSession,
    email: str,
    password: str,
) -> Player | None:
    """Authenticate a player by email and password.

    Args:
        db: Async database session.
        email: Player's email.
        password: Plain-text password to verify.

    Returns:
        Player if credentials match, None otherwise.
    """
    result = await db.execute(
        select(Player).where(Player.email == email)
    )
    player = result.scalar_one_or_none()
    if player is None or player.password_hash is None:
        return None
    if not pwd_context.verify(password, player.password_hash):
        return None
    return player
