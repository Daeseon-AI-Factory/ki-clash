"""Tests for Lemon Squeezy checkout/webhook handler security."""

from __future__ import annotations

import hashlib
import hmac
import json

from app.core.payment import LemonSqueezyHandler


def _handler(secret: str = "test-secret") -> LemonSqueezyHandler:
    return LemonSqueezyHandler(
        api_key="api-key",
        store_id="123",
        founder_pass_variant_id="456",
        webhook_secret=secret,
        test_mode=True,
    )


def _signature(payload: bytes, secret: str = "test-secret") -> str:
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


class TestLemonSqueezyHandler:
    def test_verify_webhook_accepts_valid_signature(self) -> None:
        payload = json.dumps(
            {
                "meta": {
                    "event_name": "order_created",
                    "custom_data": {"player_id": "player-1"},
                }
            }
        ).encode("utf-8")

        event = _handler().verify_webhook(payload, _signature(payload))

        assert event is not None
        assert event["meta"]["event_name"] == "order_created"

    def test_verify_webhook_rejects_invalid_signature(self) -> None:
        payload = b'{"meta":{"event_name":"order_created"}}'

        assert _handler().verify_webhook(payload, "bad-signature") is None

    def test_verify_webhook_rejects_missing_secret(self) -> None:
        payload = b'{"meta":{"event_name":"order_created"}}'

        assert _handler(secret="").verify_webhook(payload, _signature(payload)) is None

    def test_verify_webhook_rejects_invalid_json(self) -> None:
        payload = b"not-json"

        assert _handler().verify_webhook(payload, _signature(payload)) is None

