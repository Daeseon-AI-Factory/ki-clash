"""Tests for the observability module (Sentry init + Prometheus metrics)."""

from __future__ import annotations

import pytest

from app.core.observability import (
    ACTIVE_PVP_MATCHES,
    MATCHES_COMPLETED_TOTAL,
    MATCHES_STARTED_TOTAL,
    MATCHMAKING_QUEUE_SIZE,
    TURN_RESOLUTION_SECONDS,
    init_sentry,
    metrics_payload,
    prometheus_available,
    sentry_available,
)


class TestSentryInit:
    def test_init_with_empty_dsn_returns_false(self) -> None:
        """No DSN → init is a no-op."""
        assert init_sentry(dsn="", environment="test") is False

    def test_init_with_dsn_returns_true_when_sdk_available(self) -> None:
        """A valid-format DSN → init succeeds.

        Uses a syntactically valid Sentry DSN (Glitchtip-compatible
        example) — Sentry SDK validates format but doesn't connect at
        init time, so no network needed.
        """
        if not sentry_available():
            pytest.skip("sentry-sdk not installed")
        dsn = "https://public@o0.ingest.sentry.io/0"
        assert init_sentry(dsn=dsn, environment="test") is True


class TestPrometheusMetrics:
    def test_counter_increments(self) -> None:
        """Counters should support .labels(...).inc() without error."""
        MATCHES_STARTED_TOTAL.labels(match_type="ai_easy").inc()
        # No assert needed — call succeeding without raising is the test

    def test_counter_with_multiple_labels(self) -> None:
        MATCHES_COMPLETED_TOTAL.labels(match_type="pvp", result="p1").inc()

    def test_gauge_set(self) -> None:
        ACTIVE_PVP_MATCHES.set(5)
        MATCHMAKING_QUEUE_SIZE.set(12)

    def test_histogram_observe(self) -> None:
        TURN_RESOLUTION_SECONDS.observe(0.025)

    def test_metrics_payload_returns_bytes_and_content_type(self) -> None:
        body, content_type = metrics_payload()
        assert isinstance(body, bytes)
        assert isinstance(content_type, str)
        assert "text/plain" in content_type

    def test_metrics_payload_includes_known_metric_when_available(self) -> None:
        if not prometheus_available():
            pytest.skip("prometheus-client not installed")
        # Touch a counter so it appears in output
        MATCHES_STARTED_TOTAL.labels(match_type="pvp").inc()
        body, _ = metrics_payload()
        text = body.decode("utf-8")
        assert "ki_clash_matches_started_total" in text


class TestGracefulDegradation:
    def test_helpers_report_availability_consistently(self) -> None:
        """Helpers report the actual import state without raising."""
        # Just calling them should not raise
        sentry_available()
        prometheus_available()
