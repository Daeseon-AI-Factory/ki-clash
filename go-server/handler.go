package main

// WebSocket handler — connects a player to a PvP game session.
//
// Scope for this milestone: identify the player via JWT, load the session
// from Redis, push a `connected` envelope, and echo client `ping` messages
// as `pong`. Full game-loop wiring (turn arbitration, action submission,
// matchmaking) comes in the next milestone — the contract is established
// here so the Python and Go servers can run side-by-side.

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Trust the configured CORS origins; matches the Python server's
		// allow_origins behavior — Caddy will reject mismatched origins
		// before they hit us in production.
		return true
	},
}

type wsHandler struct {
	store    *Store
	secret   string
	pingFreq time.Duration
}

func newWSHandler(store *Store, secret string) *wsHandler {
	return &wsHandler{store: store, secret: secret, pingFreq: 25 * time.Second}
}

// gameWebsocket is the canonical endpoint: /ws/game/{game_id}?token=...
// (mirrors the Python URL so the frontend can swap servers transparently)
func (h *wsHandler) gameWebsocket(w http.ResponseWriter, r *http.Request) {
	// Path: /ws/game/{game_id}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "bad path", http.StatusBadRequest)
		return
	}
	gameID := parts[len(parts)-1]
	token := r.URL.Query().Get("token")

	playerID, err := verifyAccessToken(token, h.secret)
	if err != nil {
		http.Error(w, "unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	sess, err := h.store.loadSession(ctx, gameID)
	cancel()
	if err != nil {
		if errors.Is(err, errGameNotFound) {
			http.Error(w, "game not found", http.StatusNotFound)
			return
		}
		slog.Error("session load", "err", err, "game_id", gameID)
		http.Error(w, "internal", http.StatusInternalServerError)
		return
	}

	if sess.Player1ID != playerID && sess.Player2ID != playerID {
		http.Error(w, "not a player in this game", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade", "err", err)
		return
	}
	defer conn.Close()

	slog.Info("ws_connected",
		"game_id", gameID,
		"player_id", playerID,
		"player1", sess.Player1ID,
		"player2", sess.Player2ID,
	)

	// Welcome envelope so the client knows who we identified them as.
	_ = conn.WriteJSON(ServerMessage{
		Type: "go_server_connected",
		Data: map[string]string{
			"player_id": playerID,
			"game_id":   gameID,
			"server":    "go",
		},
	})

	// Heartbeat goroutine — periodic ping keeps proxies / NAT awake.
	stop := make(chan struct{})
	defer close(stop)
	go func() {
		ticker := time.NewTicker(h.pingFreq)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				_ = conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second))
			case <-stop:
				return
			}
		}
	}()

	// Read loop — for now we just echo `ping` → `pong` and log everything
	// else so end-to-end connectivity is verifiable before the full game
	// loop ports over.
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				slog.Warn("ws_read_error", "err", err, "game_id", gameID, "player_id", playerID)
			}
			return
		}
		var client ClientMessage
		if err := json.Unmarshal(msg, &client); err != nil {
			slog.Warn("ws_bad_json", "err", err, "raw", string(msg))
			continue
		}
		switch client.Type {
		case "ping":
			_ = conn.WriteJSON(ServerMessage{Type: "pong", Data: struct{}{}})
		case "submit_action":
			// TODO(milestone-2): port the engine — for now just echo so the
			// frontend dev can see the round-trip.
			_ = conn.WriteJSON(ServerMessage{
				Type: "action_received",
				Data: map[string]string{"action": client.Action, "server": "go"},
			})
		default:
			slog.Debug("ws_unhandled", "type", client.Type, "raw", string(msg))
		}
	}
}
