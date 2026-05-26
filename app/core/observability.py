# CORE_CANDIDATE
"""Observability — Sentry error tracking + Prometheus metrics.

Both are opt-in and degrade gracefully:
- Sentry only ships events when SENTRY_DSN is configured. Without a DSN,
  init() is a no-op (no events sent, no overhead).
- Prometheus metrics are always collected (cheap in-memory counters);
  the /metrics endpoint exposes them when scraped.

Imports are guarded with try/except so the application still boots even
if these packages are missing (e.g., a partial container rebuild after
pyproject.toml changed). Missing-package state is logged once on startup.
"""

from __future__ import annotations

import logging
from typing import Callable

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────────
# Sentry
# ────────────────────────────────────────────────────────────────────────────

try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    _SENTRY_AVAILABLE = True
except ImportError:
    _SENTRY_AVAILABLE = False
    sentry_sdk = None  # type: ignore[assignment]


def init_sentry(
    *,
    dsn: str,
    environment: str,
    traces_sample_rate: float = 0.1,
) -> bool:
    """Initialize Sentry SDK with FastAPI integration.

    Args:
        dsn: Sentry DSN. Empty string disables (no-op).
        environment: Environment tag (development/staging/production).
        traces_sample_rate: 0.0–1.0 — fraction of requests sampled for
            performance monitoring.

    Returns:
        True if Sentry was initialized, False otherwise.
    """
    if not _SENTRY_AVAILABLE:
        logger.info(
            "sentry-sdk not installed, error tracking disabled "
            "(install with: pip install 'sentry-sdk[fastapi]')"
        )
        return False
    if not dsn:
        logger.info("SENTRY_DSN not set, error tracking disabled")
        return False

    sentry_sdk.init(  # type: ignore[union-attr]
        dsn=dsn,
        environment=environment,
        traces_sample_rate=traces_sample_rate,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        send_default_pii=False,  # Don't auto-capture user identifiers
    )
    logger.info(
        "sentry initialized environment=%s traces_sample_rate=%s",
        environment, traces_sample_rate,
    )
    return True


# ────────────────────────────────────────────────────────────────────────────
# Prometheus metrics
# ────────────────────────────────────────────────────────────────────────────

try:
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        Counter,
        Gauge,
        Histogram,
        generate_latest,
    )

    _PROMETHEUS_AVAILABLE = True
except ImportError:
    _PROMETHEUS_AVAILABLE = False
    CONTENT_TYPE_LATEST = "text/plain"


# Metric definitions. Created at module load so they're singletons across
# the process (re-registering would fail).
if _PROMETHEUS_AVAILABLE:
    MATCHES_STARTED_TOTAL = Counter(
        "ki_clash_matches_started_total",
        "Total matches started since process boot",
        labelnames=["match_type"],  # ai_easy | ai_medium | ai_hard | pvp
    )
    MATCHES_COMPLETED_TOTAL = Counter(
        "ki_clash_matches_completed_total",
        "Total matches that reached a terminal state",
        labelnames=["match_type", "result"],  # result: p1 | p2 | draw | abandoned
    )
    ACTIVE_PVP_MATCHES = Gauge(
        "ki_clash_active_pvp_matches",
        "Currently running PvP matches",
    )
    MATCHMAKING_QUEUE_SIZE = Gauge(
        "ki_clash_matchmaking_queue_size",
        "Players currently waiting for a PvP match",
    )
    TURN_RESOLUTION_SECONDS = Histogram(
        "ki_clash_turn_resolution_seconds",
        "Wall-clock time from second submission to broadcast",
        buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
    )
else:  # graceful degradation — provide no-op stubs
    class _NoopMetric:
        def labels(self, *args, **kwargs) -> "_NoopMetric":  # noqa: D401, ANN001
            return self

        def inc(self, *args, **kwargs) -> None:  # noqa: ANN001
            pass

        def set(self, *args, **kwargs) -> None:  # noqa: ANN001, A003
            pass

        def observe(self, *args, **kwargs) -> None:  # noqa: ANN001
            pass

    MATCHES_STARTED_TOTAL = _NoopMetric()  # type: ignore[assignment]
    MATCHES_COMPLETED_TOTAL = _NoopMetric()  # type: ignore[assignment]
    ACTIVE_PVP_MATCHES = _NoopMetric()  # type: ignore[assignment]
    MATCHMAKING_QUEUE_SIZE = _NoopMetric()  # type: ignore[assignment]
    TURN_RESOLUTION_SECONDS = _NoopMetric()  # type: ignore[assignment]


def metrics_payload() -> tuple[bytes, str]:
    """Render the current metrics snapshot as the Prometheus exposition format.

    Returns:
        (body, content_type) suitable for an HTTP response.
    """
    if not _PROMETHEUS_AVAILABLE:
        return b"# prometheus-client not installed\n", "text/plain; version=0.0.4"
    return generate_latest(), CONTENT_TYPE_LATEST


def prometheus_available() -> bool:
    return _PROMETHEUS_AVAILABLE


def sentry_available() -> bool:
    return _SENTRY_AVAILABLE
