# CORE_CANDIDATE
"""Lemon Squeezy payment handler — hosted checkout and webhook verification."""

import asyncio
import hashlib
import hmac
import json
import logging
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

LEMON_API_URL = "https://api.lemonsqueezy.com/v1/checkouts"


class LemonSqueezyHandler:
    """Handles Lemon Squeezy checkout creation and webhook verification."""

    def __init__(
        self,
        api_key: str,
        store_id: str,
        founder_pass_variant_id: str,
        webhook_secret: str,
        test_mode: bool,
    ) -> None:
        self._api_key = api_key
        self._store_id = store_id
        self._founder_pass_variant_id = founder_pass_variant_id
        self._webhook_secret = webhook_secret
        self._test_mode = test_mode

    def _require_checkout_config(self) -> None:
        missing = [
            name
            for name, value in {
                "LEMON_SQUEEZY_API_KEY": self._api_key,
                "LEMON_SQUEEZY_STORE_ID": self._store_id,
                "LEMON_SQUEEZY_FOUNDER_PASS_VARIANT_ID": self._founder_pass_variant_id,
            }.items()
            if not value
        ]
        if missing:
            raise RuntimeError(
                "Lemon Squeezy checkout is not configured: "
                f"{', '.join(missing)}"
            )

    def _require_webhook_config(self) -> None:
        if not self._webhook_secret:
            raise RuntimeError("Lemon Squeezy webhook secret is not configured")

    def _founder_pass_variant_id_int(self) -> int:
        try:
            return int(self._founder_pass_variant_id)
        except ValueError as error:
            raise RuntimeError(
                "LEMON_SQUEEZY_FOUNDER_PASS_VARIANT_ID must be numeric"
            ) from error

    async def create_founder_pass_checkout(
        self,
        player_id: str,
        player_email: str | None,
        success_url: str,
        cancel_url: str,
    ) -> dict[str, str]:
        """Create a Lemon Squeezy hosted checkout for the Founder Pass."""
        self._require_checkout_config()
        variant_id = self._founder_pass_variant_id_int()

        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "product_options": {
                        "name": "JJAN! Founder Pass",
                        "description": (
                            "One-time launch support pass. Removes forced "
                            "interstitial ads and marks this player as a founder."
                        ),
                        "redirect_url": success_url,
                        "receipt_button_text": "Open JJAN!",
                        "receipt_link_url": success_url,
                        "receipt_thank_you_note": (
                            "Thanks for supporting JJAN! Ki Clash."
                        ),
                        "enabled_variants": [variant_id],
                    },
                    "checkout_options": {
                        "media": False,
                        "logo": True,
                        "desc": True,
                        "discount": True,
                        "button_color": "#FACC15",
                        "button_text_color": "#111827",
                        "background_color": "#0B0B14",
                        "headings_color": "#FFFFFF",
                        "primary_text_color": "#F8FAFC",
                        "secondary_text_color": "#94A3B8",
                        "links_color": "#67E8F9",
                        "borders_color": "#334155",
                        "locale": "ko",
                    },
                    "checkout_data": {
                        "email": player_email or "",
                        "custom": {
                            "player_id": player_id,
                            "item": "founder_pass",
                            "entitlement": "ad_free",
                        },
                    },
                    "test_mode": self._test_mode,
                },
                "relationships": {
                    "store": {
                        "data": {"type": "stores", "id": self._store_id},
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": self._founder_pass_variant_id,
                        },
                    },
                },
            }
        }

        response = await asyncio.to_thread(self._post_json, payload)
        data = response.get("data", {})
        attributes = data.get("attributes", {})
        checkout_url = attributes.get("url")
        checkout_id = data.get("id")

        if not isinstance(checkout_url, str) or not checkout_url:
            logger.error("Lemon Squeezy checkout response missing URL: %s", response)
            raise RuntimeError("Lemon Squeezy checkout response did not include a URL")

        return {
            "session_id": str(checkout_id or ""),
            "checkout_url": checkout_url,
        }

    def _post_json(self, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        request = Request(
            LEMON_API_URL,
            data=body,
            method="POST",
            headers={
                "Accept": "application/vnd.api+json",
                "Content-Type": "application/vnd.api+json",
                "Authorization": f"Bearer {self._api_key}",
            },
        )

        try:
            with urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            response_body = error.read().decode("utf-8", errors="replace")
            logger.warning(
                "Lemon Squeezy checkout API failed: status=%s body=%s",
                error.code,
                response_body,
            )
            raise RuntimeError("Lemon Squeezy checkout API failed") from error
        except (URLError, TimeoutError) as error:
            logger.warning("Lemon Squeezy checkout API unavailable: %s", error)
            raise RuntimeError("Lemon Squeezy checkout API unavailable") from error

    def verify_webhook(self, payload: bytes, signature: str) -> dict[str, Any] | None:
        """Verify Lemon Squeezy webhook signature and parse the payload."""
        try:
            self._require_webhook_config()
        except RuntimeError:
            logger.warning("Lemon Squeezy webhook received but secret is missing")
            return None

        if not signature:
            logger.warning("Lemon Squeezy webhook missing X-Signature header")
            return None

        digest = hmac.new(
            self._webhook_secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            logger.warning("Lemon Squeezy webhook signature verification failed")
            return None

        try:
            event = json.loads(payload.decode("utf-8"))
        except json.JSONDecodeError:
            logger.warning("Invalid Lemon Squeezy webhook payload")
            return None

        if not isinstance(event, dict):
            logger.warning("Unexpected Lemon Squeezy webhook payload type")
            return None

        return event
