"""Integration test fixtures — drives a real PvP match against a running stack.

Requires `docker compose up -d` so PostgreSQL + Redis + FastAPI are reachable
on localhost. Tests auto-skip if the API is unreachable.

Fixtures are module-scoped: one match per test module so the expensive end-to-end
match runs once and many assertions inspect the captured event log.
"""

from __future__ import annotations

import asyncio
import json
import random
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

import httpx
import pytest
import pytest_asyncio
import websockets

API_BASE_URL = "http://localhost:8000"
WS_BASE_URL = "ws://localhost:8000"


def _api_reachable() -> bool:
    """Probe the API health endpoint with a short timeout."""
    try:
        with urlopen(f"{API_BASE_URL}/health", timeout=1.5) as r:
            return r.status == 200
    except (URLError, TimeoutError, ConnectionError):
        return False


@pytest.fixture(scope="session", autouse=True)
def _require_api() -> None:
    """Skip all integration tests if the API isn't running."""
    if not _api_reachable():
        pytest.skip(
            "Ki Clash API not reachable at "
            f"{API_BASE_URL}. Run `docker compose up -d` first.",
            allow_module_level=True,
        )


# ────────────────────────────────────────────────────────────────────────────
# Event capture
# ────────────────────────────────────────────────────────────────────────────


@dataclass
class Event:
    """A single WebSocket event observed by one player."""

    player: str  # "P1" or "P2"
    direction: str  # "send" or "recv"
    type: str
    data: dict[str, Any]
    timestamp_ms: int  # ms since match start


@dataclass
class MatchRecording:
    """Full event log of a single PvP match, plus identifiers."""

    p1_id: str
    p2_id: str
    game_id: str
    events: list[Event] = field(default_factory=list)

    def for_player(self, player: str) -> list[Event]:
        return [e for e in self.events if e.player == player]

    def of_type(self, msg_type: str) -> list[Event]:
        return [e for e in self.events if e.type == msg_type]

    def for_player_of_type(self, player: str, msg_type: str) -> list[Event]:
        return [e for e in self.events if e.player == player and e.type == msg_type]


# ────────────────────────────────────────────────────────────────────────────
# Match driver
# ────────────────────────────────────────────────────────────────────────────


KI_COST = {"charge": 0, "block": 0, "attack": 1, "energy_wave": 3, "teleport": 1}


def _pick_action(ki: int, rng: random.Random) -> str:
    """Pick a deterministic but varied affordable action."""
    weights = {
        "charge": 0.4, "block": 0.2, "attack": 0.2,
        "energy_wave": 0.1, "teleport": 0.1,
    }
    affordable = [(a, w) for a, w in weights.items() if KI_COST[a] <= ki]
    actions, w = zip(*affordable, strict=True)
    return rng.choices(actions, weights=w, k=1)[0]


async def _register_guest(client: httpx.AsyncClient) -> tuple[str, str]:
    """POST /auth/guest → (token, player_id)."""
    r = await client.post(f"{API_BASE_URL}/api/v1/auth/guest")
    r.raise_for_status()
    body = r.json()
    return body["access_token"], body["player_id"]


async def _matchmaking(
    token: str,
    player_name: str,
    recording: MatchRecording,
    t0: float,
) -> str:
    """Join queue, wait for match_found, return game_id."""
    url = f"{WS_BASE_URL}/api/v1/ws/matchmaking?token={token}"
    async with websockets.connect(url) as ws:
        async for raw in ws:
            data = json.loads(raw)
            event = Event(
                player=player_name,
                direction="recv",
                type=data.get("type", ""),
                data=data.get("data", {}),
                timestamp_ms=int((time.perf_counter() - t0) * 1000),
            )
            recording.events.append(event)
            if event.type == "match_found":
                return event.data["game_id"]
    raise RuntimeError(f"{player_name} matchmaking closed without match_found")


async def _play_game(
    token: str,
    game_id: str,
    player_name: str,
    recording: MatchRecording,
    t0: float,
    rng: random.Random,
) -> None:
    """Play a full match from the player's perspective. Returns when match_result arrives."""
    url = f"{WS_BASE_URL}/api/v1/ws/game/{game_id}?token={token}"
    async with websockets.connect(url) as ws:
        try:
            async for raw in ws:
                data = json.loads(raw)
                ts = int((time.perf_counter() - t0) * 1000)
                event = Event(
                    player=player_name,
                    direction="recv",
                    type=data.get("type", ""),
                    data=data.get("data", {}),
                    timestamp_ms=ts,
                )
                recording.events.append(event)

                if event.type == "waiting_for_action":
                    my_ki = event.data["p1_ki"]
                    action = _pick_action(my_ki, rng)
                    # Small delay to make message ordering visible
                    await asyncio.sleep(rng.uniform(0.05, 0.15))
                    out = {"type": "submit_action", "action": action}
                    await ws.send(json.dumps(out))
                    recording.events.append(Event(
                        player=player_name,
                        direction="send",
                        type="submit_action",
                        data={"action": action},
                        timestamp_ms=int((time.perf_counter() - t0) * 1000),
                    ))
                elif event.type == "match_result":
                    return
        except websockets.exceptions.ConnectionClosed:
            return


async def _run_one_match(seed: int = 42) -> MatchRecording:
    """Drive two virtual players through a complete PvP match."""
    rng = random.Random(seed)
    t0 = time.perf_counter()

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Register both
        (p1_token, p1_id), (p2_token, p2_id) = await asyncio.gather(
            _register_guest(client),
            _register_guest(client),
        )

    recording = MatchRecording(p1_id=p1_id, p2_id=p2_id, game_id="")

    # Matchmaking concurrently
    p1_game_id, p2_game_id = await asyncio.gather(
        _matchmaking(p1_token, "P1", recording, t0),
        _matchmaking(p2_token, "P2", recording, t0),
    )
    assert p1_game_id == p2_game_id, "matchmaking paired into different game_ids"
    recording.game_id = p1_game_id

    # Play game concurrently (separate RNGs so actions differ but reproducible)
    await asyncio.gather(
        _play_game(p1_token, p1_game_id, "P1", recording, t0, random.Random(seed)),
        _play_game(p2_token, p2_game_id, "P2", recording, t0, random.Random(seed + 1)),
    )

    return recording


# ────────────────────────────────────────────────────────────────────────────
# Module-scoped fixture: runs one match per test module
# ────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture(scope="module")
async def match() -> MatchRecording:
    """Drive one full Bo3 match and return the event recording for assertions."""
    return await _run_one_match(seed=42)
