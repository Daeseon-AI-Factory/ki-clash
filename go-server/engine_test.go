package main

// Engine tests — pure functions, no Redis needed. Mirrors the Python
// engine test coverage (tests/core/game_engine/).

import (
	"testing"
)

// ─── Outcome matrix — all 25 combinations against the Python truth table ─

func TestOutcomeMatrixAllCombinations(t *testing.T) {
	want := map[Action]map[Action]TurnOutcome{
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
	for p1, row := range want {
		for p2, expected := range row {
			got := outcomeMatrix[p1][p2]
			if got != expected {
				t.Errorf("outcomeMatrix[%s][%s] = %s, want %s", p1, p2, got, expected)
			}
		}
	}
}

// ─── validateAction / calcKiAfter ─────────────────────────────────────

func TestValidateAction(t *testing.T) {
	cases := []struct {
		action Action
		ki     int
		want   bool
	}{
		{ActionCharge, 0, true},
		{ActionBlock, 0, true},
		{ActionAttack, 0, false},
		{ActionAttack, 1, true},
		{ActionEnergyWave, 2, false},
		{ActionEnergyWave, 3, true},
		{ActionTeleport, 0, false},
		{ActionTeleport, 1, true},
	}
	for _, c := range cases {
		if got := validateAction(c.action, c.ki); got != c.want {
			t.Errorf("validateAction(%s, %d) = %v, want %v", c.action, c.ki, got, c.want)
		}
	}
}

func TestCalcKiAfter(t *testing.T) {
	cases := []struct {
		name   string
		action Action
		startKi int
		wantKi int
	}{
		{"charge from 0", ActionCharge, 0, 1},
		{"charge from cap", ActionCharge, KiCap, KiCap}, // clamped
		{"charge from 9", ActionCharge, 9, 10},
		{"block no change", ActionBlock, 5, 5},
		{"attack -1", ActionAttack, 3, 2},
		{"energy wave -3", ActionEnergyWave, 5, 2},
		{"teleport -1", ActionTeleport, 4, 3},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := calcKiAfter(c.action, c.startKi)
			if got != c.wantKi {
				t.Errorf("calcKiAfter(%s, %d) = %d, want %d", c.action, c.startKi, got, c.wantKi)
			}
		})
	}
}

// ─── submitTurn — state transitions ────────────────────────────────────

func newMatch() *GameState {
	gs := &GameState{
		GameID:       "test-game",
		MatchType:    MatchTypePVP,
		Status:       MatchInProgress,
		RoundResults: []RoundResult{},
	}
	startNewRound(gs)
	return gs
}

func TestSubmitTurnChargeCharge(t *testing.T) {
	gs := newMatch()
	tr, rr, mr, err := submitTurn(gs, ActionCharge, ActionCharge)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if tr.Outcome != OutcomeNeutral {
		t.Errorf("outcome = %s, want neutral", tr.Outcome)
	}
	if tr.P1KiAfter != 1 || tr.P2KiAfter != 1 {
		t.Errorf("ki after = %d/%d, want 1/1", tr.P1KiAfter, tr.P2KiAfter)
	}
	if rr != nil {
		t.Errorf("unexpected round result: %+v", rr)
	}
	if mr != nil {
		t.Errorf("unexpected match result: %+v", mr)
	}
	if gs.CurrentRound.TurnNumber != 1 {
		t.Errorf("turn number = %d, want 1", gs.CurrentRound.TurnNumber)
	}
}

func TestSubmitTurnP1WinsRound(t *testing.T) {
	gs := newMatch()
	gs.CurrentRound.P1Ki = 1
	tr, rr, _, err := submitTurn(gs, ActionAttack, ActionCharge)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if tr.Outcome != OutcomeP1WinsRound {
		t.Errorf("outcome = %s, want p1_wins_round", tr.Outcome)
	}
	if rr == nil {
		t.Fatal("expected round result")
	}
	if rr.Winner != WinnerP1 {
		t.Errorf("round winner = %s, want p1", rr.Winner)
	}
	if gs.RoundsWonP1 != 1 {
		t.Errorf("rounds won p1 = %d, want 1", gs.RoundsWonP1)
	}
	if gs.CurrentRound.RoundNumber != 2 {
		t.Errorf("next round number = %d, want 2", gs.CurrentRound.RoundNumber)
	}
}

func TestSubmitTurnP2WinsMatch(t *testing.T) {
	gs := newMatch()
	gs.RoundsWonP2 = 1 // one more and they win the match
	gs.CurrentRound.P2Ki = 1
	tr, rr, mr, err := submitTurn(gs, ActionCharge, ActionAttack)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if tr.Outcome != OutcomeP2WinsRound {
		t.Errorf("outcome = %s, want p2_wins_round", tr.Outcome)
	}
	if rr == nil || rr.Winner != WinnerP2 {
		t.Fatalf("expected p2 round win, got %+v", rr)
	}
	if mr == nil {
		t.Fatal("expected match result")
	}
	if mr.Winner != WinnerP2 {
		t.Errorf("match winner = %s, want p2", mr.Winner)
	}
	if gs.Status != MatchCompleted {
		t.Errorf("status = %s, want completed", gs.Status)
	}
}

