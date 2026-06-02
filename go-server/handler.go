package main

// WebSocket handler — bridges a player's WS connection to the Session
// orchestration layer. Mirror of app/api/v1/endpoints/ws.py.

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type wsHandler struct {
	store   *Store
	pubsub  *PubSub
	session *Session
	secret  string
}

func newWSHandler(store *Store, pubsub *PubSub, session *Session, secret string) *wsHandler {
	return &wsHandler{store: store, pubsub: pubsub, session: session, secret: secret}
}

// safeConn wraps a websocket.Conn with a write mutex so concurrent
// goroutines (pubsub relay + main read loop + heartbeat) can't interleave
// writes (which corrupts the WS frame protocol).
type safeConn struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (c *safeConn) WriteJSON(v any) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
}

func (c *safeConn) WriteControl(messageType int, data []byte, deadline time.Time) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteControl(messageType, data, deadline)
}

func (h *wsHandler) gameWebsocket(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) == 0 {
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

	authCtx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	sess, err := h.store.loadSession(authCtx, gameID)
	cancel()
	if err != nil {
		if errors.Is(err, errGameNotFound) {
			http.Error(w, "game not found", http.StatusNotFound)
			return
		}
		slog.Error("session_load", "err", err, "game_id", gameID)
		http.Error(w, "internal", http.StatusInternalServerError)
		return
	}
	if !sess.IsPlayer(playerID) {
		http.Error(w, "not a player in this game", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws_upgrade", "err", err)
		return
	}
	sc := &safeConn{conn: conn}

	// Subscribe to per-player Redis channel for cross-instance pushes.
	sessionCtx, sessionCancel := context.WithCancel(context.Background())
	defer sessionCancel()
	h.pubsub.register(sessionCtx, playerID, sc)
	defer h.pubsub.unregister(playerID)

	slog.Info("ws_connected",
		"game_id", gameID,
		"player_id", playerID,
	)

	// Distinguish first-connect from reconnect + (idempotent) start the game.
	h.session.handleConnect(sessionCtx, gameID, playerID)
	h.session.start(sessionCtx, gameID)

	// Heartbeat.
	stopHeartbeat := make(chan struct{})
	defer close(stopHeartbeat)
	go func() {
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				_ = sc.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second))
			case <-stopHeartbeat:
				return
			}
		}
	}()

	// Read loop.
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				slog.Warn("ws_read_error", "err", err, "game_id", gameID, "player_id", playerID)
			}
			h.session.handleDisconnect(context.Background(), gameID, playerID)
			return
		}
		var client ClientMessage
		if err := json.Unmarshal(msg, &client); err != nil {
			slog.Warn("ws_bad_json", "err", err)
			continue
		}
		switch client.Type {
		case "ping":
			_ = sc.WriteJSON(pongMsg())
		case "submit_action":
			if client.Action == "" {
				_ = sc.WriteJSON(errorMsg("missing action"))
				continue
			}
			h.session.submitAction(context.Background(), gameID, playerID, Action(client.Action))
		default:
			slog.Debug("ws_unhandled", "type", client.Type)
		}
	}
}
