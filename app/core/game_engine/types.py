# CORE_CANDIDATE
"""Core types for the turn-based game engine.

Defines all enums and Pydantic models for game state, actions,
turn resolution, round results, and match results. Pure data types
with no side effects — reusable for any simultaneous-action game.
"""

from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class Action(str, Enum):
    """Available player actions per turn."""

    CHARGE = "charge"
    BLOCK = "block"
    ATTACK = "attack"
    ENERGY_WAVE = "energy_wave"
    TELEPORT = "teleport"


# Ki costs and gains for each action
ACTION_KI_COST: dict[Action, int] = {
    Action.CHARGE: 0,
    Action.BLOCK: 0,
    Action.ATTACK: 1,
    Action.ENERGY_WAVE: 3,
    Action.TELEPORT: 1,
}

ACTION_KI_GAIN: dict[Action, int] = {
    Action.CHARGE: 1,
    Action.BLOCK: 0,
    Action.ATTACK: 0,
    Action.ENERGY_WAVE: 0,
    Action.TELEPORT: 0,
}

KI_CAP = 10
TURN_LIMIT = 20
ROUNDS_TO_WIN = 2
TURN_TIME_LIMIT_SECONDS = 5
DEFAULT_TIMEOUT_ACTION = Action.CHARGE


class TurnOutcome(str, Enum):
    """Result of a single turn's action resolution."""

    P1_WINS_ROUND = "p1_wins_round"
    P2_WINS_ROUND = "p2_wins_round"
    CLASH = "clash"
    BLOCKED = "blocked"
    DODGED = "dodged"
    NEUTRAL = "neutral"


class Difficulty(str, Enum):
    """AI opponent difficulty levels."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class MatchType(str, Enum):
    """Type of match."""

    AI_EASY = "ai_easy"
    AI_MEDIUM = "ai_medium"
    AI_HARD = "ai_hard"
    PVP = "pvp"


class MatchStatus(str, Enum):
    """Current status of a match."""

    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class RoundWinner(str, Enum):
    """Winner of a round."""

    P1 = "p1"
    P2 = "p2"
    DRAW = "draw"


class TurnResult(BaseModel):
    """Result of resolving a single turn."""

    turn_number: int
    p1_action: Action
    p2_action: Action
    outcome: TurnOutcome
    p1_ki_before: int
    p2_ki_before: int
    p1_ki_after: int
    p2_ki_after: int


class RoundState(BaseModel):
    """Current state of an in-progress round."""

    round_number: int = Field(ge=1, le=3)
    p1_ki: int = Field(default=0, ge=0, le=KI_CAP)
    p2_ki: int = Field(default=0, ge=0, le=KI_CAP)
    turn_number: int = Field(default=0, ge=0)
    turn_history: list[TurnResult] = Field(default_factory=list)


class RoundResult(BaseModel):
    """Result of a completed round."""

    round_number: int
    winner: RoundWinner
    total_turns: int
    final_p1_ki: int
    final_p2_ki: int


class GameState(BaseModel):
    """Full state of a best-of-3 match."""

    game_id: UUID = Field(default_factory=uuid4)
    match_type: MatchType
    status: MatchStatus = MatchStatus.IN_PROGRESS
    rounds_won_p1: int = Field(default=0, ge=0, le=ROUNDS_TO_WIN)
    rounds_won_p2: int = Field(default=0, ge=0, le=ROUNDS_TO_WIN)
    current_round: RoundState | None = None
    round_results: list[RoundResult] = Field(default_factory=list)


class MatchResult(BaseModel):
    """Final result of a completed match."""

    game_id: UUID
    winner: RoundWinner  # P1, P2, or DRAW
    rounds_won_p1: int
    rounds_won_p2: int
    round_results: list[RoundResult]
    total_turns: int
