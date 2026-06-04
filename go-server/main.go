package main

// Ki Clash — Go game server entry point.
//
// Boundaries:
//   - Auth / matchmaking / rooms / DB / Stripe → Python
//   - PvP WebSocket game loop                    → Go (this server)
//
// Both servers read/write the same Redis keys, so a single match can
// migrate between them mid-session (DR-15 stateless workers).

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
)

func main() {
	// Self-healthcheck mode: `ki-clash-go -healthcheck` hits /health and exits
	// 0/1. Lets the distroless image (no wget/curl/shell) run a Docker
	// HEALTHCHECK without extra tooling. Used by docker-compose.prod.yml.
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		port := envOrDefault("PORT", "8001")
		resp, err := http.Get("http://localhost:" + port + "/health")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	port := envOrDefault("PORT", "8001")
	redisURL := envOrDefault("REDIS_URL", "redis://localhost:6379/0")
	jwtSecret := os.Getenv("JWT_SECRET_KEY")
	if jwtSecret == "" {
		slog.Error("JWT_SECRET_KEY env var is required")
		os.Exit(1)
	}

	addr, password, db, err := parseRedisURL(redisURL)
	if err != nil {
		slog.Error("parse REDIS_URL", "err", err)
		os.Exit(1)
	}

	store, err := newStore(addr, password, db)
	if err != nil {
		slog.Error("redis connect", "err", err)
		os.Exit(1)
	}
	defer store.close()

	// Build the pub/sub layer on a separate connection — keeps the
	// blocking SUBSCRIBE loop off the main client pool.
	pubsubRDB := redis.NewClient(&redis.Options{Addr: addr, Password: password, DB: db})
	defer pubsubRDB.Close()

	ps := newPubSub(pubsubRDB)
	session := newSession(store, ps)
	handler := newWSHandler(store, ps, session, jwtSecret)

	initSentry(envOrDefault("RELEASE", "dev"), envOrDefault("ENVIRONMENT", "dev"))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":"ok","server":"go"}`))
	})
	mux.Handle("GET /metrics", metricsHandler())
	mux.HandleFunc("/ws/game/", handler.gameWebsocket)
	mux.HandleFunc("/api/v1/ws/game/", handler.gameWebsocket)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		slog.Info("shutdown_signal")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}()

	slog.Info("go_server_listening", "addr", srv.Addr, "redis", addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("listen", "err", err)
		os.Exit(1)
	}
}

func envOrDefault(key, dflt string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return dflt
}

func parseRedisURL(raw string) (addr, password string, db int, err error) {
	const prefix = "redis://"
	if !strings.HasPrefix(raw, prefix) {
		return "", "", 0, errors.New("REDIS_URL must start with redis://")
	}
	body := strings.TrimPrefix(raw, prefix)
	if idx := strings.LastIndex(body, "/"); idx != -1 {
		dbStr := body[idx+1:]
		body = body[:idx]
		if dbStr != "" {
			db, err = strconv.Atoi(dbStr)
			if err != nil {
				return "", "", 0, errors.New("invalid db index in REDIS_URL")
			}
		}
	}
	if at := strings.LastIndex(body, "@"); at != -1 {
		password = strings.TrimPrefix(body[:at], ":")
		body = body[at+1:]
	}
	addr = body
	return
}
