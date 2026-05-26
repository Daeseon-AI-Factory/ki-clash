"""Tests for the structured JSON logging formatter."""

from __future__ import annotations

import json
import logging
from io import StringIO

import pytest

from app.core.logging import JsonFormatter, configure_logging


@pytest.fixture
def captured_log() -> tuple[logging.Logger, StringIO]:
    """Logger with a StringIO sink and the JSON formatter attached."""
    logger = logging.getLogger("ki_clash.test")
    logger.setLevel(logging.DEBUG)
    # Remove inherited handlers so root config doesn't double-emit
    logger.propagate = False
    for h in list(logger.handlers):
        logger.removeHandler(h)

    stream = StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)

    yield logger, stream

    logger.removeHandler(handler)


def _parse_log_line(stream: StringIO) -> dict:
    """Strip trailing newline + parse the single emitted JSON line."""
    return json.loads(stream.getvalue().strip())


class TestJsonFormatter:
    def test_basic_record_includes_standard_fields(
        self,
        captured_log: tuple[logging.Logger, StringIO],
    ) -> None:
        logger, stream = captured_log
        logger.info("hello world")
        payload = _parse_log_line(stream)
        assert payload["level"] == "INFO"
        assert payload["logger"] == "ki_clash.test"
        assert payload["message"] == "hello world"
        assert "timestamp" in payload
        assert "module" in payload
        assert "function" in payload
        assert "line" in payload

    def test_extra_fields_appear_in_payload(
        self,
        captured_log: tuple[logging.Logger, StringIO],
    ) -> None:
        logger, stream = captured_log
        logger.info(
            "match_found",
            extra={"game_id": "abc-123", "p1": "Alice", "p2": "Bob"},
        )
        payload = _parse_log_line(stream)
        assert payload["message"] == "match_found"
        assert payload["game_id"] == "abc-123"
        assert payload["p1"] == "Alice"
        assert payload["p2"] == "Bob"

    def test_printf_interpolation_lands_in_message(
        self,
        captured_log: tuple[logging.Logger, StringIO],
    ) -> None:
        logger, stream = captured_log
        logger.info("Player %s joined queue", "alice")
        payload = _parse_log_line(stream)
        assert payload["message"] == "Player alice joined queue"

    def test_exception_traceback_serialized(
        self,
        captured_log: tuple[logging.Logger, StringIO],
    ) -> None:
        logger, stream = captured_log
        try:
            raise ValueError("boom")
        except ValueError:
            logger.exception("something failed")
        payload = _parse_log_line(stream)
        assert "exception" in payload
        assert "ValueError: boom" in payload["exception"]

    def test_non_serializable_values_coerced_via_str(
        self,
        captured_log: tuple[logging.Logger, StringIO],
    ) -> None:
        """UUIDs, datetimes, sets — anything json can't natively handle —
        should fall back to str() rather than raising."""
        from uuid import uuid4
        logger, stream = captured_log
        uid = uuid4()
        logger.info("created", extra={"player_id": uid, "tags": {"a", "b"}})
        payload = _parse_log_line(stream)
        assert payload["player_id"] == str(uid)
        # set rendered as str — order non-deterministic, just check membership
        assert "a" in payload["tags"] and "b" in payload["tags"]


class TestConfigureLogging:
    def test_idempotent_handler_replacement(self) -> None:
        """Calling configure_logging twice should not stack handlers."""
        configure_logging(json_mode=True, level="INFO")
        first_handler_count = len(logging.getLogger().handlers)
        configure_logging(json_mode=True, level="INFO")
        assert len(logging.getLogger().handlers) == first_handler_count

    def test_json_mode_attaches_json_formatter(self) -> None:
        configure_logging(json_mode=True, level="INFO")
        formatter = logging.getLogger().handlers[0].formatter
        assert isinstance(formatter, JsonFormatter)

    def test_human_mode_does_not_attach_json_formatter(self) -> None:
        configure_logging(json_mode=False, level="INFO")
        formatter = logging.getLogger().handlers[0].formatter
        assert not isinstance(formatter, JsonFormatter)
