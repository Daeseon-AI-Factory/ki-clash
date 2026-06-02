package main

// Mirror of Python game_engine/types.py + game_store.PvPSessionState.
//
// Field names are snake_case via JSON tags so both servers round-trip
// byte-identical JSON in Redis. The Python side is the schema authority;
// changes there must be mirrored here in lockstep.

// ─── Enums (string-backed) ────────────────────────────────────────────

type Action string

const (
	ActionCharge     Action = "charge"
	ActionBlock      Action = "block"
	ActionAttack     Action = "attack"
	ActionEnergyWave Action = "energy_wave"
	ActionTeleport   Action = "teleport"
)

type TurnOutcome string

const (
	OutcomeP1WinsRound TurnOutcome = "p1_wins_round"
	OutcomeP2WinsRound TurnOutcome = "p2_wins_round"
	OutcomeClash       TurnOutcome = "clash"
	OutcomeBlocked     TurnOutcome = "blocked"
	OutcomeDodged      TurnOutcome = "dodged"
	OutcomeNeutral     TurnOutcome = "neutral"
)

type MatchStatus string

const (
	MatchInProgress MatchStatus = "in_progress"
	MatchCompleted  MatchStatus = "completed"
	MatchAbandoned  MatchStatus = "abandoned"
)

type RoundWinner string

const (
	WinnerP1   RoundWinner = "p1"
	WinnerP2   RoundWinner = "p2"
	WinnerDraw RoundWinner = "draw"
)

type MatchType string

const (
	MatchTypePVP MatchType = "pvp"
)

// ─── Game constants (mirror types.py) ─────────────────────────────────

const (
	KiCap                  = 10
	TurnLimit              = 20
	RoundsToWin            = 2
	TurnTimeLimitSeconds   = 5
	DisconnectTimeoutSec   = 30
	DefaultTimeoutAction   = ActionCharge
	GameTTLSeconds         = 3600
	GameKeyPrefix          = "ki_clash:game:"
	PlayerChannelPrefix    = "ki_clash:player:"
	DefaultMaxWatchRetries = 3
)

// ─── Action affordance (cost/gain) ────────────────────────────────────

var actionKiCost = map[Action]int{
	ActionCharge:     0,
	ActionBlock:      0,
	ActionAttack:     1,
	ActionEnergyWave: 3,
	ActionTeleport:   1,
}

var actionKiGain = map[Action]int{
	ActionCharge:     1,
	ActionBlock:      0,
	ActionAttack:     0,
	ActionEnergyWave: 0,
	ActionTeleport:   0,
}

// ─── State structs (JSON round-trip with Python Pydantic) ─────────────

type TurnResult struct {
	TurnNumber int         `json:"turn_number"`
	P1Action   Action      `json:"p1_action"`
	P2Action   Action      `json:"p2_action"`
	Outcome    TurnOutcome `json:"outcome"`
	P1KiBefore int         `json:"p1_ki_before"`
	P2KiBefore int         `json:"p2_ki_before"`
	P1KiAfter  int         `json:"p1_ki_after"`
	P2KiAfter  int         `json:"p2_ki_after"`
}

type RoundState struct {
	RoundNumber int          `json:"round_number"`
	P1Ki        int          `json:"p1_ki"`
	P2Ki        int          `json:"p2_ki"`
	TurnNumber  int          `json:"turn_number"`
	TurnHistory []TurnResult `json:"turn_history"`
}

type RoundResult struct {
	RoundNumber int         `json:"round_number"`
	Winner      RoundWinner `json:"winner"`
	TotalTurns  int         `json:"total_turns"`
	FinalP1Ki   int         `json:"final_p1_ki"`
	FinalP2Ki   int         `json:"final_p2_ki"`
}

type GameState struct {
	GameID       string        `json:"game_id"`
	MatchType    MatchType     `json:"match_type"`
	Status       MatchStatus   `json:"status"`
	RoundsWonP1  int           `json:"rounds_won_p1"`
	RoundsWonP2  int           `json:"rounds_won_p2"`
	CurrentRound *RoundState   `json:"current_round"`
	RoundResults []RoundResult `json:"round_results"`
}

type MatchResult struct {
	GameID       string        `json:"game_id"`
	Winner       RoundWinner   `json:"winner"`
	RoundsWonP1  int           `json:"rounds_won_p1"`
	RoundsWonP2  int           `json:"rounds_won_p2"`
	RoundResults []RoundResult `json:"round_results"`
	TotalTurns   int           `json:"total_turns"`
}

type PvPSession struct {
	GameState        GameState `json:"game_state"`
	Player1ID        string    `json:"player1_id"`
	Player2ID        string    `json:"player2_id"`
	ConnectedPlayers []string  `json:"connected_players"`
	Started          bool      `json:"started"`
	P1Action         *Action   `json:"p1_action"`
	P2Action         *Action   `json:"p2_action"`
}

func (s *PvPSession) HasConnected(pid string) bool {
	for _, c := range s.ConnectedPlayers {
		if c == pid {
			return true
		}
	}
	return false
}

func (s *PvPSession) MarkConnected(pid string) {
	if !s.HasConnected(pid) {
		s.ConnectedPlayers = append(s.ConnectedPlayers, pid)
	}
}

func (s *PvPSession) IsPlayer(pid string) bool {
	return pid == s.Player1ID || pid == s.Player2ID
}

// ─── Wire envelope types (frontend protocol — matches schemas/ws.py) ─

type ClientMessage struct {
	Type   string `json:"type"`
	Action string `json:"action,omitempty"`
}

type ServerMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}
