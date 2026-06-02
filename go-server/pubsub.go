package main

// Per-player Redis pub/sub (DR-13 port).
//
// Each connected player subscribes to `ki_clash:player:{player_id}`.
// When this server (or any other instance — Python, Go, anywhere)
// needs to push to a player it doesn't have locally, it PUBLISHes to
// that channel. The instance hosting the WebSocket relays the payload
// to its conn. Cross-runtime relay works because the JSON contract is
// shared.
//
// The PubSub layer holds (1) the inbound subscribers map keyed by
// player_id → connection, and (2) the Redis goroutine that fans out
// to listeners.

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/redis/go-redis/v9"
)

type ConnSink interface {
	WriteJSON(v any) error
}

type PubSub struct {
	rdb *redis.Client

	mu      sync.RWMutex
	locals  map[string]ConnSink            // player_id → local conn
	subs    map[string]*redis.PubSub       // player_id → redis sub
	cancels map[string]context.CancelFunc  // player_id → fan-out goroutine cancel
}

func newPubSub(rdb *redis.Client) *PubSub {
	return &PubSub{
		rdb:     rdb,
		locals:  make(map[string]ConnSink),
		subs:    make(map[string]*redis.PubSub),
		cancels: make(map[string]context.CancelFunc),
	}
}

func playerChannel(playerID string) string {
	return PlayerChannelPrefix + playerID
}

// register marks `playerID` as locally connected. Spawns the Redis
// subscribe loop so cross-server pushes for this player relay to the
// local conn.
func (p *PubSub) register(ctx context.Context, playerID string, conn ConnSink) {
	p.mu.Lock()
	// If a stale registration exists from a prior connection, unregister it.
	if cancel, ok := p.cancels[playerID]; ok {
		cancel()
	}
	if sub, ok := p.subs[playerID]; ok {
		_ = sub.Close()
	}

	subCtx, cancel := context.WithCancel(ctx)
	sub := p.rdb.Subscribe(subCtx, playerChannel(playerID))

	p.locals[playerID] = conn
	p.subs[playerID] = sub
	p.cancels[playerID] = cancel
	p.mu.Unlock()

	go p.relayLoop(subCtx, playerID, sub)
}

func (p *PubSub) unregister(playerID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if cancel, ok := p.cancels[playerID]; ok {
		cancel()
		delete(p.cancels, playerID)
	}
	if sub, ok := p.subs[playerID]; ok {
		_ = sub.Close()
		delete(p.subs, playerID)
	}
	delete(p.locals, playerID)
}

// isLocallyConnected returns true when this server holds the WS for `playerID`.
func (p *PubSub) isLocallyConnected(playerID string) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	_, ok := p.locals[playerID]
	return ok
}

// sendToPlayer delivers `msg` to `playerID`. If the conn is local we
// write directly; otherwise PUBLISH so whichever instance holds the WS
// can relay. Mirror of Python WSManager.send_to_player.
func (p *PubSub) sendToPlayer(ctx context.Context, playerID string, msg ServerMessage) error {
	p.mu.RLock()
	conn, local := p.locals[playerID]
	p.mu.RUnlock()
	if local {
		return conn.WriteJSON(msg)
	}
	payload, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return p.rdb.Publish(ctx, playerChannel(playerID), payload).Err()
}

// relayLoop forwards messages from the player's Redis channel to the
// locally-held WS. Exits when the subscriber context is cancelled.
func (p *PubSub) relayLoop(ctx context.Context, playerID string, sub *redis.PubSub) {
	ch := sub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case rmsg, ok := <-ch:
			if !ok {
				return
			}
			p.mu.RLock()
			conn := p.locals[playerID]
			p.mu.RUnlock()
			if conn == nil {
				continue
			}
			var envelope ServerMessage
			if err := json.Unmarshal([]byte(rmsg.Payload), &envelope); err != nil {
				slog.Warn("pubsub_bad_payload", "err", err, "player_id", playerID)
				continue
			}
			if err := conn.WriteJSON(envelope); err != nil {
				slog.Warn("pubsub_relay_write_failed", "err", err, "player_id", playerID)
			}
		}
	}
}
