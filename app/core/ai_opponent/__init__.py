# CORE_CANDIDATE
"""AI opponent module — pluggable AI strategies for turn-based games."""

from app.core.ai_opponent.base import AIOpponent, create_ai_opponent
from app.core.ai_opponent.easy import EasyAI
from app.core.ai_opponent.medium import MediumAI
from app.core.ai_opponent.hard import HardAI

__all__ = [
    "AIOpponent",
    "EasyAI",
    "HardAI",
    "MediumAI",
    "create_ai_opponent",
]
