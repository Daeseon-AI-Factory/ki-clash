# CORE_CANDIDATE
"""Game engine core — turn-based simultaneous-action game logic.

Reusable for any game with simultaneous action selection,
outcome resolution, and round/match lifecycle.
"""

from app.core.game_engine.engine import GameEngine
from app.core.game_engine.outcome_matrix import (
    resolve_actions,
    resolve_turn,
    validate_action,
)
from app.core.game_engine.types import (
    Action,
    Difficulty,
    GameState,
    MatchResult,
    MatchStatus,
    MatchType,
    RoundResult,
    RoundState,
    RoundWinner,
    TurnOutcome,
    TurnResult,
)

__all__ = [
    "Action",
    "Difficulty",
    "GameEngine",
    "GameState",
    "MatchResult",
    "MatchStatus",
    "MatchType",
    "RoundResult",
    "RoundState",
    "RoundWinner",
    "TurnOutcome",
    "TurnResult",
    "resolve_actions",
    "resolve_turn",
    "validate_action",
]
