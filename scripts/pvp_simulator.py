"""PvP Simulator — observes the Ki Clash server's real-time PvP flow.

Runs two virtual players through a complete match end-to-end so you can
see the "two envelope" simultaneous-reveal pattern playing out live.

Steps the simulator drives:
    1. Both register as guests via POST /api/v1/auth/guest
    2. Both open WS to /api/v1/ws/matchmaking
    3. Server pairs them → match_found
    4. Both open WS to /api/v1/ws/game/{game_id}
    5. Both submit actions; server resolves turns; broadcasts results
    6. Match completes; sockets close cleanly

Usage:
    python3 scripts/pvp_simulator.py
    python3 scripts/pvp_simulator.py --host localhost --port 8000 --turns-max 20

Color-coded output:
    P1 lines → red
    P2 lines → blue
    Server-side events / summaries → green
    Errors → yellow
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
import websockets

# ---------------------------------------------------------------------------
# Pretty printing
# ---------------------------------------------------------------------------

RED = "\033[31m"
BLUE = "\033[34m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
GRAY = "\033[90m"
BOLD = "\033[1m"
RESET = "\033[0m"

T0 = time.perf_counter()


def elapsed_ms() -> int:
    return int((time.perf_counter() - T0) * 1000)


def log(tag: str, msg: str, color: str = "") -> None:
    """Print a timestamped, color-tagged line."""
    print(f"{GRAY}T+{elapsed_ms():05d}ms{RESET}  {color}[{tag:^6}]{RESET}  {msg}")


# ---------------------------------------------------------------------------
# Action selection strategy
# ---------------------------------------------------------------------------

KI_COST = {
    "charge": 0,
    "block": 0,
    "attack": 1,
    "energy_wave": 3,
    "teleport": 1,
}

WEIGHTS_AGGRO = {"charge": 0.35, "attack": 0.30, "energy_wave": 0.15, "block": 0.10, "teleport": 0.10}
WEIGHTS_DEFENSE = {"charge": 0.40, "block": 0.30, "attack": 0.15, "teleport": 0.10, "energy_wave": 0.05}


def pick_action(ki: int, weights: dict[str, float]) -> str:
    """Pick a weighted-random affordable action."""
    affordable = [(a, w) for a, w in weights.items() if KI_COST[a] <= ki]
    actions, w = zip(*affordable, strict=True)
    return random.choices(actions, weights=w, k=1)[0]


# ---------------------------------------------------------------------------
# Player simulator
# ---------------------------------------------------------------------------


@dataclass
class Player:
    name: str
    color: str
    weights: dict[str, float]
    base_url: str
    ws_url: str
    token: str = ""
    player_id: str = ""
    game_id: str = ""
    my_ki: int = 0
    opponent_ki: int = 0
    turn: int = 0
    round_number: int = 1
    score: dict[str, int] = field(default_factory=lambda: {"you": 0, "opponent": 0, "draw": 0})
    match_done: asyncio.Event = field(default_factory=asyncio.Event)

    def log(self, msg: str) -> None:
        log(self.name, msg, self.color)

    async def register(self, client: httpx.AsyncClient) -> None:
        r = await client.post(f"{self.base_url}/api/v1/auth/guest")
        r.raise_for_status()
        body = r.json()
        self.token = body["access_token"]
        self.player_id = body["player_id"]
        self.log(f"registered guest player_id={self.player_id[:8]}... display={body['display_name']}")

    async def matchmaking(self) -> None:
        url = f"{self.ws_url}/api/v1/ws/matchmaking?token={self.token}"
        self.log(f"ws→ /ws/matchmaking")
        async with websockets.connect(url) as ws:
            async for raw in ws:
                data = json.loads(raw)
                t = data.get("type", "")
                d = data.get("data", {})

                if t == "queue_joined":
                    self.log(f"←recv queue_joined position={d.get('position')}")
                elif t == "match_found":
                    self.game_id = d["game_id"]
                    self.log(f"←recv match_found game_id={self.game_id[:8]}... opponent={d.get('opponent_name')}")
                    return
                else:
                    self.log(f"←recv (unhandled) {t}: {d}")

    async def play_game(self) -> None:
        url = f"{self.ws_url}/api/v1/ws/game/{self.game_id}?token={self.token}"
        self.log(f"ws→ /ws/game/{self.game_id[:8]}...")
        async with websockets.connect(url) as ws:
            try:
                async for raw in ws:
                    data = json.loads(raw)
                    t = data.get("type", "")
                    d = data.get("data", {})

                    if t == "waiting_for_action":
                        self.turn = d["turn"]
                        self.round_number = d["round_number"]
                        self.my_ki = d["p1_ki"]
                        self.opponent_ki = d["p2_ki"]
                        self.log(
                            f"←recv waiting_for_action round={self.round_number} "
                            f"turn={self.turn} ki(me={self.my_ki}, opp={self.opponent_ki})"
                        )

                        # Pick + send (slight delay to make output readable)
                        await asyncio.sleep(random.uniform(0.2, 0.6))
                        action = pick_action(self.my_ki, self.weights)
                        self.log(f"send→ submit_action {BOLD}{action}{RESET}{self.color}")
                        await ws.send(json.dumps({"type": "submit_action", "action": action}))

                    elif t == "action_confirmed":
                        self.log(f"←recv action_confirmed {d.get('action')}")

                    elif t == "turn_result":
                        you = d["your_action"]
                        opp = d["opponent_action"]
                        outcome = d["outcome"]
                        self.log(
                            f"←recv turn_result you={you} vs opp={opp} → "
                            f"{BOLD}{outcome}{RESET}{self.color} "
                            f"ki(me={d['your_ki']}, opp={d['opponent_ki']})"
                        )

                    elif t == "round_result":
                        winner = d["winner"]
                        self.score[winner] = self.score.get(winner, 0) + 1
                        self.log(
                            f"←recv round_result round={d['round_number']} "
                            f"winner={BOLD}{winner}{RESET}{self.color} "
                            f"turns={d['total_turns']}"
                        )

                    elif t == "match_result":
                        winner = d["winner"]
                        self.log(
                            f"←recv match_result winner={BOLD}{winner}{RESET}{self.color} "
                            f"final={d['rounds_won_p1']}-{d['rounds_won_p2']} "
                            f"total_turns={d['total_turns']}"
                        )
                        self.match_done.set()
                        return

                    elif t == "error":
                        self.log(f"{YELLOW}←recv ERROR {d}{self.color}")

                    else:
                        self.log(f"←recv (unhandled) {t}: {d}")
            except websockets.exceptions.ConnectionClosed:
                self.log("ws connection closed")


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


async def run(base_url: str, ws_url: str) -> None:
    log("setup", "starting PvP simulator", GREEN)
    log("setup", f"base={base_url}", GREEN)
    log("setup", f"ws={ws_url}", GREEN)

    p1 = Player("P1", RED, WEIGHTS_AGGRO, base_url, ws_url)
    p2 = Player("P2", BLUE, WEIGHTS_DEFENSE, base_url, ws_url)

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Step 1 — register both as guests
        await asyncio.gather(p1.register(client), p2.register(client))

    # Step 2 — both join matchmaking queue concurrently
    log("setup", "both joining matchmaking queue", GREEN)
    await asyncio.gather(p1.matchmaking(), p2.matchmaking())

    if not p1.game_id or not p2.game_id:
        log("setup", f"{YELLOW}matchmaking failed{RESET}", GREEN)
        return

    assert p1.game_id == p2.game_id, "matchmaking should pair into the same game_id"
    log("setup", f"{BOLD}matched into game {p1.game_id[:8]}...{RESET}{GREEN}", GREEN)

    # Step 3 — both connect to the game WebSocket and play
    log("setup", "both connecting to game WS", GREEN)
    await asyncio.gather(p1.play_game(), p2.play_game())

    # Step 4 — summary
    log("setup", f"{BOLD}match complete{RESET}{GREEN}", GREEN)
    print()
    print(f"  {RED}P1 view:{RESET} you={p1.score['you']} opp={p1.score['opponent']} draws={p1.score['draw']}")
    print(f"  {BLUE}P2 view:{RESET} you={p2.score['you']} opp={p2.score['opponent']} draws={p2.score['draw']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="localhost", help="API host (default: localhost)")
    parser.add_argument("--port", type=int, default=8000, help="API port (default: 8000)")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    base_url = f"http://{args.host}:{args.port}"
    ws_url = f"ws://{args.host}:{args.port}"

    try:
        asyncio.run(run(base_url, ws_url))
    except KeyboardInterrupt:
        print(f"\n{YELLOW}interrupted by user{RESET}")
        return 130
    except Exception as e:
        print(f"\n{YELLOW}fatal: {type(e).__name__}: {e}{RESET}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
