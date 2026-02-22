"""Game request/response schemas."""

from uuid import UUID

from pydantic import BaseModel

from app.core.game_engine.types import (
    Action,
    Difficulty,
    MatchStatus,
    TurnOutcome,
    RoundWinner,
)


class CreateAIGameRequest(BaseModel):
    difficulty: Difficulty


class SubmitActionRequest(BaseModel):
    action: Action


class TurnResultResponse(BaseModel):
    turn_number: int
    p1_action: Action
    p2_action: Action
    outcome: TurnOutcome
    p1_ki_after: int
    p2_ki_after: int


class RoundResultResponse(BaseModel):
    round_number: int
    winner: RoundWinner
    total_turns: int


class MatchResultResponse(BaseModel):
    winner: RoundWinner
    rounds_won_p1: int
    rounds_won_p2: int
    total_turns: int


class RoundStateResponse(BaseModel):
    round_number: int
    p1_ki: int
    p2_ki: int
    turn_number: int
    turn_history: list[TurnResultResponse]


class GameStateResponse(BaseModel):
    game_id: UUID
    match_type: str
    status: MatchStatus
    rounds_won_p1: int
    rounds_won_p2: int
    current_round: RoundStateResponse | None
    round_results: list[RoundResultResponse]


class SubmitActionResponse(BaseModel):
    turn_result: TurnResultResponse
    round_result: RoundResultResponse | None = None
    match_result: MatchResultResponse | None = None
    game_state: GameStateResponse
