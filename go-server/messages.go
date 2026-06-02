package main

// WebSocket message envelope builders. Mirrors app/schemas/ws.py so the
// frontend can connect to either Python or Go without code changes.

func waitingForActionMsg(turn, timeLimit, roundNumber, p1Ki, p2Ki int) ServerMessage {
	return ServerMessage{
		Type: "waiting_for_action",
		Data: map[string]any{
			"turn":         turn,
			"time_limit":   timeLimit,
			"round_number": roundNumber,
			"p1_ki":        p1Ki,
			"p2_ki":        p2Ki,
		},
	}
}

func actionConfirmedMsg(turnNumber int, action Action) ServerMessage {
	return ServerMessage{
		Type: "action_confirmed",
		Data: map[string]any{
			"turn_number": turnNumber,
			"action":      string(action),
		},
	}
}

func turnResultMsg(turnNumber int, your, opponent Action, outcome string, yourKi, opponentKi int) ServerMessage {
	return ServerMessage{
		Type: "turn_result",
		Data: map[string]any{
			"turn_number":     turnNumber,
			"your_action":     string(your),
			"opponent_action": string(opponent),
			"outcome":         outcome,
			"your_ki":         yourKi,
			"opponent_ki":     opponentKi,
		},
	}
}

func roundResultMsg(roundNumber int, winnerLabel string, totalTurns int) ServerMessage {
	return ServerMessage{
		Type: "round_result",
		Data: map[string]any{
			"round_number": roundNumber,
			"winner":       winnerLabel,
			"total_turns":  totalTurns,
		},
	}
}

func matchResultMsg(winnerLabel string, p1Won, p2Won, totalTurns int) ServerMessage {
	return ServerMessage{
		Type: "match_result",
		Data: map[string]any{
			"winner":         winnerLabel,
			"rounds_won_p1":  p1Won,
			"rounds_won_p2":  p2Won,
			"total_turns":    totalTurns,
		},
	}
}

func opponentDisconnectedMsg(reconnectTimeout int) ServerMessage {
	return ServerMessage{
		Type: "opponent_disconnected",
		Data: map[string]any{"reconnect_timeout": reconnectTimeout},
	}
}

func opponentReconnectedMsg() ServerMessage {
	return ServerMessage{
		Type: "opponent_reconnected",
		Data: map[string]any{},
	}
}

func errorMsg(msg string) ServerMessage {
	return ServerMessage{
		Type: "error",
		Data: map[string]any{"message": msg},
	}
}

func pongMsg() ServerMessage {
	return ServerMessage{
		Type: "pong",
		Data: map[string]any{},
	}
}

// flipOutcomeFor reframes "p1_wins_round" / "p2_wins_round" as
// "you_win" / "you_lose" relative to the receiving player.
func flipOutcomeFor(outcome, perspective string) string {
	if perspective == "p1" {
		switch outcome {
		case string(OutcomeP1WinsRound):
			return "you_win"
		case string(OutcomeP2WinsRound):
			return "you_lose"
		}
		return outcome
	}
	switch outcome {
	case string(OutcomeP2WinsRound):
		return "you_win"
	case string(OutcomeP1WinsRound):
		return "you_lose"
	}
	return outcome
}

// winnerLabelFor maps the absolute RoundWinner ("p1"/"p2"/"draw") to
// the perspective-relative string ("you"/"opponent"/"draw") for player
// `pid` when p1's id is `p1id`.
func winnerLabelFor(winner RoundWinner, pid, p1id string) string {
	if winner == WinnerDraw {
		return "draw"
	}
	isP1 := pid == p1id
	winnerIsP1 := winner == WinnerP1
	if isP1 == winnerIsP1 {
		return "you"
	}
	return "opponent"
}
