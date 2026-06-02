#!/usr/bin/env python3
"""Load test for the Go game server.

Spawns N concurrent matches, each running M full turns end-to-end through
the Go WebSocket endpoint. Measures throughput + per-turn latency.

Usage:
    python3 load_test.py --matches 50 --turns 5

Run while Python platform server (:8000) and Go server (:8001) are both up.
Both servers share the same Redis — Go handles WS, Python provides REST.
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
import urllib.request
import websockets

PY = "http://localhost:8000"
GO_WS = "ws://localhost:8001"


def http_json(method, path, token=None, body=None):
    req = urllib.request.Request(PY + path, method=method)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if body is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(body).encode()
    return json.loads(urllib.request.urlopen(req).read())


async def setup_match():
    """Provision two guests + room + game. Returns (game_id, t1, t2)."""
    loop = asyncio.get_running_loop()
    t1 = (await loop.run_in_executor(None, http_json, "POST", "/api/v1/auth/guest"))["access_token"]
    t2 = (await loop.run_in_executor(None, http_json, "POST", "/api/v1/auth/guest"))["access_token"]
    code = (await loop.run_in_executor(None, http_json, "POST", "/api/v1/rooms", t1))["code"]
    await loop.run_in_executor(None, http_json, "POST", f"/api/v1/rooms/{code}/join", t2)
    await loop.run_in_executor(None, http_json, "PUT", f"/api/v1/rooms/{code}/character", t1, {"character_id": "haneul"})
    await loop.run_in_executor(None, http_json, "PUT", f"/api/v1/rooms/{code}/character", t2, {"character_id": "bora"})
    await loop.run_in_executor(None, http_json, "PUT", f"/api/v1/rooms/{code}/ready", t1, {"ready": True})
    await loop.run_in_executor(None, http_json, "PUT", f"/api/v1/rooms/{code}/ready", t2, {"ready": True})
    gid = (await loop.run_in_executor(None, http_json, "POST", f"/api/v1/rooms/{code}/start", t1))["game_id"]
    return gid, t1, t2


async def drain_until(ws, type_, timeout=5):
    """Read messages from ws until a `type_` envelope arrives."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            raw = await asyncio.wait_for(
                ws.recv(), timeout=deadline - time.monotonic()
            )
            msg = json.loads(raw)
            if msg["type"] == type_:
                return msg
        except asyncio.TimeoutError:
            break
    raise asyncio.TimeoutError(f"never saw {type_}")


async def run_match(turns):
    """One match: connect both WSs, run `turns` charge-charge turns, close."""
    latencies = []
    gid, t1, t2 = await setup_match()
    ws1 = await websockets.connect(f"{GO_WS}/api/v1/ws/game/{gid}?token={t1}")
    ws2 = await websockets.connect(f"{GO_WS}/api/v1/ws/game/{gid}?token={t2}")
    try:
        await drain_until(ws1, "waiting_for_action")
        await drain_until(ws2, "waiting_for_action")
        for _ in range(turns):
            t0 = time.monotonic()
            await ws1.send(json.dumps({"type": "submit_action", "action": "charge"}))
            await ws2.send(json.dumps({"type": "submit_action", "action": "charge"}))
            await drain_until(ws1, "turn_result")
            await drain_until(ws2, "turn_result")
            latencies.append(time.monotonic() - t0)
            # The next waiting_for_action lands ~1.5s after turn_result (Go
            # serverside pause). Wait for it before submitting again.
            try:
                await drain_until(ws1, "waiting_for_action", timeout=3)
                await drain_until(ws2, "waiting_for_action", timeout=3)
            except asyncio.TimeoutError:
                # Round/match ended — done with this match.
                break
    finally:
        await ws1.close()
        await ws2.close()
    return latencies


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--matches", type=int, default=20)
    p.add_argument("--turns", type=int, default=3)
    args = p.parse_args()

    print(f"Starting {args.matches} concurrent matches × {args.turns} turns each")
    t0 = time.monotonic()
    results = await asyncio.gather(
        *(run_match(args.turns) for _ in range(args.matches)),
        return_exceptions=True,
    )
    elapsed = time.monotonic() - t0

    all_latencies = []
    errors = 0
    for r in results:
        if isinstance(r, Exception):
            errors += 1
            print(f"  error: {type(r).__name__}: {r}", file=sys.stderr)
        else:
            all_latencies.extend(r)

    print(f"\nResults — {len(all_latencies)} turns across {args.matches - errors}/{args.matches} matches in {elapsed:.2f}s")
    if errors:
        print(f"  {errors} match(es) failed")
    if all_latencies:
        all_latencies.sort()
        print(f"  Per-turn latency:")
        print(f"    p50  = {statistics.median(all_latencies)*1000:6.1f} ms")
        print(f"    p95  = {all_latencies[int(len(all_latencies)*0.95)]*1000:6.1f} ms")
        print(f"    p99  = {all_latencies[int(len(all_latencies)*0.99)]*1000:6.1f} ms")
        print(f"    max  = {max(all_latencies)*1000:6.1f} ms")
        print(f"  Throughput: {len(all_latencies)/elapsed:.1f} turns/s")


if __name__ == "__main__":
    asyncio.run(main())
