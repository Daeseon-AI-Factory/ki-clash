# CORE_CANDIDATE
"""Outcome matrix for simultaneous-action resolution.

Pure function that takes two actions and returns the turn outcome.
No side effects, no state — just the rules of the game.
"""

from app.core.game_engine.types import (
    Action,
    ACTION_KI_COST,
    ACTION_KI_GAIN,
    KI_CAP,
    TurnOutcome,
    TurnResult,
)

# Outcome matrix: _MATRIX[p1_action][p2_action] = outcome from P1's perspective
# Reading: "P1 does X, P2 does Y → result"
_MATRIX: dict[Action, dict[Action, TurnOutcome]] = {
    Action.CHARGE: {
        Action.CHARGE: TurnOutcome.NEUTRAL,
        Action.BLOCK: TurnOutcome.NEUTRAL,
        Action.ATTACK: TurnOutcome.P2_WINS_ROUND,
        Action.ENERGY_WAVE: TurnOutcome.P2_WINS_ROUND,
        Action.TELEPORT: TurnOutcome.NEUTRAL,
    },
    Action.BLOCK: {
        Action.CHARGE: TurnOutcome.NEUTRAL,
        Action.BLOCK: TurnOutcome.NEUTRAL,
        Action.ATTACK: TurnOutcome.BLOCKED,
        Action.ENERGY_WAVE: TurnOutcome.P2_WINS_ROUND,
        Action.TELEPORT: TurnOutcome.NEUTRAL,
    },
    Action.ATTACK: {
        Action.CHARGE: TurnOutcome.P1_WINS_ROUND,
        Action.BLOCK: TurnOutcome.BLOCKED,
        Action.ATTACK: TurnOutcome.CLASH,
        Action.ENERGY_WAVE: TurnOutcome.P2_WINS_ROUND,
        Action.TELEPORT: TurnOutcome.DODGED,
    },
    Action.ENERGY_WAVE: {
        Action.CHARGE: TurnOutcome.P1_WINS_ROUND,
        Action.BLOCK: TurnOutcome.P1_WINS_ROUND,
        Action.ATTACK: TurnOutcome.P1_WINS_ROUND,
        Action.ENERGY_WAVE: TurnOutcome.CLASH,
        Action.TELEPORT: TurnOutcome.DODGED,
    },
    Action.TELEPORT: {
        Action.CHARGE: TurnOutcome.NEUTRAL,
        Action.BLOCK: TurnOutcome.NEUTRAL,
        Action.ATTACK: TurnOutcome.DODGED,
        Action.ENERGY_WAVE: TurnOutcome.DODGED,
        Action.TELEPORT: TurnOutcome.NEUTRAL,
    },
}


def resolve_actions(p1_action: Action, p2_action: Action) -> TurnOutcome:
    """Resolve two simultaneous actions into a turn outcome.

    Args:
        p1_action: Player 1's chosen action.
        p2_action: Player 2's chosen action.

    Returns:
        TurnOutcome from P1's perspective.
    """
    return _MATRIX[p1_action][p2_action]


def validate_action(action: Action, player_ki: int) -> bool:
    """Check whether a player can afford an action.

    Args:
        action: The action the player wants to take.
        player_ki: The player's current ki.

    Returns:
        True if the player has enough ki.
    """
    return player_ki >= ACTION_KI_COST[action]


def calculate_ki_after(
    action: Action,
    opponent_action: Action,
    current_ki: int,
    outcome: TurnOutcome,
) -> int:
    """Calculate a player's ki after a turn resolves.

    Ki changes:
    - Charge: +1 ki (regardless of outcome)
    - Attack/Teleport: -1 ki cost (spent on use)
    - Energy Wave: -3 ki cost (spent on use)
    - Block: no change
    - Clash: both attackers lose their ki cost
    - Blocked: attacker loses ki cost, blocker unchanged
    - Dodged: attacker loses ki cost, teleporter loses ki cost

    Args:
        action: This player's action.
        opponent_action: Opponent's action.
        current_ki: Ki before this turn.
        outcome: The resolved turn outcome.

    Returns:
        Ki after this turn, clamped to [0, KI_CAP].
    """
    ki = current_ki
    ki -= ACTION_KI_COST[action]
    ki += ACTION_KI_GAIN[action]
    return max(0, min(ki, KI_CAP))


def resolve_turn(
    turn_number: int,
    p1_action: Action,
    p2_action: Action,
    p1_ki: int,
    p2_ki: int,
) -> TurnResult:
    """Resolve a complete turn: actions, outcome, and ki changes.

    Args:
        turn_number: The current turn number (1-indexed).
        p1_action: Player 1's action.
        p2_action: Player 2's action.
        p1_ki: Player 1's ki before this turn.
        p2_ki: Player 2's ki before this turn.

    Returns:
        TurnResult with all state changes.
    """
    outcome = resolve_actions(p1_action, p2_action)

    p1_ki_after = calculate_ki_after(p1_action, p2_action, p1_ki, outcome)
    p2_ki_after = calculate_ki_after(p2_action, p1_action, p2_ki, outcome)

    return TurnResult(
        turn_number=turn_number,
        p1_action=p1_action,
        p2_action=p2_action,
        outcome=outcome,
        p1_ki_before=p1_ki,
        p2_ki_before=p2_ki,
        p1_ki_after=p1_ki_after,
        p2_ki_after=p2_ki_after,
    )
