# Ki Clash — Go game server

Standalone WebSocket gateway for PvP game sessions, written in Go.

## Why it exists

The Python platform server handles auth / matchmaking / rooms / DB. The
WebSocket game loop is the hot path — at scale (5k+ concurrent players)
Go's per-goroutine memory profile and tighter scheduling win versus
Python+asyncio.

This server reads/writes the **same Redis state** as Python (DR-15 —
workers are stateless w.r.t. game state). Both servers can run side-by-side;
a reverse proxy routes `/api/v1/ws/game/*` to whichever you trust today.

## Boundaries

| Concern | Owner |
|---|---|
| Auth (JWT issue/refresh) | Python |
| Matchmaking queue | Python |
| Rooms (create/join/ready) | Python |
| User profile / matches / Stripe | Python |
| Realtime WebSocket game loop | **Go** (eventually) |

## Local run

```bash
# 1. Make sure docker compose is up so Postgres + Redis exist
cd ..
docker compose up -d

# 2. Run the Go server (defaults to :8001 to avoid colliding with Python :8000)
cd go-server
export JWT_SECRET_KEY=$(grep '^JWT_SECRET_KEY' ../.env 2>/dev/null | cut -d= -f2 || echo dev-secret)
go run .

# Smoke test
curl http://localhost:8001/health
# {"status":"ok","server":"go"}
```

## Try a real WebSocket round-trip

```bash
# 1. Get an access token from the Python server
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/guest | jq -r .access_token)

# 2. Find or create a game (the easiest way is a Room — see the Python README)
#    For this smoke test, use any existing game_id from Redis:
GAME_ID=$(redis-cli --raw KEYS 'ki_clash:game:*' | head -1 | sed 's/^ki_clash:game://')

# 3. Connect — `websocat` makes this easy (brew install websocat)
websocat "ws://localhost:8001/api/v1/ws/game/$GAME_ID?token=$TOKEN"
# Expect: {"type":"go_server_connected","data":{...}}
# Type:   {"type":"ping"}
# Expect: {"type":"pong","data":{}}
```

## Production deployment

The Dockerfile builds a distroless ~25 MB image. The
`docker-compose.prod.yml` at repo root can be extended with a `game`
service that points at the same Redis + uses the same JWT secret.

When ready to cut traffic over:
1. Add `game` to docker-compose.prod.yml on EC2
2. Update `Caddyfile` so `/api/v1/ws/game/*` reverse-proxies to `game:8001`
3. All other routes continue going to `api:8000` (Python)
4. Watch logs — both servers see the same Redis state, so partial cutover
   is a zero-risk operation

## Current milestone (scaffold)

What works:
- ✅ JWT verify (HS256, same secret as Python)
- ✅ Load `PvPSessionState` from Redis using the canonical key
- ✅ WebSocket upgrade + per-player heartbeat ping
- ✅ Echo `ping` → `pong`, `submit_action` → `action_received`
- ✅ Distroless container build

What's next (next milestone):
- ❌ Full game loop port (turn arbitration, ki accounting, round/match resolution)
- ❌ Two-envelope action submission (currently just echo)
- ❌ Atomic state updates (Lua script equivalent of Python's WATCH/MULTI/EXEC)
- ❌ Per-player Redis pub/sub for cross-instance message routing (port of DR-13)
- ❌ Disconnect/reconnect handling (port of DR-11)

When those ship, the Caddy route swap above becomes safe.
