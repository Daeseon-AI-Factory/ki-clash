package main

// PvP game session orchestration — ports app/modules/ki_clash/game_session.py.
//
// Stateless façade: every method takes game_id and operates on Redis
// session state (DR-15). Local timer-task state only — turn timeouts
// and disconnect timers. Timers self-cancel on fire by re-reading Redis,
// so cross-instance reconnect / cross-instance resolution is safe.

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

type Session struct {
	store  *Store
	pubsub *PubSub

	mu             sync.Mutex
	timeoutTasks   map[string]context.CancelFunc          // game_id → turn-timeout cancel
	disconnectTasks map[string]context.CancelFunc         // game_id|player_id → disconnect-forfeit cancel
}

func newSession(store *Store, pubsub *PubSub) *Session {
	return &Session{
		store:          store,
		pubsub:         pubsub,
		timeoutTasks:   make(map[string]context.CancelFunc),
		disconnectTasks: make(map[string]context.CancelFunc),
	}
}

// ─── Public entrypoints ──────────────────────────────────────────────

// handleConnect is called when a WS connects. Distinguishes first
// connect (silent) from reconnect (notify opponent + re-send state).
func (s *Session) handleConnect(ctx context.Context, gameID, playerID string) {
	var (
		opponent    string
		isReconnect bool
	)
	sess, err := s.store.watchAndUpdate(ctx, gameID, func(sess *PvPSession) error {
		if !sess.IsPlayer(playerID) {
			return fmt.Errorf("not a player in this game")
		}
		if sess.HasConnected(playerID) {
			isReconnect = true
			if playerID == sess.Player1ID {
				opponent = sess.Player2ID
			} else {
				opponent = sess.Player1ID
			}
		} else {
			sess.MarkConnected(playerID)
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, errGameNotFound) {
			_ = s.pubsub.sendToPlayer(ctx, playerID, errorMsg("Game not found"))
		}
		return
	}

	if isReconnect {
		// Cancel any local disconnect timer for this player.
		s.cancelDisconnectTimer(gameID, playerID)
		_ = s.pubsub.sendToPlayer(ctx, opponent, opponentReconnectedMsg())
		if sess.GameState.Status == MatchInProgress {
			s.sendWaitingForAction(ctx, sess)
		}
		slog.Info("player_reconnected", "game_id", gameID, "player_id", playerID)
	}
}

// start is idempotent — fires the first waiting_for_action only on first call.
func (s *Session) start(ctx context.Context, gameID string) {
	var alreadyStarted bool
	sess, err := s.store.watchAndUpdate(ctx, gameID, func(sess *PvPSession) error {
		if sess.Started {
			alreadyStarted = true
			return nil
		}
		sess.Started = true
		return nil
	})
	if err != nil {
		slog.Warn("start_failed", "err", err, "game_id", gameID)
		return
	}
	if alreadyStarted {
		return
	}
	s.sendWaitingForAction(ctx, sess)
}

// submitAction stores the player's action, resolves the turn if both
// have submitted. Atomic via watchAndUpdate (DR-14).
func (s *Session) submitAction(ctx context.Context, gameID, playerID string, action Action) {
	var (
		validationErr string
		shouldResolve bool
		p1ToResolve   Action
		p2ToResolve   Action
		confirmedTurn int
	)

	_, err := s.store.watchAndUpdate(ctx, gameID, func(sess *PvPSession) error {
		if sess.GameState.Status != MatchInProgress {
			validationErr = "Game is not in progress"
			return nil
		}
		cr := sess.GameState.CurrentRound
		if cr == nil {
			validationErr = "Round not active"
			return nil
		}
		ki := cr.P1Ki
		if playerID == sess.Player2ID {
			ki = cr.P2Ki
		}
		if !validateAction(action, ki) {
			validationErr = fmt.Sprintf("Cannot afford %s (ki=%d)", action, ki)
			return nil
		}

		if playerID == sess.Player1ID {
			sess.P1Action = &action
		} else if playerID == sess.Player2ID {
			sess.P2Action = &action
		} else {
			validationErr = "Not a player in this game"
			return nil
		}
		confirmedTurn = cr.TurnNumber + 1

		if sess.P1Action != nil && sess.P2Action != nil {
			shouldResolve = true
			p1ToResolve = *sess.P1Action
			p2ToResolve = *sess.P2Action
			sess.P1Action = nil
			sess.P2Action = nil
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, errGameNotFound) {
			_ = s.pubsub.sendToPlayer(ctx, playerID, errorMsg("Game not found"))
		} else {
			slog.Warn("submit_action_failed", "err", err, "game_id", gameID, "player_id", playerID)
			_ = s.pubsub.sendToPlayer(ctx, playerID, errorMsg("Internal error"))
		}
		return
	}

	if validationErr != "" {
		_ = s.pubsub.sendToPlayer(ctx, playerID, errorMsg(validationErr))
		return
	}

	_ = s.pubsub.sendToPlayer(ctx, playerID, actionConfirmedMsg(confirmedTurn, action))

	if shouldResolve {
		s.resolveTurn(ctx, gameID, p1ToResolve, p2ToResolve)
	}
}

// handleDisconnect kicks off the 30-second forfeit timer + notifies opponent.
func (s *Session) handleDisconnect(ctx context.Context, gameID, playerID string) {
	sess, err := s.store.loadSession(ctx, gameID)
	if err != nil || sess == nil {
		return
	}
	opponent := sess.Player2ID
	if playerID == sess.Player2ID {
		opponent = sess.Player1ID
	}
	_ = s.pubsub.sendToPlayer(ctx, opponent, opponentDisconnectedMsg(DisconnectTimeoutSec))

	// Schedule the forfeit timer. Cross-instance reconnect is detected on fire
	// by checking pubsub.isLocallyConnected — if the player reconnects to a
	// different instance, the new instance updates connected_players and the
	// timer becomes a no-op when it re-reads state.
	tctx, cancel := context.WithCancel(context.Background())
	s.mu.Lock()
	if prev, ok := s.disconnectTasks[disconnectKey(gameID, playerID)]; ok {
		prev()
	}
	s.disconnectTasks[disconnectKey(gameID, playerID)] = cancel
	s.mu.Unlock()
	go s.forfeitAfterTimeout(tctx, gameID, playerID, opponent)
}

// ─── Internal helpers ────────────────────────────────────────────────

func (s *Session) resolveTurn(ctx context.Context, gameID string, p1, p2 Action) {
	var (
		turnResult  TurnResult
		roundResult *RoundResult
		matchResult *MatchResult
	)
	sess, err := s.store.watchAndUpdate(ctx, gameID, func(sess *PvPSession) error {
		tr, rr, mr, e := submitTurn(&sess.GameState, p1, p2)
		if e != nil {
			return e
		}
		turnResult = tr
		roundResult = rr
		matchResult = mr
		return nil
	})
	if err != nil {
		slog.Warn("resolve_turn_failed", "err", err, "game_id", gameID)
		return
	}

	// Cancel any pending turn timeout — turn is resolved.
	s.cancelTurnTimeout(gameID)

	p1id, p2id := sess.Player1ID, sess.Player2ID
	outcome := string(turnResult.Outcome)
	_ = s.pubsub.sendToPlayer(ctx, p1id, turnResultMsg(
		turnResult.TurnNumber, turnResult.P1Action, turnResult.P2Action,
		flipOutcomeFor(outcome, "p1"),
		turnResult.P1KiAfter, turnResult.P2KiAfter,
	))
	_ = s.pubsub.sendToPlayer(ctx, p2id, turnResultMsg(
		turnResult.TurnNumber, turnResult.P2Action, turnResult.P1Action,
		flipOutcomeFor(outcome, "p2"),
		turnResult.P2KiAfter, turnResult.P1KiAfter,
	))

	if roundResult != nil {
		for _, pid := range []string{p1id, p2id} {
			_ = s.pubsub.sendToPlayer(ctx, pid, roundResultMsg(
				roundResult.RoundNumber,
				winnerLabelFor(roundResult.Winner, pid, p1id),
				roundResult.TotalTurns,
			))
		}
	}

	if matchResult != nil {
		for _, pid := range []string{p1id, p2id} {
			_ = s.pubsub.sendToPlayer(ctx, pid, matchResultMsg(
				winnerLabelFor(matchResult.Winner, pid, p1id),
				matchResult.RoundsWonP1, matchResult.RoundsWonP2,
				matchResult.TotalTurns,
			))
		}
		return
	}

	// Brief animation gap, then prompt the next turn. Slightly longer
	// after a round transition to let the round-end UI breathe.
	pause := 1500 * time.Millisecond
	if roundResult != nil {
		pause = 2000 * time.Millisecond
	}
	time.Sleep(pause)

	fresh, err := s.store.loadSession(ctx, gameID)
	if err == nil && fresh != nil && fresh.GameState.Status == MatchInProgress {
		s.sendWaitingForAction(ctx, fresh)
	}
}

func (s *Session) sendWaitingForAction(ctx context.Context, sess *PvPSession) {
	cr := sess.GameState.CurrentRound
	if cr == nil {
		return
	}
	// Personalize ki labels per side so {p1_ki, p2_ki} reads as
	// {your_ki, opponent_ki} on each end.
	_ = s.pubsub.sendToPlayer(ctx, sess.Player1ID,
		waitingForActionMsg(cr.TurnNumber+1, TurnTimeLimitSeconds, cr.RoundNumber, cr.P1Ki, cr.P2Ki))
	_ = s.pubsub.sendToPlayer(ctx, sess.Player2ID,
		waitingForActionMsg(cr.TurnNumber+1, TurnTimeLimitSeconds, cr.RoundNumber, cr.P2Ki, cr.P1Ki))

	s.startTurnTimeout(sess.GameState.GameID)
}

func (s *Session) startTurnTimeout(gameID string) {
	s.cancelTurnTimeout(gameID)
	ctx, cancel := context.WithCancel(context.Background())
	s.mu.Lock()
	s.timeoutTasks[gameID] = cancel
	s.mu.Unlock()
	go s.turnTimeoutLoop(ctx, gameID)
}

func (s *Session) cancelTurnTimeout(gameID string) {
	s.mu.Lock()
	if cancel, ok := s.timeoutTasks[gameID]; ok {
		cancel()
		delete(s.timeoutTasks, gameID)
	}
	s.mu.Unlock()
}

func (s *Session) turnTimeoutLoop(ctx context.Context, gameID string) {
	select {
	case <-ctx.Done():
		return
	case <-time.After(TurnTimeLimitSeconds * time.Second):
	}
	// Re-read on fire — if some other server already resolved, this is a no-op.
	loadCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	sess, err := s.store.loadSession(loadCtx, gameID)
	if err != nil || sess == nil || sess.GameState.Status != MatchInProgress {
		return
	}
	p1Needs := sess.P1Action == nil
	p2Needs := sess.P2Action == nil
	if !p1Needs && !p2Needs {
		return
	}
	if p1Needs {
		s.submitAction(loadCtx, gameID, sess.Player1ID, DefaultTimeoutAction)
	}
	if p2Needs {
		s.submitAction(loadCtx, gameID, sess.Player2ID, DefaultTimeoutAction)
	}
}

func disconnectKey(gameID, playerID string) string {
	return gameID + "|" + playerID
}

func (s *Session) cancelDisconnectTimer(gameID, playerID string) {
	s.mu.Lock()
	if cancel, ok := s.disconnectTasks[disconnectKey(gameID, playerID)]; ok {
		cancel()
		delete(s.disconnectTasks, disconnectKey(gameID, playerID))
	}
	s.mu.Unlock()
}

func (s *Session) forfeitAfterTimeout(ctx context.Context, gameID, disconnected, opponent string) {
	select {
	case <-ctx.Done():
		return
	case <-time.After(DisconnectTimeoutSec * time.Second):
	}
	// Local presence wins — if they reconnected here, abort.
	if s.pubsub.isLocallyConnected(disconnected) {
		return
	}
	loadCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	sess, err := s.store.loadSession(loadCtx, gameID)
	if err != nil || sess == nil || sess.GameState.Status != MatchInProgress {
		return
	}
	// Forfeit — opponent wins.
	forfeitWinner := WinnerP2
	if disconnected == sess.Player2ID {
		forfeitWinner = WinnerP1
	}
	_, _ = s.store.watchAndUpdate(loadCtx, gameID, func(sess *PvPSession) error {
		sess.GameState.Status = MatchAbandoned
		return nil
	})

	// Notify opponent with a match_result envelope.
	totalTurns := 0
	for _, rr := range sess.GameState.RoundResults {
		totalTurns += rr.TotalTurns
	}
	_ = s.pubsub.sendToPlayer(loadCtx, opponent, matchResultMsg(
		winnerLabelFor(forfeitWinner, opponent, sess.Player1ID),
		sess.GameState.RoundsWonP1, sess.GameState.RoundsWonP2, totalTurns,
	))
	slog.Info("player_forfeited", "game_id", gameID, "player_id", disconnected)
}
