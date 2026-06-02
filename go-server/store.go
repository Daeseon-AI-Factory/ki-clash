package main

// Redis adapter — reads/writes the SAME keys as Python GameStore so both
// runtimes can serve concurrent traffic against the same data.
//
// Includes WATCH/MULTI/EXEC optimistic concurrency (DR-14) — both
// servers must use this pattern or they'll clobber each other's writes
// during simultaneous action submissions.

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

//go:embed submit_action.lua
var submitActionLua string

// Precompiled script — registers once, EVALSHA from then on.
var submitActionScript = redis.NewScript(submitActionLua)

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

// SubmitResult is the typed parse of the Lua script's mixed-shape return.
type SubmitResult struct {
	Status     string // "missing", "not_in_progress", "no_round", "unknown_action",
	//                 "not_in_game", "cant_afford", "stored", "resolve"
	TurnNumber int
	P1Action   Action
	P2Action   Action
	Ki         int // populated when Status == "cant_afford"
}

// submitActionAtomic stores a player's action in a single Redis round-trip
// via the Lua script (vs WATCH/MULTI/EXEC which is 2-3 round-trips + retry
// on conflict). Returns whether the caller must resolveTurn (both submitted).
func (s *Store) submitActionAtomic(
	ctx context.Context,
	gameID, playerID string,
	action Action,
) (SubmitResult, error) {
	res, err := submitActionScript.Run(
		ctx, s.rdb,
		[]string{GameKeyPrefix + gameID},
		playerID, string(action), GameTTLSeconds,
	).Result()
	if err != nil {
		return SubmitResult{}, fmt.Errorf("lua submit: %w", err)
	}
	arr, ok := res.([]interface{})
	if !ok || len(arr) == 0 {
		return SubmitResult{}, fmt.Errorf("unexpected lua return shape: %T", res)
	}
	status, _ := arr[0].(string)
	out := SubmitResult{Status: status}
	switch status {
	case "cant_afford":
		if len(arr) > 1 {
			if ki, ok := arr[1].(int64); ok {
				out.Ki = int(ki)
			}
		}
	case "stored":
		if len(arr) > 1 {
			if tn, ok := arr[1].(int64); ok {
				out.TurnNumber = int(tn)
			}
		}
	case "resolve":
		if len(arr) >= 4 {
			if tn, ok := arr[1].(int64); ok {
				out.TurnNumber = int(tn)
			}
			if p1, ok := arr[2].(string); ok {
				out.P1Action = Action(p1)
			}
			if p2, ok := arr[3].(string); ok {
				out.P2Action = Action(p2)
			}
		}
	}
	return out, nil
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
			watchRetriesTotal.Inc()
			continue
		}
		return nil, err
	}
	if lastErr == nil {
		lastErr = errTooManyWatchRetries
	}
	return nil, fmt.Errorf("%w: %v", errTooManyWatchRetries, lastErr)
}
