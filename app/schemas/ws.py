"""WebSocket message schemas.

Defines the protocol for client→server and server→client messages.
Both sides must agree on these message shapes for communication to work.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.core.game_engine.types import Action, TurnOutcome, RoundWinner


# --- Server → Client messages ---

class WSMessage(BaseModel):
    """Base WebSocket message from server to client."""

    type: str
    data: dict[str, Any] = {}


def queue_joined(position: int) -> dict:
    return {"type": "queue_joined", "data": {"position": position}}


def match_found(game_id: str, opponent_name: str) -> dict:
    return {
        "type": "match_found",
        "data": {"game_id": game_id, "opponent_name": opponent_name},
    }


def waiting_for_action(turn: int, time_limit: int, round_number: int, p1_ki: int, p2_ki: int) -> dict:
    return {
        "type": "waiting_for_action",
        "data": {
            "turn": turn,
            "time_limit": time_limit,
            "round_number": round_number,
            "p1_ki": p1_ki,
            "p2_ki": p2_ki,
        },
    }


def turn_result(
    turn_number: int,
    your_action: str,
    opponent_action: str,
    outcome: str,
    your_ki: int,
    opponent_ki: int,
) -> dict:
    return {
        "type": "turn_result",
        "data": {
            "turn_number": turn_number,
            "your_action": your_action,
            "opponent_action": opponent_action,
            "outcome": outcome,
            "your_ki": your_ki,
            "opponent_ki": opponent_ki,
        },
    }


def round_result(round_number: int, winner: str, total_turns: int) -> dict:
    return {
        "type": "round_result",
        "data": {
            "round_number": round_number,
            "winner": winner,
            "total_turns": total_turns,
        },
    }


def match_result(
    winner: str,
    rounds_won_p1: int,
    rounds_won_p2: int,
    total_turns: int,
) -> dict:
    return {
        "type": "match_result",
        "data": {
            "winner": winner,
            "rounds_won_p1": rounds_won_p1,
            "rounds_won_p2": rounds_won_p2,
            "total_turns": total_turns,
        },
    }


def opponent_disconnected(reconnect_timeout: int) -> dict:
    return {
        "type": "opponent_disconnected",
        "data": {"reconnect_timeout": reconnect_timeout},
    }


def opponent_reconnected() -> dict:
    return {"type": "opponent_reconnected", "data": {}}


def error_msg(message: str) -> dict:
    return {"type": "error", "data": {"message": message}}


def pong() -> dict:
    return {"type": "pong", "data": {}}