func TestSubmitTurnInvalidWhenMatchCompleted(t *testing.T) {
	gs := newMatch()
	gs.Status = MatchCompleted
	_, _, _, err := submitTurn(gs, ActionCharge, ActionCharge)
	if err == nil {
		t.Fatal("expected error when match completed")
	}
}

func TestSubmitTurnInvalidWhenCantAfford(t *testing.T) {
	gs := newMatch() // both players at ki=0
	_, _, _, err := submitTurn(gs, ActionAttack, ActionCharge)
	if err == nil {
		t.Fatal("expected error when P1 can't afford attack")
	}
}

// ─── Turn-limit round end ─────────────────────────────────────────────

func TestRoundEndAtTurnLimitHigherKiWins(t *testing.T) {
	gs := newMatch()
	gs.CurrentRound.TurnNumber = TurnLimit - 1
	gs.CurrentRound.P1Ki = 5
	gs.CurrentRound.P2Ki = 3
	_, rr, _, err := submitTurn(gs, ActionCharge, ActionCharge)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if rr == nil {
		t.Fatal("expected round result at turn limit")
	}
	if rr.Winner != WinnerP1 {
		t.Errorf("winner = %s, want p1 (higher ki)", rr.Winner)
	}
}

func TestRoundEndAtTurnLimitDraw(t *testing.T) {
	gs := newMatch()
	gs.CurrentRound.TurnNumber = TurnLimit - 1
	gs.CurrentRound.P1Ki = 4
	gs.CurrentRound.P2Ki = 4
	_, rr, _, _ := submitTurn(gs, ActionCharge, ActionCharge)
	if rr == nil || rr.Winner != WinnerDraw {
		t.Fatalf("expected draw at tied turn limit, got %+v", rr)
	}
}

// ─── Match-end 3-round-draw case ──────────────────────────────────────

func TestMatchEndsAfterThreeRoundsWithDraw(t *testing.T) {
	gs := newMatch()
	// Force 3 round results — 1 win each + draw → DRAW match
	gs.RoundsWonP1 = 1
	gs.RoundsWonP2 = 1
	gs.RoundResults = []RoundResult{
		{RoundNumber: 1, Winner: WinnerP1, TotalTurns: 5},
		{RoundNumber: 2, Winner: WinnerP2, TotalTurns: 6},
	}
	startNewRound(gs)
	gs.CurrentRound.TurnNumber = TurnLimit - 1
	gs.CurrentRound.P1Ki = 4
	gs.CurrentRound.P2Ki = 4
	_, rr, mr, _ := submitTurn(gs, ActionCharge, ActionCharge)
	if rr == nil || rr.Winner != WinnerDraw {
		t.Fatalf("expected draw round, got %+v", rr)
	}
	if mr == nil {
		t.Fatal("expected match result after 3 rounds")
	}
	if mr.Winner != WinnerDraw {
		t.Errorf("match winner = %s, want draw", mr.Winner)
	}
}

// ─── Outcome perspective flipping ─────────────────────────────────────

func TestFlipOutcomeFor(t *testing.T) {
	cases := []struct {
		outcome     string
		perspective string
		want        string
	}{
		{"p1_wins_round", "p1", "you_win"},
		{"p1_wins_round", "p2", "you_lose"},
		{"p2_wins_round", "p1", "you_lose"},
		{"p2_wins_round", "p2", "you_win"},
		{"clash", "p1", "clash"},
		{"neutral", "p2", "neutral"},
	}
	for _, c := range cases {
		got := flipOutcomeFor(c.outcome, c.perspective)
		if got != c.want {
			t.Errorf("flipOutcomeFor(%q, %q) = %q, want %q", c.outcome, c.perspective, got, c.want)
		}
	}
}

func TestWinnerLabelFor(t *testing.T) {
	cases := []struct {
		winner RoundWinner
		pid    string
		p1id   string
		want   string
	}{
		{WinnerP1, "p1", "p1", "you"},
		{WinnerP1, "p2", "p1", "opponent"},
		{WinnerP2, "p1", "p1", "opponent"},
		{WinnerP2, "p2", "p1", "you"},
		{WinnerDraw, "p1", "p1", "draw"},
		{WinnerDraw, "p2", "p1", "draw"},
	}
	for _, c := range cases {
		got := winnerLabelFor(c.winner, c.pid, c.p1id)
		if got != c.want {
			t.Errorf("winnerLabelFor(%s, %s, p1=%s) = %s, want %s",
				c.winner, c.pid, c.p1id, got, c.want)
		}
	}
}
