package main

// Ki Clash — Go game server.
//
// Standalone WebSocket gateway for PvP game sessions. Reads/writes the
// SAME Redis state as the Python platform server (DR-15 — workers are
// stateless w.r.t. game state, so any number of language runtimes can
// serve the same game concurrently).
//
// Boundaries:
//   - Platform / auth / matchmaking / rooms / DB → still Python
//   - Hot path WebSocket game loop                → eventually Go
//
// Run alongside Python: both bind their own ports. A reverse proxy
// (Caddy/Nginx) routes /api/v1/ws/game/* to Go and everything else to
// Python. Until that switch, the Python /ws/game/* endpoint stays
// authoritative — this server proves the architecture works.

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
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

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

	handler := newWSHandler(store, jwtSecret)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":"ok","server":"go"}`))
	})
	mux.HandleFunc("/ws/game/", handler.gameWebsocket)
	mux.HandleFunc("/api/v1/ws/game/", handler.gameWebsocket)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Graceful shutdown on SIGINT/SIGTERM.
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

// parseRedisURL accepts redis://[:password@]host:port[/db] and decomposes it
// into the fields go-redis wants. Avoids pulling in a URL-parser dep for a
// fixed shape we control end-to-end.
func parseRedisURL(raw string) (addr, password string, db int, err error) {
	const prefix = "redis://"
	if !strings.HasPrefix(raw, prefix) {
		return "", "", 0, errors.New("REDIS_URL must start with redis://")
	}
	body := strings.TrimPrefix(raw, prefix)

	// Optional /db suffix.
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

	// Optional password@host
	if at := strings.LastIndex(body, "@"); at != -1 {
		password = body[:at]
		body = body[at+1:]
		// strip leading ":" if format was ":pwd@host"
		password = strings.TrimPrefix(password, ":")
	}

	addr = body
	return
}
