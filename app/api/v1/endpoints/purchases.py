"""Purchase endpoints — ad-free pass checkout and webhook."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.auth.dependencies import get_current_player
from app.core.payment import StripeHandler
from app.dependencies import get_db
from app.models.player import Player
from app.schemas.payment import (
    AdFreeStatusResponse,
    CheckoutRequest,
    CheckoutResponse,
)
from app.services import payment_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_stripe_handler() -> StripeHandler:
    """Create a StripeHandler from app settings."""
    return StripeHandler(
        secret_key=settings.stripe_secret_key,
        webhook_secret=settings.stripe_webhook_secret,
    )


@router.get("/ad-free-status", response_model=AdFreeStatusResponse)
async def get_ad_free_status(
    player: Player = Depends(get_current_player),
) -> AdFreeStatusResponse:
    """Check if the current player has the ad-free pass."""
    return AdFreeStatusResponse(ad_free=player.ad_free)


@router.post("/checkout/ad-free", response_model=CheckoutResponse)
async def create_ad_free_checkout(
    body: CheckoutRequest,
    player: Player = Depends(get_current_player),
) -> CheckoutResponse:
    """Create a Stripe checkout session for the ad-free pass."""
    handler = _get_stripe_handler()
    result = await payment_service.create_ad_free_checkout(
        stripe_handler=handler,
        price_id=settings.stripe_ad_free_price_id,
        player_id=player.id,
        player_email=player.email,
        success_url=body.success_url,
        cancel_url=body.cancel_url,
    )
    return CheckoutResponse(**result)


@router.post("/webhook/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Handle Stripe webhook events.

    Processes checkout.session.completed events to fulfill purchases.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    handler = _get_stripe_handler()
    event = handler.verify_webhook(payload, sig_header)

    if event is None:
        return Response(status_code=400, content="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})

        player_id_str = metadata.get("player_id")
        item = metadata.get("item")

        if player_id_str and item == "ad_free_pass":
            player_id = UUID(player_id_str)
            await payment_service.fulfill_ad_free_purchase(db, player_id)
            logger.info("Fulfilled ad-free purchase for player %s", player_id)

    return Response(status_code=200, content="OK")
