"""Payment service — ad-free pass purchase flow.

Handles checkout session creation and webhook fulfillment.
Marks players as ad_free=True on successful payment.
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.payment import LemonSqueezyHandler, StripeHandler
from app.models.player import Player

logger = logging.getLogger(__name__)


async def create_ad_free_checkout(
    stripe_handler: StripeHandler,
    price_id: str,
    player_id: UUID,
    player_email: str | None,
    success_url: str,
    cancel_url: str,
) -> dict[str, str]:
    """Create a Stripe checkout session for the ad-free pass.

    Args:
        stripe_handler: Configured StripeHandler instance.
        price_id: Stripe Price ID for ad-free pass.
        player_id: Current player's UUID.
        player_email: Optional email for checkout pre-fill.
        success_url: Redirect URL on success.
        cancel_url: Redirect URL on cancel.

    Returns:
        Dict with session_id and checkout_url.
    """
    return await stripe_handler.create_checkout_session(
        price_id=price_id,
        customer_email=player_email,
        metadata={"player_id": str(player_id), "item": "ad_free_pass"},
        success_url=success_url,
        cancel_url=cancel_url,
    )


async def create_founder_pass_checkout(
    lemon_handler: LemonSqueezyHandler,
    player_id: UUID,
    player_email: str | None,
    success_url: str,
    cancel_url: str,
) -> dict[str, str]:
    """Create a Lemon Squeezy checkout for the Founder Pass."""
    return await lemon_handler.create_founder_pass_checkout(
        player_id=str(player_id),
        player_email=player_email,
        success_url=success_url,
        cancel_url=cancel_url,
    )


async def fulfill_ad_free_purchase(
    db: AsyncSession,
    player_id: UUID,
) -> bool:
    """Mark a player as ad-free after successful payment.

    Args:
        db: Database session.
        player_id: The player who purchased.

    Returns:
        True if player was updated, False if not found.
    """
    player = await db.get(Player, player_id)
    if not player:
        logger.warning("Cannot fulfill ad-free: player %s not found", player_id)
        return False

    player.ad_free = True
    await db.commit()
    logger.info("Player %s marked as ad-free", player_id)
    return True
