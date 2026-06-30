"""Purchase endpoints — ad-free pass checkout and webhook."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.auth.dependencies import get_current_player
from app.core.payment import LemonSqueezyHandler, StripeHandler
from app.dependencies import get_db
from app.exceptions import AppError
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


def _get_lemon_handler() -> LemonSqueezyHandler:
    """Create a LemonSqueezyHandler from app settings."""
    return LemonSqueezyHandler(
        api_key=settings.lemon_squeezy_api_key,
        store_id=settings.lemon_squeezy_store_id,
        founder_pass_variant_id=settings.lemon_squeezy_founder_pass_variant_id,
        webhook_secret=settings.lemon_squeezy_webhook_secret,
        test_mode=settings.lemon_squeezy_test_mode,
    )


def _lemon_meta(event: dict) -> dict:
    meta = event.get("meta")
    return meta if isinstance(meta, dict) else {}


def _lemon_attributes(event: dict) -> dict:
    data = event.get("data")
    if not isinstance(data, dict):
        return {}
    attributes = data.get("attributes")
    return attributes if isinstance(attributes, dict) else {}


def _lemon_custom_data(event: dict) -> dict:
    custom_data = _lemon_meta(event).get("custom_data")
    return custom_data if isinstance(custom_data, dict) else {}


def _is_founder_pass_order(event: dict) -> bool:
    """Return True only for the configured paid Founder Pass order."""
    attributes = _lemon_attributes(event)
    first_item = attributes.get("first_order_item")
    first_item = first_item if isinstance(first_item, dict) else {}
    variant_id = str(first_item.get("variant_id") or "")
    configured_variant_id = settings.lemon_squeezy_founder_pass_variant_id

    return (
        _lemon_meta(event).get("event_name") == "order_created"
        and attributes.get("status") == "paid"
        and bool(configured_variant_id)
        and variant_id == configured_variant_id
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


@router.post("/checkout/founder-pass", response_model=CheckoutResponse)
async def create_founder_pass_checkout(
    body: CheckoutRequest,
    player: Player = Depends(get_current_player),
) -> CheckoutResponse:
    """Create a Lemon Squeezy checkout for the Founder Pass."""
    handler = _get_lemon_handler()
    try:
        result = await payment_service.create_founder_pass_checkout(
            lemon_handler=handler,
            player_id=player.id,
            player_email=player.email,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    except RuntimeError as error:
        logger.warning("Founder Pass checkout unavailable: %s", error)
        raise AppError(
            code="checkout_unavailable",
            message="Founder Pass checkout is not available right now.",
            status_code=503,
        ) from error

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


@router.post("/webhook/lemonsqueezy")
async def lemon_squeezy_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Handle Lemon Squeezy webhook events for Founder Pass purchases."""
    payload = await request.body()
    signature = request.headers.get("x-signature", "")

    handler = _get_lemon_handler()
    event = handler.verify_webhook(payload, signature)

    if event is None:
        return Response(status_code=400, content="Invalid signature")

    if not _is_founder_pass_order(event):
        return Response(status_code=200, content="OK")

    custom_data = _lemon_custom_data(event)
    if (
        custom_data.get("item") != "founder_pass"
        or custom_data.get("entitlement") != "ad_free"
    ):
        logger.warning("Ignoring Lemon Squeezy order with unexpected custom data")
        return Response(status_code=200, content="OK")

    player_id_str = custom_data.get("player_id")
    if not isinstance(player_id_str, str):
        logger.warning("Ignoring Lemon Squeezy order without player_id")
        return Response(status_code=200, content="OK")

    try:
        player_id = UUID(player_id_str)
    except ValueError:
        logger.warning("Ignoring Lemon Squeezy order with invalid player_id")
        return Response(status_code=200, content="OK")

    await payment_service.fulfill_ad_free_purchase(db, player_id)
    logger.info("Fulfilled Founder Pass purchase for player %s", player_id)

    return Response(status_code=200, content="OK")
