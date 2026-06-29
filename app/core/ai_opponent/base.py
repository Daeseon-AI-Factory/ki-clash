# CORE_CANDIDATE
"""AI opponent protocol — defines the interface for all AI difficulty levels.

Any game needing AI opponents can implement this protocol
with game-specific strategies.
"""

from typing import Protocol

from app.core.game_engine.types import Action, Difficulty, GameState, TurnResult


class AIOpponent(Protocol):
    """Protocol for AI opponent implementations."""

    def choose_action(
        self,
        game_state: GameState,
        history: list[TurnResult],
    ) -> Action:
        """Choose an action based on current game state and turn history.

        Args:
            game_state: Current full game state.
            history: Turn history for the current round.

        Returns:
            The chosen action.
        """
        ...


def create_ai_opponent(difficulty: Difficulty) -> AIOpponent:
    """Factory function to create an AI opponent by difficulty.

    Args:
        difficulty: Desired difficulty level.

    Returns:
        An AIOpponent instance.

    Raises:
        ValueError: If difficulty is unknown.
    """
    from app.core.ai_opponent.novice import NoviceAI
    from app.core.ai_opponent.easy import EasyAI
    from app.core.ai_opponent.medium import MediumAI
    from app.core.ai_opponent.hard import HardAI
    from app.core.ai_opponent.expert import ExpertAI
    from app.core.ai_opponent.grandmaster import GrandmasterAI

    opponents: dict[Difficulty, type[AIOpponent]] = {
        Difficulty.NOVICE: NoviceAI,
        Difficulty.EASY: EasyAI,
        Difficulty.MEDIUM: MediumAI,
        Difficulty.HARD: HardAI,
        Difficulty.EXPERT: ExpertAI,
        Difficulty.GRANDMASTER: GrandmasterAI,
    }

    ai_class = opponents.get(difficulty)
    if ai_class is None:
        raise ValueError(f"Unknown difficulty: {difficulty}")

    return ai_class()
