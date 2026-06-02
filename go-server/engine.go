package main

// Pure game engine — ports outcome_matrix.py + engine.py.
//
// No I/O, no globals. Every function takes the GameState (or pieces of
// it) and returns either a new value or applies mutation locally.
// Matches the Python contract byte-for-byte so AI-mode replays and PvP
// histories stay portable.

import (
	"fmt"

	"github.com/google/uuid"
)

// outcomeMatrix[p1][p2] = outcome from P1's perspective. Mirror of
// _MATRIX in app/core/game_engine/outcome_matrix.py.
var outcomeMatrix = map[Action]map[Action]TurnOutcome{
	ActionCharge: {
		ActionCharge:     OutcomeNeutral,
		ActionBlock:      OutcomeNeutral,
		ActionAttack:     OutcomeP2WinsRound,
		ActionEnergyWave: OutcomeP2WinsRound,
		ActionTeleport:   OutcomeNeutral,
	},
	ActionBlock: {
		ActionCharge:     OutcomeNeutral,
		ActionBlock:      OutcomeNeutral,
		ActionAttack:     OutcomeBlocked,
		ActionEnergyWave: OutcomeP2WinsRound,
		ActionTeleport:   OutcomeNeutral,
	},
	ActionAttack: {
		ActionCharge:     OutcomeP1WinsRound,
		ActionBlock:      OutcomeBlocked,
		ActionAttack:     OutcomeClash,
		ActionEnergyWave: OutcomeP2WinsRound,
		ActionTeleport:   OutcomeDodged,
	},
	ActionEnergyWave: {
		ActionCharge:     OutcomeP1WinsRound,
		ActionBlock:      OutcomeP1WinsRound,
		ActionAttack:     OutcomeP1WinsRound,
		ActionEnergyWave: OutcomeClash,
		ActionTeleport:   OutcomeDodged,
	},
	ActionTeleport: {
		ActionCharge:     OutcomeNeutral,
		ActionBlock:      OutcomeNeutral,
		ActionAttack:     OutcomeDodged,
		ActionEnergyWave: OutcomeDodged,
		ActionTeleport:   OutcomeNeutral,
	},
}

func validateAction(action Action, ki int) bool {
	return ki >= actionKiCost[action]
}

func calcKiAfter(action Action, currentKi int) int {
	ki := currentKi - actionKiCost[action] + actionKiGain[action]
	if ki < 0 {
		ki = 0
	}
	if ki > KiCap {
		ki = KiCap
	}
	return ki
}

func resolveTurn(turnNumber int, p1, p2 Action, p1Ki, p2Ki int) TurnResult {
	outcome := outcomeMatrix[p1][p2]
	return TurnResult{
		TurnNumber: turnNumber,
		P1Action:   p1,
		P2Action:   p2,
		Outcome:    outcome,
		P1KiBefore: p1Ki,
		P2KiBefore: p2Ki,
		P1KiAfter:  calcKiAfter(p1, p1Ki),
		P2KiAfter:  calcKiAfter(p2, p2Ki),
	}
}

// startNewRound seeds round N+1 inside the GameState.
func startNewRound(gs *GameState) {
	gs.CurrentRound = &RoundState{
		RoundNumber: len(gs.RoundResults) + 1,
		P1Ki:        0,
		P2Ki:        0,
		TurnNumber:  0,
		TurnHistory: []TurnResult{},
	}
}

