package main

// Observability — Prometheus metrics + Sentry error tracking.
//
// Both are opt-in via env vars:
//   - /metrics endpoint is always exposed (cheap)
//   - Sentry only initialized when SENTRY_DSN is set
//
// Counters keep cardinality bounded — no per-game-id or per-player-id
// labels (those would explode metric storage). For per-game debugging,
// rely on structured slog output + Sentry traces.

import (
	"log/slog"
	"net/http"
	"os"
	"runtime/debug"
	"time"

	sentry "github.com/getsentry/sentry-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	wsConnectionsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "ki_clash_go_ws_connections_total",
		Help: "WebSocket connections accepted (after auth + game lookup).",
	})
	actionsSubmittedTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "ki_clash_go_actions_submitted_total",
		Help: "Player actions accepted by submit_action (post-validation).",
	}, []string{"action"})
	turnsResolvedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "ki_clash_go_turns_resolved_total",
		Help: "Turns where both players submitted and the engine produced a result.",
	})
	roundsCompletedTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "ki_clash_go_rounds_completed_total",
		Help: "Rounds completed, labelled by winner.",
	}, []string{"winner"})
	matchesCompletedTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "ki_clash_go_matches_completed_total",
		Help: "Matches completed, labelled by winner.",
	}, []string{"winner"})
	forfeitsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "ki_clash_go_forfeits_total",
		Help: "Matches ended via 30s disconnect forfeit timer.",
	})
	watchRetriesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "ki_clash_go_watch_retries_total",
		Help: "WATCH/MULTI/EXEC retries — high values indicate contention.",
	})
	submitActionLatency = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "ki_clash_go_submit_action_seconds",
		Help:    "End-to-end latency of submit_action (validation + store + maybe resolve).",
		Buckets: prometheus.ExponentialBuckets(0.001, 2, 10), // 1ms → ~1s
	})
)

func init() {
	prometheus.MustRegister(
		wsConnectionsTotal,
		actionsSubmittedTotal,
		turnsResolvedTotal,
		roundsCompletedTotal,
		matchesCompletedTotal,
		forfeitsTotal,
		watchRetriesTotal,
		submitActionLatency,
	)
}

func metricsHandler() http.Handler {
	return promhttp.Handler()
}

// initSentry — no-op if SENTRY_DSN unset. Mirror of Python init_sentry.
func initSentry(release, environment string) {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		slog.Info("sentry_disabled_no_dsn")
		return
	}
	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Release:          release,
		Environment:      environment,
		TracesSampleRate: 0.0, // counters via Prometheus; no APM by default
		AttachStacktrace: true,
	})
	if err != nil {
		slog.Warn("sentry_init_failed", "err", err)
		return
	}
	slog.Info("sentry_enabled", "environment", environment, "release", release)
}

// recoverAndReport recovers from a panic, reports to Sentry (if enabled),
// and re-logs the trace via slog. Use in goroutines spawned from request
// handlers so a single crash doesn't kill the whole server.
func recoverAndReport(label string) {
	if r := recover(); r != nil {
		stack := debug.Stack()
		slog.Error("panic", "label", label, "value", r, "stack", string(stack))
		if hub := sentry.CurrentHub(); hub != nil && hub.Client() != nil {
			sentry.CurrentHub().Recover(r)
			sentry.Flush(2 * time.Second)
		}
	}
}
