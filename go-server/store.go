package main

// Redis adapter — reads/writes the SAME keys as the Python GameStore so
// both servers can serve concurrent traffic against the same data.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	gameTTL      = time.Hour
	gameKeyPrefix = "ki_clash:game:"
)

var errGameNotFound = errors.New("game not found")

type Store struct {
	rdb *redis.Client
}

func newStore(addr, password string, db int) (*Store, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return &Store{rdb: rdb}, nil
}

func (s *Store) loadSession(ctx context.Context, gameID string) (*PvPSession, error) {
	raw, err := s.rdb.Get(ctx, gameKeyPrefix+gameID).Bytes()
	if err == redis.Nil {
		return nil, errGameNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("redis get: %w", err)
	}
	var sess PvPSession
	if err := json.Unmarshal(raw, &sess); err != nil {
		return nil, fmt.Errorf("session unmarshal: %w", err)
	}
	return &sess, nil
}

// saveSession persists the session JSON with the standard 1-hour TTL.
func (s *Store) saveSession(ctx context.Context, sess *PvPSession) error {
	raw, err := json.Marshal(sess)
	if err != nil {
		return fmt.Errorf("session marshal: %w", err)
	}
	return s.rdb.Set(ctx, gameKeyPrefix+sess.GameState.GameID, raw, gameTTL).Err()
}

func (s *Store) close() error {
	return s.rdb.Close()
}
