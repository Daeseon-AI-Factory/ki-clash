<div align="center">

# Ki Clash · 기싸움

**A real-time 1v1 ki-battle game — read your opponent, charge your ki, strike at the right moment**

<sub>FastAPI + **two parallel runtimes** (Python + Go) sharing the same Redis state · Next.js 16 PWA · room-based PvP with Tekken-style 4-letter codes · 6 character ultimates · AI sprite pipeline</sub>

[**🌐 Live frontend → kiclash.daeseon.ai**](https://kiclash.daeseon.ai) · [GitHub](https://github.com/Daeseon-AI-Factory/ki-clash)

**English** · [한국어](./README.ko.md)

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)
![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Postgres-asyncpg-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-pub%2Fsub-DC382D?logo=redis&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Caddy](https://img.shields.io/badge/Caddy-Let's%20Encrypt-1F88C0)

</div>

---

> **TL;DR.** Real-time 1v1 PvP game based on the Korean schoolyard "기싸움" hand game. **Two backend runtimes share the same Redis-backed game state** — Python (auth / matchmaking / rooms / REST + WebSocket) is currently authoritative; a Go WebSocket gateway (full game loop ported, end-to-end tested) is wired to take over the hot path via a one-line Caddy route swap. **Tekken-style room PvP**: host creates a room → 4-letter code → friend joins → both pick a character → both ready → game spawns. The match-end finale dispatches to **6 character-specific ultimates** (wind vortex / lunar slash / solar flare / ice shatter / meteor strike / pink crystal storm). All 6 fighter sprites are real PNGs generated through a **Pollinations/flux → rembg transparent-BG → image-first fallback chain** pipeline (36 PNGs total: 6 characters × 6 poses).

## Table of contents

- [What is Ki Clash?](#what-is-ki-clash)
- [Why this project](#why-this-project)
- [Product walkthrough](#product-walkthrough)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Multiplayer correctness](#multiplayer-correctness)
- [Game engine & API](#game-engine--api)
- [Run it locally](#run-it-locally)
- [Deployment](#deployment)
- [Engineering log](#engineering-log)
- [Honest limitations](#honest-limitations)
- [Project layout](#project-layout)

---

## What is Ki Clash?

*Ki Clash (기싸움)* is the modern arcade port of the playground hand game every Korean kid recognizes: you and your opponent simultaneously **charge** ki, **block**, throw a **punch**, fire an **energy wave**, or **teleport** out of the way. Both moves reveal at the same instant, the outcome matrix decides who took damage, who built ki, who got dodged. First to win **2 of 3 rounds** takes the match.

Two ways to play:

1. **Quick Match** — open the lobby, get auto-matched with the next available opponent in the global queue.
2. **Create / Join Room** — host gets a 4-letter code, shares it (Slack / iMessage / verbally), friend joins, both pick a character, both ready up, game spawns. This is the "interviewer can play with me in 30 seconds" path.

Six characters, each with their own signature ultimate that fires on the final blow of the match.

---

## Why this project

> *For reviewers in a hurry — the engineering this repo actually demonstrates.*

- **🔀 Two parallel server runtimes, one shared truth.** Python and Go both read/write the same Redis JSON blob (`ki_clash:game:{id}`) for game state. Either can serve a given WebSocket connection; the canonical pattern (load → mutate in a `WATCH`/`MULTI`/`EXEC` closure → publish to per-player Redis channels) is ported byte-for-byte across runtimes. End-to-end verified: a room spawned via the Python REST endpoint, both players connect over Go's WebSocket, both submit `charge`, both receive correctly-personalized `turn_result` envelopes with the right ki accounting (Go E2E test in `go-server/test_e2e.py`, passes).
- **🛡️ Distributed-state hardening, with the bugs documented.** Four real PvP-concurrency bugs found by an in-process simulator and fixed (spurious `opponent_reconnected` on first connect, duplicate `waiting_for_action` when `start()` was called from two places, message ordering, `action_confirmed` missing `turn_number`). All four are in [`docs/troubleshooting.md`](./docs/troubleshooting.md) with symptoms / causes / commit hashes and a Python integration test (`tests/integration/test_pvp_flow.py::TestPhase3Regressions`) so they don't return.
- **🧠 15 written design decisions.** The engineering log's `## Engineering Decision Reference` carries DR-1 through DR-15 — each a 100-300-line entry: backend language (Python vs Spring vs Go), visual aesthetic, asset pipeline shape, JWT recovery strategy, `xfail` policy, real Redis vs fakeredis in tests, stateless workers + Redis-as-truth, per-player pub/sub topology, optimistic concurrency for turn submission, and more.
- **🎨 An AI sprite pipeline that survives copyright + transparency review.** 36 fighter PNGs (6 characters × 6 poses each: idle / windup / impact / hit / ko / victory), all generated through **Pollinations/flux** with character-specific prompts, then re-processed through **rembg (U2Net)** to strip the white backgrounds left by the generator. The component picks the right PNG per pose; when a pose-specific PNG is loaded, the CSS "puppet" rotation transforms drop down to subtle scale-only so a `ko.png` (already lying down) isn't double-rotated. One regen pass already done on a sprite that landed too close to a specific licensed character.
- **🎬 6 character-specific signature ultimates.** Not one shared Kamehameha beam — each fighter gets their own multi-phase finisher (wind vortex with lightning, lunar eclipse slash with void portal, multi-beam solar flare, ice shatter with frozen-block + shard explosion, meteor bombardment with magma cracks, pink crystal storm with heart explosion). Each finisher is a dispatched motion-design component that hooks into the FinalBlowStage's charge → fire → hit → fly → land phase machine.
- **🧱 Built across ~3.5 months / 93 commits, with the log to prove it.** Public reasoning trail (`docs/engineering-log.md`, 2,136 lines; `docs/troubleshooting.md` problem-indexed) — every non-trivial choice annotated with the alternative considered, the trade-off accepted, and the pattern reused later.

---

## Product walkthrough

| Flow | What happens |
|---|---|
| **Lobby** | 3 cards: **Quick Match** · **Create Room** · **Join Room** (with inline 4-letter code input). |
| **Quick Match** | Joins the global Redis matchmaking queue. FIFO pairing — matched with the next person who joins. |
| **Create Room** | `POST /api/v1/rooms` issues a 4-letter code (32-char alphabet, ambiguous chars excluded — `1`/`I`/`L`/`0`/`O`). Host sees the code prominently with a copy button. |
| **Join Room** | Guest types the code, `POST /api/v1/rooms/{code}/join` pairs them in. Both players now see each other in the room. |
| **Pick + ready** | Each player picks one of 6 characters (`PUT /rooms/{code}/character`), then toggles ready (`PUT /rooms/{code}/ready`). When both are ready, the room auto-spawns the game (`POST /rooms/{code}/start`, idempotent — either client can call). |
| **Gameplay** | Each turn: 5-second countdown on a shrinking bar, pick one of 5 actions (Charge / Block / Attack / Energy Wave / Teleport). Auto-submit `charge` on timeout. Server resolves once both actions land, broadcasts personalized turn results. |
| **Round end** | Winner of the round shown, auto-advance after 4.5s. |
| **Match end** | Character-specific finale: charge → fire → hit (RGB chromatic split, 3-wave confetti, max screen-shake) → fly (debris swarm trailing the loser) → land (impact crater) → vignette → "VICTORY / DEFEAT / DRAW" text slam → stats panel slide-up with **Play Again**. |

The single-player flow uses the same game engine against a deterministic AI (`app/core/ai_opponent/`) at three difficulties (easy: random + bias toward charge · medium: pattern matching against your last few moves · hard: game-theory mixed strategy).

---

## Tech stack

| Layer | Choice |
|---|---|
| **Platform server** | Python 3.11 / FastAPI (async) — auth, matchmaking, rooms, profile, REST, the *currently authoritative* WebSocket. 5,313 LOC across 61 files. |
| **Game server** | Go 1.23 / gorilla/websocket — full PvP game loop ported (engine + session + Redis WATCH/MULTI/EXEC + per-player pub/sub + heartbeats). 2,018 LOC across 10 files. Same JWT secret as Python; same Redis namespace. Standalone Docker service in the production compose. |
| **Database** | PostgreSQL 16 + SQLAlchemy 2.0 async — users, matches, ranked Elo, purchases. |
| **State store** | Redis 7 — game session JSON (`ki_clash:game:{id}` with 1-hour TTL), matchmaking queue (sorted set), per-player pub/sub channels (`ki_clash:player:{id}`), rooms (`ki_clash:room:{code}`), rate-limit counters. |
| **Auth** | JWT (HS256) with guest-first issuance: a player can start playing without an email; later upgrades are optional. Frontend auto-recovers from a stale token (401 → re-issue guest → retry once). |
| **Payment** | Stripe Checkout for an ad-free pass (scaffolded with webhook handler; live keys via env). |
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 · `framer-motion` for choreography · `canvas-confetti` for impact bursts · `lottie-react` (installed; current FX in-house). 10,053 LOC across 46 files. |
| **AI opponent** | Pure-Python deterministic strategies — no LLM in the gameplay path (CLAUDE.md "Deterministic Backbone" rule). |
| **Sprite pipeline** | Pollinations/flux text-to-image · `rembg` (U2Net) background removal · 3-step fallback (`<pose>.png` → `idle.png` → procedural SVG chibi). 36 PNGs in `web/public/fighters/`. |
| **Reverse proxy** | Caddy 2 — automatic Let's Encrypt SSL, env-driven `API_DOMAIN`, WebSocket upgrade handled automatically. Routes `/api/v1/ws/game/*` to the Go service and everything else to Python. |
| **Observability** | Structured JSON logging (stdlib) on both runtimes, Prometheus `/metrics` on both, optional Sentry (opt-in via `SENTRY_DSN`). |
| **Tests** | 112 Python test functions across 8 `tests/` modules (engine, game-store, matchmaking service, AI opponent, ws-manager pub/sub, logging, observability, integration PvP flow). 13 Go unit tests in `go-server/engine_test.go`. |

---

## Architecture

**One match, two runtimes, one Redis.** The hot-path WebSocket gameplay can be served by either Python or Go without the client noticing — both speak the same JSON envelopes, write the same Redis keys, and use the same JWT secret. Caddy is the single switch.

```
   Browser  (Next.js 16 PWA)            ┌────────────────────┐
    ├─ REST          ───────────────────│  kiclash.          │
    │                                   │  daeseon.ai        │
    │                                   │     ↓ Vercel       │
    │                                   │  static + SSR      │
    │                                   └────────────────────┘
    │
    │  WSS / HTTPS
    ▼
   api.kiclash.daeseon.ai     ┌─────── Caddy (Let's Encrypt) ───────┐
                              │                                     │
                              │   /api/v1/ws/game/*  →  game:8001   │  ← Go
                              │   everything else    →  api:8000    │  ← Python
                              │                                     │
                              └─────┬─────────────────────┬─────────┘
                                    │                     │
                            ┌───────▼──────┐      ┌───────▼─────┐
                            │ Python       │      │ Go game     │
                            │ FastAPI      │      │ server      │
                            │ (auth, rooms,│      │ (engine,    │
                            │  matchmaking,│      │  session,   │
                            │  REST, ws)   │      │  pub/sub)   │
                            └──┬─────┬─────┘      └──┬──────────┘
                               │     │               │
                       Postgres │     │ Redis ───────┘ (shared truth)
                       (users,  │     │   ki_clash:game:{id}    JSON sessions
                       matches) │     │   ki_clash:room:{code}  4-letter lobbies
                                │     │   ki_clash:matchmaking:queue  ZSET
                                │     │   ki_clash:player:{id}  pub/sub channels
```

**Key decisions** (full reasoning per DR-N in `docs/engineering-log.md` Part 2):

- **Stateless workers, Redis-as-truth (DR-15).** Per-game state lives in Redis only. Any worker on any runtime can serve a WebSocket for the game by loading the JSON blob; nothing is held in process memory beyond the open `WebSocket` connection itself. This is what makes Python + Go side-by-side safe.
- **Optimistic concurrency, not pessimistic locks (DR-14).** Two players submitting actions in the same sub-millisecond window go through Redis `WATCH` / `MULTI` / `EXEC` with a 3-retry budget. Both Python (`watch_and_update`) and Go (`Store.watchAndUpdate`) implement the same pattern. Sub-digit per-day contention at current scale; Lua scripts are scoped as future work (`go-server/submit_action.lua` exists as a proof-of-concept — deferred when Redis's `cjson` mangled empty-array round-trips with Python's Pydantic; documented inline).
- **Per-player pub/sub channels (DR-13).** When the server needs to push to a player, it sends to the local WebSocket if held; otherwise it `PUBLISH`es on `ki_clash:player:{id}` and whatever instance holds the connection relays it. This makes cross-runtime push correct: Python can push to a Go-served player and vice-versa.
- **Two-envelope action submission, atomic resolution.** Server holds both players' actions until both have submitted, then resolves the turn in a single atomic write. Closes the four PvP-concurrency bugs found in Phase 3 (in `docs/troubleshooting.md`).
- **Lazy / conditional integration (DR-9).** Sentry, Prometheus, Stripe — every external integration is a no-op without its env var. Local dev needs zero accounts.

---

## Multiplayer correctness

The five concrete things that make a 1v1 turn-based PvP game hard, and how they're handled here.

| Concern | Implementation |
|---|---|
| **Simultaneous actions** | Two-envelope pattern. The server stores `p1_action` / `p2_action` separately and only `resolveTurn`s when both are present. The atomic Redis update both **stores** the second submission and **clears** both fields in the same `EXEC` — there's no window where one is set and the other is being read by a stale worker. |
| **Concurrent submissions in the same ms** | `WATCH` / `MULTI` / `EXEC` with a 3-retry budget. Verified by an in-process PvP simulator (`scripts/pvp_simulator.py`) and matchmaking-service tests in `tests/services/test_matchmaking_service.py`. |
| **Client-server message ordering** | `action_confirmed` envelopes carry the explicit `turn_number` they apply to, so the client correlates them with its own submission rather than relying on arrival order. (This was Phase 3 Bug 4 — a stale `action_confirmed` for turn 5 could otherwise be interpreted as confirming the turn-6 submission already in flight.) |
| **Disconnect / reconnect** | 30-second forfeit timer fires per disconnected player. On fire it **re-reads Redis** — if `connected_players` shows the player reconnected to any worker (Go or Python) within the window, the forfeit is a no-op. Both runtimes update the same set. |
| **First-connect vs reconnect** | A single `handle_connect(game_id, player_id)` decides inside the atomic update: if the player's id is already in `connected_players` it's a reconnect (notify opponent + resend state); otherwise add and continue silently. Replaces an earlier if/else in the WebSocket endpoint that mis-fired `opponent_reconnected` on the very first connection (Phase 3 Bug 1). |

For the full timeline + the simulator output that surfaced these bugs, see `docs/engineering-log.md` Phase 3 section.

---

## Game engine & API

**Game rules** (`app/core/game_engine/types.py`):

| Constant | Value |
|---|---|
| `KI_CAP` | 10 (per-round ceiling) |
| `TURN_LIMIT` | 20 (round-end if neither lands a kill blow) |
| `ROUNDS_TO_WIN` | 2 (best of 3) |
| `TURN_TIME_LIMIT_SECONDS` | 5 (auto-submit `charge` on timeout) |

**Outcome matrix** (`app/core/game_engine/outcome_matrix.py`): a hand-tuned 5×5 table mapping `(p1_action, p2_action) → outcome`. Examples: `Attack ⨯ Charge → P1 wins round` (you read the charge); `Energy Wave ⨯ Block → P1 wins round` (energy wave pierces block); `Energy Wave ⨯ Teleport → dodged`; `Attack ⨯ Attack → clash` (both lose ki). The matrix is tested cell-by-cell in `tests/core/test_game_engine.py` and `go-server/engine_test.go` — both runtimes resolve identically.

**API surface** (`app/api/v1/`) — 23 endpoints across 7 routers:

```
Auth          POST  /api/v1/auth/guest                 issue a guest JWT
              POST  /api/v1/auth/upgrade               attach email/name to a guest
              POST  /api/v1/auth/refresh

Players       GET   /api/v1/players/me                 profile + stats
              GET   /api/v1/players/me/matches         match history

Games (vs AI) POST  /api/v1/games/ai                   start an AI match
              GET   /api/v1/games/{id}
              POST  /api/v1/games/{id}/action          submit an action

Rooms (PvP)   POST  /api/v1/rooms                      create — returns 4-letter code
              GET   /api/v1/rooms/{code}               poll state (member-gated)
              POST  /api/v1/rooms/{code}/join
              PUT   /api/v1/rooms/{code}/character
              PUT   /api/v1/rooms/{code}/ready
              POST  /api/v1/rooms/{code}/start         idempotent, spawns the game
              POST  /api/v1/rooms/{code}/leave

Ranked        GET   /api/v1/ranked/leaderboard
              GET   /api/v1/ranked/me

Purchases     POST  /api/v1/purchases/checkout/ad-free Stripe Checkout session
              GET   /api/v1/purchases/ad-free-status
              POST  /api/v1/purchases/webhook          Stripe webhook (signature-verified)

WebSocket     /api/v1/ws/matchmaking?token=...         join the quick-match queue
              /api/v1/ws/game/{game_id}?token=...      gameplay channel

Ops           GET   /health
              GET   /metrics                            Prometheus exposition
```

---

## Run it locally

**Local dev needs no external accounts** — no Stripe, no Sentry, no AWS, no domain. Docker Compose brings up the stack; everything else is graceful no-ops.

```bash
# Repo + backend
git clone https://github.com/Daeseon-AI-Factory/ki-clash.git
cd ki-clash
docker compose up -d              # Postgres + Redis + Python API on :8000
docker compose exec api alembic upgrade head

# Frontend
cd web
npm install
npm run dev                       # http://localhost:3000

# Verify
curl http://localhost:8000/health    # → {"status":"ok"}
open http://localhost:3000           # play an AI match
```

**Try PvP locally**: open the app in two browsers (one regular, one incognito) → both go to `/pvp` → one taps **Create Room**, copies the 4-letter code → the other taps **Join Room**, types the code → both pick a character → both ready → match starts.

**Try the Go game server (optional)** — runs on `:8001`, shares the same Redis:

```bash
brew services stop redis             # if you have a host Redis listening on 6379
cd go-server
JWT_SECRET_KEY=$(cd .. && docker compose exec -T api python -c \
  "from app.config import settings; print(settings.jwt_secret_key)") \
go run .

curl http://localhost:8001/health    # → {"status":"ok","server":"go"}
python3 test_e2e.py                  # full game-loop smoke test against Go
```

**Run the tests:**

```bash
docker compose exec api python -m pytest        # 112 Python test functions, 8 files
cd go-server && go test ./...                   # 13 Go test functions
```

---

## Deployment

Hybrid plan locked in: **Vercel (frontend) + AWS EC2 free-tier t3.micro (backend)** + DNS at `daeseon.ai` registrar.

**Live as of writing:**

| Service | Status |
|---|---|
| `https://kiclash.daeseon.ai` (Vercel — Next.js frontend) | ✅ Live |
| `https://api.kiclash.daeseon.ai` (EC2 — Python + Go + Postgres + Redis + Caddy via `docker-compose.prod.yml`) | ⏳ Scaffolded, not yet provisioned |

The full step-by-step (security group, Elastic IP, DNS A/CNAME records, `openssl rand` secret generation, `docker compose up -d --build`, Caddy auto-issuing the Let's Encrypt cert) is in [`deploy/aws-ec2/QUICKSTART.md`](./deploy/aws-ec2/QUICKSTART.md) with [`deploy/aws-ec2/README.md`](./deploy/aws-ec2/README.md) as the long-form companion.

> **Vercel monorepo note.** This is a polyrepo where the Next.js project lives at `web/` (the repo root holds the Python backend + Go server + docs). In the Vercel dashboard, set **Settings → General → Root Directory → `web`** so the build runs from the right place.

Production stack (single instance, scales to ~100 concurrent matches on free tier; horizontal scale via DR-15's statelessness when needed):

```
EC2 t3.micro (Ubuntu 24.04)
└── docker-compose.prod.yml
    ├── caddy   (80/443 — Let's Encrypt auto-SSL, reverse proxy)
    ├── api     (Python FastAPI, 2 uvicorn workers)
    ├── game    (Go WebSocket gateway)
    ├── db      (Postgres 16 — pgdata volume)
    └── redis   (Redis 7 — AOF persistence)
```

---

## Engineering log

The repo keeps a disciplined, **anti-fabrication** writing pile. Every commit hash cited is real; every "Symptom" in the troubleshooting doc is the literal observed message; every Decision Reference entry names the alternatives that were considered and rejected.

- [`docs/engineering-log.md`](./docs/engineering-log.md) — 2,136 lines. **Part 0** is the "RESUME HERE" current-state snapshot; **Part 1** is the chronological build story (Phases 1 → 11); **Part 2** is the *Engineering Decision Reference* — DR-1 (backend language) through DR-15 (stateless workers + Redis-as-truth) — each entry a 100-300-line trade-off analysis with alternatives, rejected paths, and the reusable meta-pattern.
- [`docs/troubleshooting.md`](./docs/troubleshooting.md) — problem-indexed reference. Format per entry: **Symptom / Cause / Fix / Commit / Pattern**. Covers PvP bugs 1-4, the JWT 401 stale-token loop, a Pollinations rate-limit collision, the Lua `cjson` empty-array issue (deferred with reasoning), and others. Same anti-fabrication rules.
- [`docs/spec.md`](./docs/spec.md) — original product spec the whole MVP was built from (game rules, target instinct, revenue model, MVP scope).
- [`docs/architecture.md`](./docs/architecture.md), [`docs/multiplayer-networking.md`](./docs/multiplayer-networking.md), [`docs/firefly-prompts.md`](./docs/firefly-prompts.md) — supporting design / ops docs.

**Stats** (verified, not inferred):

```
$ git log --oneline | wc -l
   93
$ git log --reverse --format='%ai' | head -1   # first commit
2026-02-12 16:07:43 +0900
$ git log -1 --format='%ai'                    # latest commit (at time of writing)
2026-06-02 15:17:24 -0400
```

---

## Honest limitations

> Stated plainly, because knowing the edges is part of the engineering.

- **EC2 backend not yet provisioned.** The frontend on Vercel is live; the backend `docker-compose.prod.yml` + Caddyfile + deploy runbook are committed and ready, but EC2 launch / DNS A record / first deploy are pending and require interactive AWS-console work.
- **No automated frontend tests.** 112 Python test functions cover the engine, the matchmaking service, the game store, the AI opponent, the WebSocket manager's pub/sub, observability, and an integration PvP flow. 13 Go unit tests cover the engine cell-by-cell + perspective-flip helpers. The web frontend currently has zero automated tests — verified manually via `npm run dev` + browser DevTools. A test suite for the React components is the obvious next investment.
- **Go runtime is wired but not authoritative.** End-to-end verified that the Go game server can serve a real Python-issued game session correctly. `docker-compose.prod.yml` ships with `game` running alongside `api`, and the Caddyfile route to it is committed — flipping it on is a one-line uncomment + redeploy. Until then Python serves real users.
- **Lua atomic submit deferred.** Wrote `go-server/submit_action.lua` as a single-round-trip atomic alternative to `WATCH`/`MULTI`/`EXEC`. Hit Redis's `cjson` empty-array-as-object encoding limitation (Python's Pydantic strict-mode rejected the round-tripped JSON). Reverted to `WATCH`/`MULTI`/`EXEC`, which is fine at current scale (contention is single-digit/day). Documented inline in `go-server/session.go::submitAction`.
- **Some sprite generations land closer to specific licensed characters than is comfortable for commercial release.** One regen pass already done on the most blatant case (replaced a Konoha-style headband with a generic red sweatband). The honest path for a real commercial launch is Adobe Firefly (commercially indemnified by Adobe) or a commissioned artist — the file path `/fighters/<id>/<pose>.png` makes that a drop-in swap with zero code changes.
- **Cross-instance disconnect detection now uses Redis** — verified by code review, not yet stress-tested against an actual multi-instance deploy.
- **Mobile (Expo) target paused.** Originally in scope, deferred due to peer-dep conflicts between React 19 and Reanimated/Skia. The frontend works as a PWA on mobile browsers in the meantime.

---

## Project layout

```
app/                                FastAPI backend (Python 3.11, async)
  api/v1/
    router.py                       aggregator
    endpoints/{auth,games,players,ranked,purchases,rooms,ws}.py
  core/
    auth/                           JWT (HS256) + guest auth
    game_engine/                    pure engine: types, outcome_matrix, engine
    ai_opponent/                    easy / medium / hard deterministic strategies
    game_store.py                   Redis-backed PvP session — WATCH/MULTI/EXEC
    room_store.py                   Tekken-style rooms with 4-letter codes
    ws_manager/                     per-player pub/sub (DR-13)
    logging.py  observability.py    JSON logs + Prometheus + Sentry init
  modules/ki_clash/game_session.py  stateless PvP session orchestration (DR-15)
  services/                         matchmaking, game, ranked, payment, player
  models/  schemas/                 SQLAlchemy + Pydantic
go-server/                          Go 1.23 — full game-loop runtime (2 KLOC)
  main.go  handler.go  session.go  engine.go  store.go  pubsub.go  messages.go
  auth.go  types.go  observability.go
  engine_test.go                    13 unit tests for engine + helpers
  test_e2e.py                       end-to-end smoke (Python rooms → Go WS)
  submit_action.lua                 atomic submit (deferred — see Limitations)
  Dockerfile                        multi-stage distroless build (~25 MB)
web/                                Next.js 16 (App Router) PWA
  src/app/{,/pvp,/tutorial,/shop,/invite,/history,/ranked}/page.tsx
  src/components/
    arena/{KiAuraArena,FighterSprite,CharacterAvatar}.tsx
    finale/{MatchFinale,CharacterFinishers}.tsx
    room/RoomScreen.tsx
    GameBoard.tsx  MatchHUD.tsx  TurnReveal.tsx  Countdown.tsx  …
  src/hooks/{useGame,usePvP,useActionAnimation,useSoundEffects,useAdTiming}.ts
  src/lib/{api,characters,actions,assets,sound}.ts
  public/fighters/<id>/{idle,windup,impact,hit,ko,victory}.png  ← 36 PNGs
docs/                               engineering-log · troubleshooting · spec · …
deploy/aws-ec2/                     QUICKSTART.md · README.md · .env.prod.example
docker-compose.yml                  dev: db + redis + api
docker-compose.prod.yml             prod: + game (Go) + caddy
Caddyfile                           reverse proxy + automatic Let's Encrypt SSL
tests/                              112 Python test functions across 8 files
CLAUDE.md                           project conventions for AI-assisted edits
```

---

<div align="center">

**[Ki Clash · 기싸움](https://kiclash.daeseon.ai)** — read your opponent, charge your ki, strike at the right moment.

<sub>Repo: [Daeseon-AI-Factory/ki-clash](https://github.com/Daeseon-AI-Factory/ki-clash) · Live frontend: [kiclash.daeseon.ai](https://kiclash.daeseon.ai) · [한국어 README](./README.ko.md)</sub>

</div>
