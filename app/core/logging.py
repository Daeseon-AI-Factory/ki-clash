# CORE_CANDIDATE
"""Structured logging configuration.

Produces JSON log lines for production (single-line JSON per record,
ready for ingestion by Datadog / Loki / Elasticsearch / Cloud Logging)
and human-readable format for local development.

Usage:
    from app.core.logging import configure_logging

    configure_logging(json_mode=not settings.debug)

To attach structured context to a log call, use the `extra` kwarg:

    logger.info(
        "match_found",
        extra={"game_id": str(game_id), "p1": p1_name, "p2": p2_name},
    )

Plain-format calls (`logger.info("Foo %s", bar)`) still work — their
interpolated message lands in the `message` field of the JSON record.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

# Standard LogRecord attributes that should NOT be re-emitted as user fields.
# Anything else in record.__dict__ is treated as caller-supplied context
# (typically from `extra=`).
_RESERVED_LOG_ATTRS: frozenset[str] = frozenset(
    {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "message", "module",
        "msecs", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "thread", "threadName", "taskName",
    }
)


class JsonFormatter(logging.Formatter):
    """Formats LogRecords as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack"] = self.formatStack(record.stack_info)

        # Caller-supplied context via `extra=`
        for key, value in record.__dict__.items():
            if key not in _RESERVED_LOG_ATTRS and not key.startswith("_"):
                payload[key] = value

        # default=str gracefully handles UUIDs, datetimes, sets, etc.
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(
    *,
    json_mode: bool = True,
    level: str = "INFO",
) -> None:
    """Install the chosen formatter on the root logger.

    Removes any existing handlers so calling this twice is idempotent.

    Args:
        json_mode: True → JSON output (production). False → human-readable
            (local dev). Choose based on whether logs are consumed by a
            human or an ingestion pipeline.
        level: Minimum log level. Accepts standard names (INFO, DEBUG, …).
    """
    root = logging.getLogger()
    root.setLevel(level.upper())

    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    if json_mode:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                datefmt="%H:%M:%S",
            )
        )
    root.addHandler(handler)

    # Quiet down noisy third-party loggers in dev. Production keeps INFO
    # for everything so we can debug from logs.
    if not json_mode:
        for noisy in ("uvicorn.access", "asyncio", "watchfiles.main"):
            logging.getLogger(noisy).setLevel("WARNING")
