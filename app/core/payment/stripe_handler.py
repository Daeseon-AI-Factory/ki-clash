# CORE_CANDIDATE
"""Stripe payment handler — checkout sessions and webhook processing.

Handles:
- Creating checkout sessions for one-time purchases (ad-free pass)
- Processing Stripe webhook events (payment confirmation)
- Verifying webhook signatures

Configuration:
- STRIPE_SECRET_KEY: Stripe secret API key
- STRIPE_WEBHOOK_SECRET: Webhook endpoint signing secret
- STRIPE_AD_FREE_PRICE_ID: Price ID for the ad-free pass product
"""

import logging
from typing import Any

import stripe

logger = logging.getLogger(__name__)


class StripeHandler:
    """Handles Stripe payment operations.

    All Stripe API calls go through this handler. Product-specific
    logic (what to do when payment succeeds) is handled by callers.
    """

    def __init__(
        self,
        secret_key: str,
        webhook_secret: str,
    ) -> None:
        self._webhook_secret = webhook_secret
        stripe.api_key = secret_key

    async def create_checkout_session(
        self,
        price_id: str,
        customer_email: str | None,
        metadata: dict[str, str],
        success_url: str,
        cancel_url: str,
    ) -> dict[str, str]:
        """Create a Stripe Checkout Session.

        Args:
            price_id: The Stripe Price ID for the product.
            customer_email: Optional email to pre-fill in checkout.
            metadata: Key-value pairs stored on the session (e.g., player_id).
            success_url: URL to redirect after successful payment.
            cancel_url: URL to redirect if customer cancels.

        Returns:
            Dict with session_id and checkout_url.
        """
        params: dict[str, Any] = {
            "mode": "payment",
            "line_items": [{"price": price_id, "quantity": 1}],
            "metadata": metadata,
            "success_url": success_url,
            "cancel_url": cancel_url,
        }

        if customer_email:
            params["customer_email"] = customer_email

        session = stripe.checkout.Session.create(**params)

        return {
            "session_id": session.id,
            "checkout_url": session.url or "",
        }

    def verify_webhook(
        self,
        payload: bytes,
        sig_header: str,
    ) -> dict | None:
        """Verify and parse a Stripe webhook event.

        Args:
            payload: Raw request body bytes.
            sig_header: Stripe-Signature header value.

        Returns:
            Parsed event dict, or None if verification fails.
        """
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self._webhook_secret
            )
            return event
        except stripe.SignatureVerificationError:
            logger.warning("Stripe webhook signature verification failed")
            return None
        except ValueError:
            logger.warning("Invalid Stripe webhook payload")
            return None