// submitTurn applies both actions to the game state, advances rounds/match.
// Returns the turn result + optional round/match result. Mirrors
// engine.py GameEngine.submit_turn.
func submitTurn(gs *GameState, p1, p2 Action) (TurnResult, *RoundResult, *MatchResult, error) {
	if gs.Status != MatchInProgress {
		return TurnResult{}, nil, nil, fmt.Errorf("match not in progress (status=%s)", gs.Status)
	}
	if gs.CurrentRound == nil {
		return TurnResult{}, nil, nil, fmt.Errorf("no active round")
	}
	cr := gs.CurrentRound
	if !validateAction(p1, cr.P1Ki) {
		return TurnResult{}, nil, nil, fmt.Errorf("p1 cannot afford %s (ki=%d)", p1, cr.P1Ki)
	}
	if !validateAction(p2, cr.P2Ki) {
		return TurnResult{}, nil, nil, fmt.Errorf("p2 cannot afford %s (ki=%d)", p2, cr.P2Ki)
	}

	turnNum := cr.TurnNumber + 1
	tr := resolveTurn(turnNum, p1, p2, cr.P1Ki, cr.P2Ki)

	cr.TurnNumber = turnNum
	cr.P1Ki = tr.P1KiAfter
	cr.P2Ki = tr.P2KiAfter
	cr.TurnHistory = append(cr.TurnHistory, tr)

	rr := checkRoundEnd(tr, cr)
	var mr *MatchResult

	if rr != nil {
		switch rr.Winner {
		case WinnerP1:
			gs.RoundsWonP1++
		case WinnerP2:
			gs.RoundsWonP2++
		}
		gs.RoundResults = append(gs.RoundResults, *rr)
		gs.CurrentRound = nil

		mr = checkMatchEnd(gs)
		if mr != nil {
			gs.Status = MatchCompleted
		} else {
			startNewRound(gs)
		}
	}

	return tr, rr, mr, nil
}

func checkRoundEnd(tr TurnResult, rs *RoundState) *RoundResult {
	var winner RoundWinner
	switch tr.Outcome {
	case OutcomeP1WinsRound:
		winner = WinnerP1
	case OutcomeP2WinsRound:
		winner = WinnerP2
	default:
		if rs.TurnNumber >= TurnLimit {
			switch {
			case rs.P1Ki > rs.P2Ki:
				winner = WinnerP1
			case rs.P2Ki > rs.P1Ki:
				winner = WinnerP2
			default:
				winner = WinnerDraw
			}
		}
	}
	if winner == "" {
		return nil
	}
	return &RoundResult{
		RoundNumber: rs.RoundNumber,
		Winner:      winner,
		TotalTurns:  rs.TurnNumber,
		FinalP1Ki:   rs.P1Ki,
		FinalP2Ki:   rs.P2Ki,
	}
}

func checkMatchEnd(gs *GameState) *MatchResult {
	totalTurns := 0
	for _, r := range gs.RoundResults {
		totalTurns += r.TotalTurns
	}
	if gs.RoundsWonP1 >= RoundsToWin {
		return &MatchResult{
			GameID:       gs.GameID,
			Winner:       WinnerP1,
			RoundsWonP1:  gs.RoundsWonP1,
			RoundsWonP2:  gs.RoundsWonP2,
			RoundResults: gs.RoundResults,
			TotalTurns:   totalTurns,
		}
	}
	if gs.RoundsWonP2 >= RoundsToWin {
		return &MatchResult{
			GameID:       gs.GameID,
			Winner:       WinnerP2,
			RoundsWonP1:  gs.RoundsWonP1,
			RoundsWonP2:  gs.RoundsWonP2,
			RoundResults: gs.RoundResults,
			TotalTurns:   totalTurns,
		}
	}
	if len(gs.RoundResults) >= 3 {
		return &MatchResult{
			GameID:       gs.GameID,
			Winner:       WinnerDraw,
			RoundsWonP1:  gs.RoundsWonP1,
			RoundsWonP2:  gs.RoundsWonP2,
			RoundResults: gs.RoundResults,
			TotalTurns:   totalTurns,
		}
	}
	return nil
}

// newGameID returns a v4 UUID string — only used when this server creates
// a match directly. (In production we read game_ids issued by the Python
// rooms endpoint via Redis; this helper is for tests / standalone runs.)
func newGameID() string {
	return uuid.NewString()
}
