package main

// Mirror of the Python `PvPSessionState` JSON shape (app/core/game_store.py).
//
// Single source of truth for the JSON contract lives in Python — when that
// schema changes, this struct must be updated in lock-step. Both servers
// read/write the same Redis key (`ki_clash:game:{game_id}`) so the JSON
// they exchange has to round-trip byte-identical.
//
// Field names use snake_case via struct tags (matches Pydantic .model_dump_json()).

import "encoding/json"

type GameState struct {
	GameID       string          `json:"game_id"`
	MatchType    string          `json:"match_type"`
	Status       string          `json:"status"`
	RoundsWonP1  int             `json:"rounds_won_p1"`
	RoundsWonP2  int             `json:"rounds_won_p2"`
	CurrentRound json.RawMessage `json:"current_round"`
	RoundResults json.RawMessage `json:"round_results"`
}

type PvPSession struct {
	GameState        GameState `json:"game_state"`
	Player1ID        string    `json:"player1_id"`
	Player2ID        string    `json:"player2_id"`
	ConnectedPlayers []string  `json:"connected_players"`
	Started          bool      `json:"started"`
	P1Action         *string   `json:"p1_action"`
	P2Action         *string   `json:"p2_action"`
}

// ClientMessage is what the browser sends over WebSocket.
type ClientMessage struct {
	Type   string `json:"type"`
	Action string `json:"action,omitempty"`
}

// ServerMessage is what we push back. Mirrors the Python schemas/ws.py envelopes.
type ServerMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}
