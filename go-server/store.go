package main

// Redis adapter — reads/writes the SAME keys as Python GameStore so both
// runtimes can serve concurrent traffic against the same data.
//
// Includes WATCH/MULTI/EXEC optimistic concurrency (DR-14) — both
// servers must use this pattern or they'll clobber each other's writes
// during simultaneous action submissions.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	errGameNotFound        = errors.New("game not found")
	errTooManyWatchRetries = errors.New("too many WATCH conflicts")
)

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

func (s *Store) close() error { return s.rdb.Close() }

func (s *Store) loadSession(ctx context.Context, gameID string) (*PvPSession, error) {
	raw, err := s.rdb.Get(ctx, GameKeyPrefix+gameID).Bytes()
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

func (s *Store) saveSession(ctx context.Context, sess *PvPSession) error {
	raw, err := json.Marshal(sess)
	if err != nil {
		return fmt.Errorf("session marshal: %w", err)
	}
	return s.rdb.Set(ctx, GameKeyPrefix+sess.GameState.GameID, raw, GameTTLSeconds*time.Second).Err()
}

// watchAndUpdate is the canonical mutate-then-save with optimistic
// concurrency. Mirror of Python GameStore.watch_and_update (DR-14).
//
// `mutator` mutates the loaded session in place. If it returns an error,
// the transaction is aborted and the error bubbles up.
func (s *Store) watchAndUpdate(
	ctx context.Context,
	gameID string,
	mutator func(*PvPSession) error,
) (*PvPSession, error) {
	key := GameKeyPrefix + gameID
	var lastErr error

	for attempt := 0; attempt < DefaultMaxWatchRetries; attempt++ {
		err := s.rdb.Watch(ctx, func(tx *redis.Tx) error {
			raw, err := tx.Get(ctx, key).Bytes()
			if err == redis.Nil {
				return errGameNotFound
			}
			if err != nil {
				return err
			}
			var sess PvPSession
			if err := json.Unmarshal(raw, &sess); err != nil {
				return fmt.Errorf("session unmarshal: %w", err)
			}
			if err := mutator(&sess); err != nil {
				return err
			}
			out, err := json.Marshal(&sess)
			if err != nil {
				return err
			}
			_, txErr := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.Set(ctx, key, out, GameTTLSeconds*time.Second)
				return nil
			})
			return txErr
		}, key)

		if err == nil {
			// Load the persisted state (Watch closure doesn't return the session).
			return s.loadSession(ctx, gameID)
		}
		if errors.Is(err, redis.TxFailedErr) {
			lastErr = err
			continue
		}
		return nil, err
	}
	if lastErr == nil {
		lastErr = errTooManyWatchRetries
	}
	return nil, fmt.Errorf("%w: %v", errTooManyWatchRetries, lastErr)
}
