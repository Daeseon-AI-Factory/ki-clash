# Ki Clash — Engineering Log

> Chronological record of every non-trivial engineering decision and step.
> Read top-to-bottom to reconstruct the project's full reasoning. Updated
> as work proceeds, not retroactively.
>
> This doc serves two purposes:
> 1. **Project memory** — what was done when, with commit pointers
> 2. **Engineering growth artifact** — why each decision was made, what
>    alternatives were considered, what trade-offs were accepted, what
>    meta-pattern is reusable elsewhere
>
> Read with two audiences in mind: future-Jason debugging next month,
> and a Toronto staff-engineer interviewer probing why you chose X.

**Structure:**
- Part 0 (immediately below): **RESUME HERE** — current state + next steps
- Part 1: chronological story
- Part 2 (`## Engineering Decision Reference`): topic-organized deep dives
  on every major decision, with trade-off tables, alternatives
  rejected, and meta-patterns

---

# Part 0 — RESUME HERE (last updated 2026-06-10, load-testing + CI session)

> Read this first when picking the project back up. Single
> "where are we / what's next" snapshot. Parts 1-2 below are full history.

## 🟢 IT IS LIVE — current state at a glance

```
Frontend (Vercel):   https://jjan.daeseon.ai          (also /pvp, /pixi-test)
Backend  (AWS EC2):  https://api.jjan.daeseon.ai       (Seoul ap-northeast-2)
Brand:               JJAN! · 짠   (renamed from "Ki Clash")
PWA:                 installable to phone home screen (manifest + sw.js)
```

```
Phase 1-10 (backend, Go port, visuals, Room PvP)   ✅ DONE
Phase 14 (AWS deploy via Terraform IaC)            ✅ DONE — LIVE
PixiJS WebGL effects (DR-17/18)                    ✅ DONE — additive overlay
Mobile responsive single-screen layout             ✅ DONE — AI + PvP
CI (GitHub Actions) + k6 load suite (DR-19)        ✅ DONE — merge gate
Capacitor (real App Store / Play Store app)        ⏳ NOT STARTED (next)
```

**Git:** clean, pushed, `main` == `origin/main`. **Infra:** `infra/aws/` is
Terraform (state local; `terraform output` for IP/SSH). EC2 = single t3.micro,
`docker compose -f docker-compose.prod.yml` (api **--workers 1**, game, db,
redis, caddy). SSH: `ssh -i ~/.ssh/jjan_aws ubuntu@$(cd infra/aws && terraform output -raw public_ip)`.

## What this session (2026-06-07) shipped

- **AWS deploy** (Terraform IaC, EBS-separated data vol, 2GB swap, Caddy SSL).
- **Fixed (live-verified):** PvP client-ready handshake (DR-16); mid-match
  disconnect pause + reconnect notify + forfeit stats; `/health` HEAD;
  single-player "Game not found" (was 2 uvicorn workers + in-memory state →
  `--workers 1`); pubsub listener crash (`listen()` → `get_message` poll).
- **PixiJS WebGL effects** (DR-17). ⚠️ **LESSON (DR-18, memory
  `feedback-additive-not-replace`):** first wrongly REPLACED the dynamic
  KiAuraArena (deleted its motion) — reverted, then re-added effects as a
  transparent `PixiFxOverlay` ON TOP. Enhance = compose, never replace.
- **Mobile:** unified each page's gameplay phases into ONE fixed skeleton
  (HUD + capped arena `max-h-[34svh]` + `min-h` bottom slot that swaps
  content) so the layout never reflows/clips/scrolls; `100svh`; dark body
  (no white band); compact ActionCards; bold ROUND; in-game history removed.
- **Version tags:** `v-dom-arena` / `v-pixi-arena` / `v-pixi-wide` (on GitHub).

## What this session (2026-06-10) shipped

Test-infrastructure pass — no product change, just the safety net the
ship-fast flow had been running without. See **DR-19** for the reasoning.

- **CI pipeline** (`3362f9b`, `.github/workflows/ci.yml`) — the merge gate the
  manual + Vercel-auto-deploy flow lacked (Vercel was CD-only, no test gate).
  As committed, three jobs on every push to `main` and every PR: `python-test`
  (pytest on `postgres:16` + `redis:7` service containers, `alembic upgrade head`
  first; integration tests auto-skip without a live stack), `go-test`
  (`go test ./...` in `go-server`, Go 1.25, no external deps), `web-build`
  (`tsc --noEmit` + `next build` — catches the TS/build breaks the PixiJS work
  kept hitting). `concurrency` + `cancel-in-progress` kills stale runs.
  *(The working tree has since grown three more jobs — mobile iOS-bundle export
  + online-parity + launch-marketing link checks — not yet committed.)*
- **k6 load/perf suite** (`5837e07`, `load/` — 5 files, 318 insertions):
  `smoke.js` (1-VU whole-stack: vs-AI + Room-PvP + one WS connect),
  `rest_load.js` (ramping REST, vs-AI 70% / Room-PvP 30%, latency + error
  thresholds), `ws_load.js` (N concurrent Go game-server sockets =
  connection-capacity probe), shared `lib.js` flow helpers. `BASE_URL` defaults
  to live `api.jjan.daeseon.ai` with deliberately gentle load (single t3.micro);
  thresholds `http_req_failed < 2%` and `http_req_duration p(95) < 1.5s` make k6
  exit non-zero, so they double as gates. Smoke verified live: 100% checks,
  http p95 ~500ms.

## Next steps (pick up here)

1. **Capacitor = real app** (user opted "scaffold only, store later"). Tooling
   READY on this Mac: Xcode 26.5 + CocoaPods installed; static-export is
   feasible (0 server routes/actions/next-image/dynamic-routes). Keep the
   Vercel web build intact — use a SEPARATE capacitor build (don't globally
   set `output:'export'`). Store submission needs Apple $99/yr (+ Google $25).
2. **Room PvP real test** — needs 2 devices (Quick Match solo just times out
   after 30s = "no opponent found", which is EXPECTED, not a bug).
3. Effects/content polish; later: multi-instance → move single-player game
   state to Redis (see troubleshooting "Game not found" follow-up).

## What's deployed / running (also: local dev)

- **LIVE** at the URLs above. To redeploy backend: SSH in, `cd ~/app`,
  `git pull`, `docker compose -f docker-compose.prod.yml build <svc> && up -d <svc>`.
  Frontend auto-deploys from `main` push (Vercel).
- Local dev:
  - Docker stack (Postgres + Redis + Python API on :8000) — `docker compose up -d`
  - Web dev server (Next.js on :3000) — `cd web && npm run dev`
  - Go server (full game loop on :8001) — `cd go-server && JWT_SECRET_KEY=$(docker compose exec -T api python -c "from app.config import settings; print(settings.jwt_secret_key)") go run .`

## How to restart the local environment

```bash
# 1. Backend stack
cd /Users/daeseonyoo/Documents/GitHub/ai-product/ki-clash
docker compose up -d
docker compose exec api alembic upgrade head    # if DB was reset

# 2. Web dev server
cd web && npm run dev    # → http://localhost:3000

# 3. (Optional) Go game server — only needed for Go-path testing
cd go-server
brew services stop redis    # avoid host-Redis vs Docker-Redis collision
JWT_SECRET=$(cd .. && docker compose exec -T api python -c "from app.config import settings; print(settings.jwt_secret_key)") \
JWT_SECRET_KEY=$JWT_SECRET go run .

# 4. Verify
curl http://localhost:8000/health   # → {"status":"ok"}     (Python)
curl http://localhost:8001/health   # → {"status":"ok","server":"go"}

# 5. Run the Python test suite
cd /Users/daeseonyoo/Documents/GitHub/ai-product/ki-clash
python3 -m pytest    # → 149+ passed

# 6. Run the Go E2E smoke
cd go-server && python3 test_e2e.py
```

## Phase 9 — exact next steps for Jason (deploy) — ✅ SUPERSEDED (deploy DONE 2026-06-07; now on `jjan.daeseon.ai` / `api.jjan.daeseon.ai`, kept below for history)

Domain plan locked in: **`kiclash.daeseon.ai`** (Vercel apex)
+ **`api.kiclash.daeseon.ai`** (AWS EC2 backend).

Full step-by-step in `deploy/aws-ec2/QUICKSTART.md`. Summary:

```
A. AWS EC2 (~25 min):
   1. Launch t3.micro Ubuntu 24.04, security group 22/80/443
   2. Elastic IP → attach
   3. SSH in → install docker.io docker-compose-plugin git
   4. DNS at daeseon.ai provider:
        A     api.kiclash.daeseon.ai → <Elastic IP>
        CNAME kiclash.daeseon.ai     → cname.vercel-dns.com
   5. git clone https://github.com/Daeseon-AI-Factory/ki-clash.git /opt/ki-clash
   6. cp deploy/aws-ec2/.env.prod.example .env
        openssl rand -hex 32     → JWT_SECRET_KEY
        openssl rand -base64 24  → POSTGRES_PASSWORD
        (nano .env, paste both)
   7. docker compose -f docker-compose.prod.yml up -d --build
        — boots api (Python), game (Go), redis, db, caddy
        — caddy auto-fetches Let's Encrypt cert on first request
   8. docker compose -f docker-compose.prod.yml exec api alembic upgrade head

B. Vercel (~5 min):
   1. cd web && npx vercel login (GitHub auth)
   2. npx vercel               (first deploy)
   3. Dashboard: set NEXT_PUBLIC_API_URL = https://api.kiclash.daeseon.ai
   4. npx vercel --prod
   5. Add custom domain kiclash.daeseon.ai → SSL auto

C. Smoke test:
   Open https://kiclash.daeseon.ai → PvP → Create Room → grab code
   → incognito tab → Join Room → both pick + ready → match plays through
```

**Key files (already committed + pushed):**
- `deploy/aws-ec2/QUICKSTART.md` — tight copy-paste sequence for Jason
- `deploy/aws-ec2/README.md` — full background docs
- `docker-compose.prod.yml` — api (Python) + game (Go) + redis + db + caddy
- `Caddyfile` — `/api/v1/ws/game/*` → Go service, rest → Python
- `deploy/aws-ec2/.env.prod.example` — env template (kiclash.daeseon.ai defaults)
- `web/.env.production.example` — Vercel env template

## Mental model reminders (don't re-derive these)

- **Backend is production-ready.** Python (149+ tests, distributed Redis,
  JWT auto-recovery, Stripe/Sentry/metrics) + Go (full game loop ported,
  E2E tested). Either runtime serves the same Redis state — switching
  game traffic between them is a one-line Caddy edit.
- **Rooms (Phase 8)** are how friends invite each other — Quick Match
  still works too. Both flow through the same WS endpoint (now Go in prod).
- **Graphics (Phase 7G)** are real Pollinations/flux PNGs at
  `web/public/fighters/<id>/idle.png`. SVG fallback retained. Some PNGs
  land uncomfortably close to specific anime characters — fine for
  portfolio/MVP, regenerate via Adobe Firefly before revenue.
- **Go (Phase 10)** is the systems-design artifact + horizontal-scaling
  story. Python remains authoritative for auth/rooms/REST; Go owns the
  hot-path game loop in prod.

## Open follow-ups (post-deploy)

1. **Pose-specific PNGs** — only `idle.png` exists per character; the
   FighterSprite pipeline accepts `windup.png`, `impact.png`, etc. and
   falls back to idle. 30 extra generations would make per-action sprites.
2. **Firefly migration** — replace Pollinations PNGs with Adobe Firefly
   variants for commercial indemnification (only matters if revenue).
3. **Go regression tests** — currently only `go-server/test_e2e.py`
   smoke test. Port the Python pytest suite next pass.
4. **PvP character select for Quick Match** — currently fixed to
   haneul/bora; Room flow has full picker.

---

## 2026-05-24 — Project genesis

**Context:** Jason (5y SK AX backend, prepping for Toronto) initialized Ki Clash
as **Product003** of his AI Product Factory. Game concept: real-time 1v1
strategy based on the Korean schoolyard "기싸움" (Korean ki-battle) hand
game. Best-of-3 rounds, 5 actions (Charge / Block / Attack / Ki Burst /
Teleport), simultaneous reveal, ki economy.

**Original tech stack (per `docs/spec.md` + `CLAUDE.md` defaults):**
- Backend: Python 3.11 / FastAPI / SQLAlchemy 2.0 async / PostgreSQL / Redis
- Realtime: FastAPI WebSocket
- Auth: JWT (guest-first, optional email upgrade)
- Payment: Stripe
- Web: Next.js 16 + Tailwind 4 + lottie-react
- Mobile: Expo 54 + React Native + expo-av + expo-haptics
- Deploy: Railway (backend), Vercel (web), Docker
- AI Opponent: Deterministic algorithms (no LLM)

**Initial structure** at first commit:
```
app/                       # FastAPI backend
├── core/                  # CORE_CANDIDATE — reusable
│   ├── game_engine/       # outcome matrix + state machine
│   ├── ai_opponent/       # easy / medium / hard
│   ├── ws_manager/        # WebSocket connection registry
│   ├── auth/  payment/
├── services/              # game / matchmaking / ranked / payment / player
├── api/v1/endpoints/      # REST + ws
├── models/ schemas/ modules/ki_clash/
web/                       # Next.js
mobile/                    # Expo
docs/                      # spec.md, architecture.md, tasks.md, PROJECT_GUIDE.md
```

---

## 2026-05-25 — Strategy discussions (no code change)

Deep alignment session on tech direction. **Outcomes saved to project memory:**

1. **Python platform server stays.** Per-product Spring would be technically
   cleaner for Ki Clash, but breaks the Factory thesis — future LLM products
   need Python core. Decision: stay Python, document the rationale.

2. **Game server → Go (eventually).** Industry standard 2-tier split:
   - Go game server (WebSocket gateway, matchmaking, PvP session)
   - Python platform server (auth, payment, profile, history)
   - Sub-ms GC, lightweight goroutines vs Python GIL.
   - Defer until DAU 500+ per "Build for 100, optimize later" rule.

3. **Visual direction: NOT pixel art.** Initial pixel-art system in
   `web/src/components/pixel-art/` rejected by Jason as "indie cheap." Target
   aesthetic: modern anime card game (Marvel Snap / Slay the Spire /
   Reigns refs), with high-impact arcade effects rendered legally safe
   (original characters, generic effect names, anime style is genre-neutral).

4. **AI as visual director, not designer.** Jason will use Adobe Firefly /
   DALL-E / Suno + Figma curation. ~80 hours of skill investment, compounds
   across products, content channel, and AI video creation ambitions.

5. **Workflow split locked in:**
   - Claude.ai web (chat + Artifacts) → design ideation, prompt iteration,
     screenshot critique
   - Claude Code (this) → code integration, asset wiring, dev server, git
   - Figma + Firefly → actual canvas work
   - Browser → Pinterest / Mobbin / Dribbble references

---

## 2026-05-26 — Roadmap commitment

Locked in a 5-phase code roadmap, sequential not parallel:

| # | Phase | Estimate | Why this order |
|---|---|---|---|
| 1 | Asset pipeline + frontend prep | 2-3 days | Unblocks Jason's design work, zero dependencies |
| 2 | Tests + observability | 3-4 days | Lock in current behavior as spec for Go port |
| 3 | PvP hardening (Python) | 4-5 days | Validate reconnect/error patterns before porting |
| 4 | Distributed game state (Redis) | 3-4 days | Externalize state; absorbed into Phase 5 |
| 5 | Go game server (new build) | 2-3 weeks | Sub-ms latency for 5000+ concurrent |

**Key principle:** "Make it work → make it right → make it fast." Phase 1-4
make it right in Python; Phase 5 makes it fast in Go.

---

## 2026-05-26 — Phase 1: Asset pipeline + frontend prep ✅

**Commit:** `f1233c4 feat: scaffold asset pipeline + character/icon fallback components`

**Context:** Components had hardcoded emojis (⚡🛡️👊🔥💨) and pixel-art
character portraits. No way for designs to flow in.

**Goal:** Set up "drop-in" asset pipeline so as designs arrive, components
auto-pick them up without code changes, with graceful emoji fallback while
files are missing.

**What we did:**

1. **Moved pixel-art to deprecated/** (web + mobile)
   - `git mv` preserved history.
   - Internal cross-references updated via `sed`.
   - Path changes (12 files):
     - `web/src/components/pixel-art/` → `web/src/components/deprecated/pixel-art/`
     - `web/src/lib/pixel-frames/` → `web/src/lib/deprecated/pixel-frames/`
     - `web/src/lib/pixel-art-types.ts` → `web/src/lib/deprecated/pixel-art-types.ts`
     - `web/src/lib/pixel-art-utils.ts` → `web/src/lib/deprecated/pixel-art-utils.ts`
     - `web/src/hooks/usePixelAnimation.ts` → `web/src/hooks/deprecated/usePixelAnimation.ts`
     - Mirror structure for mobile.
   - Old screens (MatchHUD, page.tsx, etc.) still compile via deprecated/
     imports → migrate per-screen as new portraits arrive.

2. **Created `lib/assets.ts`** (web + mobile, identical IDs):
   - Typed paths for `CharacterId`, `CharacterExpression`, `EffectId`,
     `BackgroundId`, `SoundId`.
   - Path helpers (`characterAsset`, `cardIconAsset`, `effectAsset`, etc.).
   - Web uses URL strings → `<img onError>` swap to emoji.
   - Mobile uses static `require()` manifest (Metro bundler requires static
     paths), returns `null` if entry missing → emoji fallback.
   - Tagged `# CORE_CANDIDATE` — pattern reusable for next products.

3. **New `CharacterPortrait` component** (web + mobile):
   - Renders image asset if known character ID + image loads OK.
   - Falls back to roster emoji on missing file or load error.
   - State: `imageBroken` boolean toggled by `onError`.
   - Replaces all `PixelPortrait` usage where new portraits are expected.

4. **Refactored `ActionCard`** (web + mobile):
   - Web: added `<ActionIcon>` inner component with `cardIconAsset(action)`
     → emoji fallback.
   - Mobile: added optional `iconAsset` prop (bundled require).

5. **Refactored `CharacterSelect`** (web + mobile):
   - Swapped `PixelPortrait` → `CharacterPortrait`. One-line change.

6. **Folder structure created:**
   - `web/public/{characters,cards,effects,backgrounds,sounds}/` with `.gitkeep`
   - `mobile/assets/{characters,cards,effects,backgrounds,sounds}/`

7. **Dependencies added** (with Jason's explicit approval per CLAUDE.md rule):
   - Web: `framer-motion`, `canvas-confetti`, `@types/canvas-confetti`
   - Deferred: `@tsparticles/react` (workspace:^ npm bug), mobile
     `react-native-reanimated` + `@shopify/react-native-skia` (peer dep
     conflict with react-dom 19.2.6) → revisit when particle work begins.

**Why this shape:**
- Single source of truth for asset paths → typed, no magic strings.
- Graceful degradation → game never breaks during dev/design handoff.
- Mobile and web share IDs → designer produces one asset set → both
  platforms consume.
- `CORE_CANDIDATE` tagging → next product (Product004) inherits the pattern.

**Decisions:**
- Plain `<img>` over Next/Image: Next/Image hides broken state behind its
  loader, complicating fallback UX. `<img onError>` is simpler.
- Move pixel-art rather than delete: preserves history, allows incremental
  per-screen migration instead of one big refactor.
- Mobile uses manifest pattern (static requires) not dynamic paths: Metro
  bundler limitation.

**Discoveries:**
- Pixel-art blast radius was bigger than expected (12+ files). Sed batch
  saved time.
- `@tsparticles/react` published with `workspace:^` ref → npm can't resolve.
  Known monorepo packaging issue. Pivoted around it.
- Mobile expo install ERESOLVE: peer dep conflict from react-dom 19.2.6
  pulled in by Skia. Deferred until particle integration phase.

**Verification:**
- `npx tsc --noEmit` clean on both web and mobile.
- `npx eslint` clean on refactored files.

**Next:** Move to Phase 2 — testing + observability.

---

## 2026-05-26 — Multiplayer networking reference doc

**Commit:** `0e289da docs: add multiplayer networking reference (Ki Clash + LoL/Valorant)`

**Context:** Jason asked "how does real-time state sharing actually work?"
(WebSocket conceptual gap), then "how do LoL/Valorant do it so smoothly?"

**Goal:** Consolidate the explanation into a permanent learning reference
that doubles as Toronto game/systems interview prep.

**What we did:**
- Wrote `docs/multiplayer-networking.md` (~470 lines, Korean).
- Latency budget framework as the organizing principle (turn-based 5000ms
  vs FPS 8ms).
- Two architecture patterns: server-authoritative vs latency hiding.
- 5 core techniques: client-side prediction, server reconciliation, lag
  compensation, high tick rate, UDP/QUIC.
- Supplementary techniques: interpolation, delta compression, regional
  servers, spectator delay, lockstep.
- Ki Clash code mapping (which file does what).
- Interview-ready answer template + keyword list.
- Curated reading list (Gambetta, Valve, Glenn Fiedler, Riot Eng Blog).

**Decisions:**
- Korean (Jason's request).
- Standalone doc, not embedded in spec.md — this is reference material, not
  product spec.
- Concrete code snippets from Ki Clash mapped to abstract concepts → makes
  it real, not just theoretical.

**Next:** Use this doc as reference when discussing Phase 3 (PvP hardening)
and Phase 5 (Go server).

---

## 2026-05-26 — PvP simulator + bug discovery

**Context:** Jason wanted to see the PvP server actually work end-to-end,
not just read code.

**What we did:**

1. **Started full stack via docker compose:**
   - PostgreSQL 16 (port 5432)
   - Redis 7 (port 6379)
   - FastAPI API (port 8000)
   - `docker compose up -d --build` (first build, ~90s)
   - Hit `/health` → `{"status":"ok"}` ✓
   - First `POST /api/v1/auth/guest` returned 500 → tables didn't exist.

2. **Diagnosed missing migrations:**
   - `docker-compose.yml` command overrides Dockerfile CMD, skipping
     `alembic upgrade head`.
   - Ran manually: `docker compose exec api alembic upgrade head`
   - Applied 2 migrations: `a67ac29dd885` (initial tables) +
     `b8f3c72e1a44` (ranked ELO fields).
   - Verified: guest endpoint now returns valid JWT.

3. **Wrote `scripts/pvp_simulator.py`** (~210 lines):
   - Two virtual players (P1 aggro weights, P2 defensive weights).
   - Concurrent guest registration via `httpx`.
   - Concurrent WS connections via `websockets` library.
   - Color-coded ANSI output: P1 red, P2 blue, server green, timestamp gray.
   - Drives full match flow: queue join → match_found → game WS →
     submit_action loop → match_result.
   - Weighted-random action selection respecting ki cost.

4. **Ran simulator with `--seed 42`:**
   - Full Bo3 match completed in ~12s.
   - Final score: 2-0.
   - All core flows worked: REST auth, matchmaking pairing, game WS,
     simultaneous reveal, perspective flipping, round/match termination.

**Discoveries (4 real bugs, Phase 3 targets):**

### Bug 1: Spurious `opponent_reconnected` on first connect
```
T+00489ms  P1  ←recv (unhandled) opponent_reconnected: {}
```
**Root cause:** `app/api/v1/endpoints/ws.py:158-162` — when P2 first connects,
the session already exists (P1 created it), so code falls into the
"reconnect" branch via `handle_reconnect()`. No distinction between
"first connect" and "reconnect after disconnect."

### Bug 2: Duplicate `waiting_for_action` per turn
```
T+07087ms  P1 ←recv waiting_for_action round=2 turn=3
T+07991ms  P1 ←recv waiting_for_action round=2 turn=3   (duplicate)
```
**Root cause:** `session.start()` called from two places in `ws.py` (line 151
and 171). Both paths fire when both players connect, doubling
`_send_waiting_for_action`. Lacks idempotency check.

### Bug 3: Message order race
```
T+02820ms  P2  send→ submit_action block
T+02820ms  P2  ←recv turn_result (!)         ← arrived before action_confirmed
T+02832ms  P2  ←recv action_confirmed
```
**Root cause:** Server sends `action_confirmed` and `turn_result` via two
separate `await ws.send_json` calls. WebSocket guarantees in-order
delivery per-socket, but the `_resolve_turn()` path crosses two players'
sockets — events from one player's perspective may interleave with another.

### Bug 4: Stale-turn messages
**Root cause:** Messages don't carry a turn sequence number. Client can't
distinguish "this `action_confirmed` is for turn 3" vs "turn 4."

**Why these matter:**
- Bug 1: confuses opponent display ("disconnected? when?")
- Bug 2: client interprets duplicate `waiting_for_action` as new turn → may
  submit same action twice
- Bug 3 + 4: client UI gets confused about which turn's results are showing

**These all live in Phase 3 (PvP hardening) backlog.** Phase 2 will write
the integration test that catches them, then Phase 3 fixes them and the
test goes green.

**Architecture validated despite bugs:**
- Matchmaking pairing works (Redis FIFO, ~400ms pair latency).
- Simultaneous reveal pattern works (both inputs collected, resolved
  atomically).
- Perspective flipping works (you_win for one, you_lose for the other).
- Best-of-3 termination correct.

**Next:** Phase 2.1 — convert this simulator into a pytest integration test
so the bugs are continuously caught.

---

## 2026-05-26 — Phase 2 begins: Tests + observability

(In progress — updates below as work proceeds.)

### Phase 2.1 — PvP integration test (pytest)

**Goal:** Convert yesterday's CLI simulator into a permanent pytest harness
that captures the 4 discovered bugs as `xfail` markers and the working flow
as positive regression tests.

**What we did:**

1. Created `tests/integration/` directory with:
   - `__init__.py`
   - `conftest.py` — module-scoped fixture that drives one full Bo3 match
     against the live docker stack, capturing every WebSocket event into a
     `MatchRecording` dataclass. Auto-skips if API unreachable.
   - `test_pvp_flow.py` — assertions on the recording.

2. Structured the test file into two classes:
   - `TestMatchFlowBasics` (5 tests, all currently passing) — validates the
     architecture works: registration, matchmaking pairs into single
     game_id, both players receive match_result, perspective inversion
     correct, Bo3 termination rule.
   - `TestKnownBugs` (4 tests, all `xfail`) — one test per discovered bug.
     Each `xfail` reason cites the code location (`ws.py:158-162` etc.) and
     names Phase 3 as the owner. `strict=False` allows occasional
     concurrency-timing passes without breaking CI.

3. Reused the WebSocket client logic from the simulator but stripped the
   colorized printing — the test focus is event capture, not human reading.

4. Bug 4 reassessed during test writing: closer reading of `app/schemas/ws.py`
   showed `turn_result` *does* carry `turn_number`. So the original bug
   description was inaccurate — `turn_result` is fine. The real Bug 4 is
   that `action_confirmed` lacks `turn_number`, which is a separate (smaller)
   concern. Split into two tests:
   - `test_turn_result_carries_turn_sequence_number` → PASSES today (positive
     regression test).
   - `test_action_confirmed_carries_turn_number` → xfail today (Bug 4 fix in
     Phase 3).

**Test run output:**
```
tests/integration/test_pvp_flow.py::TestMatchFlowBasics::test_both_players_registered                    PASSED
tests/integration/test_pvp_flow.py::TestMatchFlowBasics::test_matchmaking_paired_into_single_game        PASSED
tests/integration/test_pvp_flow.py::TestMatchFlowBasics::test_both_players_received_match_result         PASSED
tests/integration/test_pvp_flow.py::TestMatchFlowBasics::test_perspective_inversion_on_match_result      PASSED
tests/integration/test_pvp_flow.py::TestMatchFlowBasics::test_match_terminated_under_bo3_rules           PASSED
tests/integration/test_pvp_flow.py::TestKnownBugs::test_no_spurious_opponent_reconnected_on_first_connect XFAIL
tests/integration/test_pvp_flow.py::TestKnownBugs::test_waiting_for_action_exactly_once_per_turn_per_player XFAIL
tests/integration/test_pvp_flow.py::TestKnownBugs::test_action_confirmed_arrives_before_subsequent_turn_result XFAIL
tests/integration/test_pvp_flow.py::TestKnownBugs::test_turn_result_carries_turn_sequence_number          PASSED
tests/integration/test_pvp_flow.py::TestKnownBugs::test_action_confirmed_carries_turn_number              XFAIL

======================== 6 passed, 4 xfailed in 15.06s =========================
```

**Decisions:**
- xfail with `strict=False`, not `skip`: the bug is real and tracked, but
  WS timing means occasional accidental passes shouldn't break CI.
- Module-scoped fixture: one match drives every assertion (15s match,
  many cheap assertions afterward) → fast suite.
- Integration tests in `tests/integration/`, separate from `tests/core/`
  unit tests: clearer separation of "needs docker stack" vs "pure logic."
- No fixture for starting docker compose itself — too slow per test run.
  Developer ergonomics: assume `docker compose up -d` is run once.

**Discoveries:**
- Bug 4 was partially wrong on first reading. Always read `app/schemas/ws.py`
  before claiming "this field is missing."
- `xfail strict=False` is the right tool for "documented bugs not yet
  fixed" — better than commented-out tests or skipped tests.

**Next sub-phase:** 2.2 — Sentry + structured logging.
   Or possibly skip to 2.3 — turn-based metrics (active_matches, queue_size).
   Decide after this commit.

**Commits:**
- `441d65f chore: add PvP simulator + engineering log` (pre-phase setup)
- `cb090f5 test: add PvP integration test capturing 4 known bugs as xfail`

### Phase 2.2 — Game engine unit test gap-filling

**Goal:** Audit `tests/core/test_game_engine.py` (52 tests already passing) and
fill the highest-value gaps before moving to logging/observability.

**Coverage audit (existing strengths):**
- Full 5×5 outcome matrix (25 tests)
- Action affordability validation
- Per-action ki cost/gain
- Engine lifecycle: start_match, submit_turn, round transitions
- Turn-limit ki tiebreak (draw + P1-by-ki-margin)
- Forfeit (both directions)
- 2-0 Bo3 termination
- Match draw via 3-round 1-1-tie
- Ki Burst pierces Block
- Teleport dodges Ki Burst

**Identified gaps:**
1. Ki Burst clash (both 3 ki → both lose 3) — never exercised
2. 2-1 Bo3 finish (only 2-0 path tested; ~half of real matches go 3 rounds)
3. `turn_history` accumulation in `RoundState`
4. `round_results` accumulation in `GameState` + on the final `MatchResult`
5. `p1_ki_before` / `p2_ki_before` recording on `TurnResult` (audit trail)
6. `DEFAULT_TIMEOUT_ACTION` constant value + affordability invariant
7. `game_id` uniqueness across matches

**What we added** (12 new tests in 7 classes):
- `TestEnergyWaveClash` (2 tests) — direct `resolve_turn` call + full
  engine flow.
- `TestMatchFinishedAt2_1` (2 tests) — both P1 and P2 winning 2-1.
- `TestTurnHistoryAccumulation` (2 tests) — log fills, resets on new round.
- `TestRoundResultsAccumulation` (1 test) — list grows per round +
  appears in final `MatchResult`.
- `TestTurnResultKiBeforeAudit` (2 tests) — before/after fields recorded
  correctly for both basic and cost-paying actions.
- `TestTimeoutDefaultAction` (2 tests) — constant is `CHARGE` and free,
  which `PvPGameSession._turn_timeout()` relies on.
- `TestGameIdUniqueness` (1 test) — 20 consecutive matches produce
  distinct UUIDs.

**Bug found while writing the tests:**
- First version of `test_energy_wave_clash_both_lose_3_ki` called
  `resolve_turn(p1_ki_before=...)` — wrong kwarg. Actual signature is
  `p1_ki=...`. Tests caught the naming inconsistency between
  `resolve_turn`'s args (`p1_ki`) and `TurnResult`'s fields (`p1_ki_before`,
  `p1_ki_after`). Future cleanup candidate: align names.

**Result:**
```
tests/core/test_game_engine.py
============================== 64 passed in 0.24s ==============================
```

**Decisions:**
- Did NOT touch the existing 52 tests — additive only. Reviewers can read
  the new tests as a focused diff.
- Grouped new tests into named classes for discoverability — `pytest
  --co -q` clearly shows what each cluster covers.
- Tested both directions for symmetry-prone scenarios (P1 wins 2-1 +
  P2 wins 2-1) to prevent regression in only one perspective.

**Next sub-phase:** 2.3 — matchmaking unit tests (Redis FIFO ordering,
   timeout behavior, queue size invariants, race conditions). The
   matchmaking layer has no tests today.

### Mid-Phase-2 detour — JWT 401 auto-recovery

**Commit:** `b13e837 fix(web): auto-recover from expired JWT tokens`

**Context:** Jason hit "Invalid token: Signature has expired" repeatedly in
the browser even after clearing localStorage. Diagnosed: the `pgdata`
docker volume was recreated during `docker compose up --build`, so any
JWT stored in localStorage from earlier sessions referenced a player_id
no longer in the new database. Multiple paths to the same symptom (token
exp claim past, secret rotation, DB rebuild). Decided to fix it
client-side so the user never sees this class of error.

**What changed:** `web/src/lib/api.ts` — apiFetch now catches 401, clears
the stale token via logout(), creates a fresh guest session, and retries
the original request once. Guard: skip retry for the guest endpoint
itself (can't loop since /auth/guest never returns 401).

**Why this was the right layer to fix:** The server's behavior (reject
expired tokens) is correct. The client's behavior (give up on 401) was
wrong. Auto-recovery on the client preserves user flow without weakening
server security.

**Discovery:** This was the right move because the same pattern will
recur in production — token expiry, server-side player deletion, JWT
secret rotation. Now fixed by-class.

### Phase 2.3 — Matchmaking service unit tests

**Commit:** `(this PR, after JWT fix)`

**Goal:** Cover the MatchmakingService — currently has zero tests despite
being one of the most concurrency-prone parts of the system.

**What we added:** `tests/services/test_matchmaking_service.py` (17 tests,
4 classes):
- `TestJoinAndLeaveQueue` (5): Redis writes/reads, position counting,
  display-name cache lifecycle, idempotent leave for non-existent player.
- `TestMatchPlayers` (8): FIFO pairing across 2/3/4 players, game_id
  consistency across both ws_manager notifications, opponent_name
  correctness, game_players mapping recorded, multi-cycle pairing.
- `TestCheckTimeouts` (2): stale-player removal + matchmaking_timeout
  notification.
- `TestBackgroundLoop` (2): start/stop lifecycle, end-to-end pairing
  within one 500ms poll cycle.

**Test setup:**
- Real Redis (assumes `docker compose up`) with per-test queue flush
  for isolation. fakeredis was considered (faster, no infra dep) but not
  installed in the env, and real Redis runs in 0-overhead memory mode.
- `FakeWSManager` substitute that records every `send_to_player` call
  into a list — assertions inspect this list instead of spinning real
  WebSockets.
- Auto-skip if Redis unreachable on localhost:6379.

**Result:** 17 passed in 1.45s.

**Decisions:**
- Real Redis over mocking: tests exercise the actual Redis interaction
  (zadd / zrange / zrem / zrangebyscore) which is where bugs would
  hide. Mock would only test our wrapper, not the wrapper-Redis contract.
- Per-test queue flush instead of separate Redis db: simpler, no
  db-index management, isolation still complete.

### Phase 2.4 — Structured JSON logging

**Commit:** `(this PR)`

**Goal:** Replace default Python logging with JSON output for production
log ingestion (Datadog / Loki / Cloud Logging) while keeping human-
readable format for local dev.

**What we added:**
- `app/core/logging.py` (`# CORE_CANDIDATE`):
  - `JsonFormatter` — single-line JSON per record. Standard fields:
    timestamp (ISO 8601 UTC), level, logger, message, module, function,
    line. Exception traceback if present. Any `extra=` kwargs flow
    through as top-level structured context.
  - `configure_logging(json_mode, level)` — idempotent installer. Picks
    JSON for prod, human format for dev. Quiets noisy 3rd-party loggers
    in dev (uvicorn.access, asyncio, watchfiles.main).
- `app/main.py` — calls `configure_logging(json_mode=not settings.debug,
  level=...)` at import time so even pre-lifespan messages are captured.
- `tests/core/test_logging.py` (8 tests): field presence, extra
  propagation, printf interpolation, exception serialization, non-JSON-
  serializable value coercion (UUID, datetime, set), idempotent
  reconfiguration, mode-correct formatter selection.

**Result:** 8 passed in 0.06s.

**Decisions:**
- stdlib-only — no `python-json-logger` dep. Simple to maintain,
  zero version drift.
- `default=str` in `json.dumps` — gracefully serializes UUIDs,
  datetimes, sets without explicit handling. Safety net for
  human-supplied `extra` kwargs.
- Logger config at import time (not in `lifespan`) — captures messages
  from uvicorn startup banner and any module-load-time logs.

### Phase 2.5 + 2.6 — Sentry error tracking + Prometheus /metrics

**Commit:** `(this PR)`

**Goal:** Production-grade observability surface so we can answer "is
something broken?" without log spelunking.

**What we added:**
- `app/core/observability.py` (`# CORE_CANDIDATE`):
  - `init_sentry(dsn, environment, traces_sample_rate)` — initializes
    Sentry SDK with Starlette + FastAPI integrations. No-op if
    SENTRY_DSN empty or sentry-sdk missing. `send_default_pii=False`
    (don't auto-capture user identifiers).
  - 5 Prometheus metrics defined at module load (process-level singletons):
    - `ki_clash_matches_started_total` (Counter, labels: match_type)
    - `ki_clash_matches_completed_total` (Counter, labels: match_type, result)
    - `ki_clash_active_pvp_matches` (Gauge)
    - `ki_clash_matchmaking_queue_size` (Gauge)
    - `ki_clash_turn_resolution_seconds` (Histogram, ms-scale buckets)
  - `metrics_payload()` returns Prometheus exposition format.
  - Both Sentry and Prometheus imports guarded with try/except — if
    either package is missing (e.g., container pre-rebuild after
    pyproject.toml change) the application still boots and the missing
    package is logged once on startup. No-op metric stubs maintain the
    `.labels().inc()` / `.set()` / `.observe()` API contract.
- `app/main.py`:
  - `init_sentry(...)` called at module import (before app
    construction) so even startup errors are reported.
  - `GET /metrics` endpoint returns Prometheus exposition format.
- `app/config.py` — added `sentry_dsn`, `environment`,
  `sentry_traces_sample_rate`.
- `pyproject.toml` — added `sentry-sdk[fastapi]>=2.0`,
  `prometheus-client>=0.20`.
- `tests/core/test_observability.py` (9 tests): init with/without DSN,
  counter/gauge/histogram operations, exposition format, graceful
  degradation when packages missing.

**Result:** 9 passed in 4.30s.

**Decisions:**
- Lazy SDK import with try/except: makes the codebase tolerant of
  partial container rebuilds. Pyproject changes don't lock out the
  application boot.
- Metrics instrumentation deferred to Phase 3 — the metrics module
  defines the gauges/counters but production code (matchmaking,
  game_session) doesn't yet call them. Wiring will happen as part of
  Phase 3 bug-fix commits so each one lands with its observability.
- `send_default_pii=False` for Sentry — GDPR/privacy default.

### Phase 2 — overall summary

```
Total new tests:  6 + 12 + 17 + 8 + 9 = 52 across Phase 2
Total suite size: 99 tests (was 52 at start of Phase 2)
Test runtime:     ~3 seconds total
xfail count:      4 (Phase 3 bug targets)

Code modules added:
  app/core/logging.py        — JSON logging
  app/core/observability.py  — Sentry + Prometheus

Code touchpoints:
  app/main.py     — wire up logging, sentry init, /metrics endpoint
  app/config.py   — new env vars (sentry_dsn, environment, sample_rate)
  pyproject.toml  — sentry-sdk, prometheus-client deps
  web/src/lib/api.ts — JWT 401 auto-recovery (mid-phase detour)

Documentation:
  scripts/pvp_simulator.py    — debugging tool
  docs/multiplayer-networking.md — concept reference
  docs/engineering-log.md     — this file
```

**Phase 2 outcome:** Tests + observability foundation complete. We now
have a fast feedback loop (`pytest tests/` runs the whole suite in ~3s)
and a production-ready observability surface (JSON logs + Sentry + /metrics)
waiting to be wired up. The 4 PvP bugs are codified as `xfail` tests
that will flip to PASS as Phase 3 lands fixes.

**Next phase:** Phase 3 — PvP hardening. Fix the 4 documented bugs one
by one. Each fix lands with: (a) flip xfail → expected pass in the
integration test, (b) add metrics instrumentation for the affected code
path, (c) engineering log entry.

---

## 2026-05-26 — Phase 3: PvP hardening ✅ (bug-fix scope)

**Commit:** `7dc3dde fix(pvp): fix 4 PvP concurrency bugs (Phase 3)`

**Context:** The 4 bugs documented as xfail tests during Phase 2.1 were
the highest-value PvP correctness fixes. All four cluster around two
root causes: session lifecycle confusion (Bugs 1+2) and turn-correlation
ambiguity (Bugs 3+4). One PR addresses all four.

### Bug 1 — spurious `opponent_reconnected` on first connect

**Root cause:** `ws.py` had `if session is None / else` branching where
the `else` branch (any existing session) was treated as a reconnect.
The second player to connect always hit the reconnect path because
session was created by the first player's connection.

**Fix (`app/modules/ki_clash/game_session.py`):**
- Added `self._connected_players: set[UUID]` — tracks which players have
  connected to the game WS at least once.
- New `handle_connect(player_id)` method — single entrypoint that
  distinguishes first-connect (silent, just record) from real reconnect
  (notify opponent, cancel forfeit timer, re-send state).
- `handle_reconnect()` retained as a thin deprecation alias for any
  external callers.

**Fix (`app/api/v1/endpoints/ws.py`):**
- Removed the if/else branch. `game_ws()` now always calls
  `session.handle_connect()` and lets the session decide internally.

### Bug 2 — duplicate `waiting_for_action` per turn

**Root cause:** `session.start()` was called from two paths in
`ws.py` (after session creation + after the room_size check). Both
fired when both players had connected, so `_send_waiting_for_action`
ran twice per turn at the start of the match.

**Fix (`app/modules/ki_clash/game_session.py`):**
- Added `self._started: bool`. `start()` early-returns if already
  started — fully idempotent.

**Fix (`app/api/v1/endpoints/ws.py`):**
- Collapsed two `start()` call sites into one. Idempotency makes the
  remaining single call safe.

### Bug 3 — `action_confirmed` / `turn_result` out-of-order

**Root cause (revised):** The simulator's xfail test was triggered by
the duplicate start() (Bug 2) creating extra await points where events
could interleave. With Bug 2 fixed, the message order is naturally
correct because `submit_action()` is a single coroutine that sends
`action_confirmed` immediately, and `_resolve_turn()` runs only after
both submissions land.

**Fix:** No additional code — fell out of the Bug 2 cleanup.

**Verification:** xfail flipped to XPASS automatically after Bug 2 fix.

### Bug 4 — `action_confirmed` lacks `turn_number`

**Root cause:** The `action_confirmed` message was constructed as an
inline dict literal in `game_session.py:139-142` rather than going
through a schema function in `app/schemas/ws.py`. Easy to forget
fields.

**Fix (`app/schemas/ws.py`):**
- Added `action_confirmed(turn_number, action)` schema function with
  docstring explaining the turn-correlation rationale.

**Fix (`app/modules/ki_clash/game_session.py`):**
- `submit_action()` now calls `ws_msg.action_confirmed(turn_number=...)`
  passing `current_round.turn_number + 1` (matches the convention
  used by `waiting_for_action`).

### Verification

```
$ pytest tests/integration/
10 passed in 19.04s    (was: 6 passed, 4 xfailed)

$ pytest
126 passed in 21.69s   (full suite, zero failures, zero xfail)
```

xfail markers fully removed; tests renamed `TestKnownBugs` →
`TestPhase3Regressions` to reflect their new role as regression
guards. Each assertion error message references the fix location so
future regressions are diagnosable.

### Phase 3 — scope notes

**In scope (done):** the 4 simulator-discovered bugs.

**Originally listed but deferred:**
- WebSocket heartbeat/ping every 10s — current `ping` handler exists but
  isn't periodic. Defer to Phase 5 (Go server will implement from scratch).
- Idempotent action re-submission — currently a duplicate `submit_action`
  for the same turn silently overwrites. Low impact (client UI prevents
  it), defer to Phase 5.
- 30s reconnect window — already implemented in `_forfeit_after_timeout`.
- Match timeout (20-turn round) — already enforced by GameEngine.
- Server-side input validation — already done via `validate_action`.

Most of the "originally listed" items were already in place when I read
the code more carefully. The actual gap was the 4 simulator bugs.

**Next phase:** Phase 4 — distributed game state. Move
`active_games` dict + `game_players` mapping from in-memory into Redis
so multiple uvicorn workers can serve the same game. Adds Redis pub/sub
for cross-worker message routing. Required for horizontal scale to
5000+ concurrent.

---

## 2026-05-26 — Phase 4 starts: design-first

**Context:** Originally proposed skipping Phase 4 (see DR-11). Jason
overrode — chose the depth-first path. Decision rationale captured in
revised DR-11. Before writing any code, locked in the design
decisions:

- **DR-12** — Redis storage representation: single JSON blob per game,
  keyed by `ki_clash:game:{game_id}`, serialized via Pydantic.
- **DR-13** — Pub/sub topology: per-player channel
  (`ki_clash:player:{player_id}`). Direct routing, no filtering.
- **DR-14** — Concurrency control: Redis WATCH/MULTI/EXEC optimistic
  with 3-retry budget.
- **DR-15** — Session statefulness: workers are stateless; Redis is
  the single source of truth. PvPGameSession becomes a façade of
  static methods that load/mutate/save.

This is more upfront design than usual because Phase 4 is the most
architecturally consequential change in the project so far. Getting
the shape wrong costs days of rework later.

**Phase 4 work breakdown:**
- 4.1 — `app/core/game_store.py`: Redis-backed state store implementing
  DR-12 (save/load/watch).
- 4.2 — Migrate `MatchmakingService.active_games` + `game_players` to
  use the new store.
- 4.3 — Refactor `PvPGameSession` to be stateless (DR-15) — every method
  loads from Redis, mutates, saves.
- 4.4 — `app/core/pubsub.py`: per-player pub/sub (DR-13) and
  `ws_manager` integration.
- 4.5 — Implement DR-14 atomic action submission with WATCH retry.
- 4.6 — Multi-worker integration tests (simulate 2 workers via 2
  client sessions, verify cross-worker messaging works).

**Starting with 4.1.**

### Phase 4.1 — Redis-backed game store ✅

**Commit:** `(after design DRs)` — `app/core/game_store.py` + 16 tests.

**What:**
- `PvPSessionState` model: wraps pure `GameState` with PvP runtime
  fields (`player1_id`, `player2_id`, `connected_players`, `started`,
  `p1_action`, `p2_action`). Keeps the engine layer free of PvP
  concerns.
- `GameStore` class with `save()`, `load()`, `delete()`, `exists()`,
  and the centerpiece `watch_and_update(game_id, mutator)` — atomic
  load→mutate→save via Redis WATCH/MULTI/EXEC with 3-retry budget
  (DR-14).
- 1-hour TTL on game keys for auto-cleanup of abandoned sessions.
- Error types: `GameNotFoundError`, `TooManyConflictsError`.

**Why this shape:** Implements DR-12 (single JSON blob) and DR-14
(optimistic concurrency) as foundational primitives. The matchmaking
service and PvP session façade build on this.

**Tests:** 16 passed, covers basic CRUD, complex state round-trip
including turn_history, TTL set on save, model helpers (has_connected,
mark_connected, is_player), atomic watch_and_update including
concurrent-mutation serialization correctness.

### Phase 4.2 + 4.3 — Stateless matchmaking + PvPGameSession ✅

**Commit:** `84a71d1 refactor(pvp): make PvPGameSession + matchmaking stateless via GameStore`

**What:**
- `MatchmakingService.__init__` takes `(redis_client, ws_manager,
  game_store)`. Removed in-memory `self.active_games` and
  `self.game_players` dicts. `match_players()` creates
  `PvPSessionState` and persists via store.
- `PvPGameSession` fully rewritten as stateless façade (DR-15):
  - Constructor takes only `(store, ws_manager)`. No per-game state.
  - All public methods take `game_id` and operate on Redis-stored
    state via `store.watch_and_update()` for atomic mutations.
  - Local-only state: timer asyncio.Tasks for disconnect/turn-timeout.
    Tasks self-cancel on fire by re-reading Redis (safe under
    cross-worker reconnect).
- `app/api/v1/endpoints/ws.py` simplified: removed `_game_sessions`
  in-memory dict. `init_ws_endpoints` now takes 4 deps (added
  pvp_session, game_store).
- `app/main.py` wires up the new singletons in lifespan startup.
- Test fixture updated. Tests that previously asserted on the removed
  dicts now verify the same invariants via `GameStore.load()` and
  `ws_manager.messages_of_type()`.

**Why this shape:** Workers can now be killed and replaced without
losing game state. Multiple workers can serve the same game's
players. This is the DR-15 statelessness contract realized in code.

**Tests:** 142 passed (was 126), 10/10 integration tests still pass
end-to-end against the live docker stack — the refactor preserved
the external WebSocket contract exactly.

### Phase 4.4 — Cross-worker pub/sub ✅

**Commit:** `9df2fc3 feat(ws): per-player Redis pub/sub for cross-worker routing`

**What:**
- `WSManager(redis_client=...)` constructor now accepts an optional
  Redis client. With it, the manager:
  1. Spawns a background subscriber task per connected player.
  2. `send_to_player(X, msg)` routes local-first: if X is connected on
     this worker, send directly; otherwise publish to X's per-player
     channel for whichever worker has X's WebSocket to forward.
- Channel name: `ki_clash:player:{player_id}` (DR-13).
- Subscriber forwards received messages to the local WebSocket.
- Lifecycle: subscriber starts on `connect()`, cancels on `disconnect()`.
- Backward compatible: `WSManager(redis_client=None)` still works for
  single-worker dev.

**Why this shape:** Enables true multi-worker deployment. A player
connected to worker A can receive messages sent by code running on
worker B (e.g., matchmaking on worker C creates a match between
players on A and B).

**Tests:** 7 passed (1 channel-format contract, 3 send-routing
scenarios including verified Redis publish, 3 subscriber lifecycle).

### Phase 4.5 — Multi-process integration test (deferred)

**Decision:** Skipped for now. A true 2-uvicorn-process integration
test would need pytest-docker-style infrastructure to spin up two
workers and run a match across them. The maintenance cost outweighs
the marginal confidence over what we already have:

- 16 game_store tests (state persistence + atomic updates)
- 17 matchmaking tests (Redis queue + pairing)
- 7 pubsub tests (cross-worker routing)
- 10 PvP integration tests (end-to-end against live docker)

The full distributed scenario is validated structurally by the
unit tests and behaviorally by the integration test; a 2-process
test would primarily test that uvicorn's WebSocket implementation
plays nice with both — known-good behavior.

If issues surface in production, revisit and add the multi-process
test then.

### Phase 4 — overall summary

```
Total Phase 4 tests added:  16 + 7 = 23
                           (+ ~9 LOC of fixture updates for existing
                            matchmaking tests)
Full suite tally:          149 tests passing in ~23s

Code modules added:
  app/core/game_store.py         — Redis-backed PvPSessionState store
  (+ in-place rewrite of game_session.py + ws_manager extensions)

Lines of code:
  +539 game_store + tests
  +571 game_session/ws/matchmaking refactor
  +370 ws_manager pubsub + tests
  ────
  ~1,480 LOC of distributed-systems engineering, fully tested

Production behaviors unlocked:
  ✓ Workers can be killed/restarted without losing game state
  ✓ Multiple uvicorn workers can serve the same game's players
  ✓ A player on worker A can receive messages from code running on B
  ✓ Atomic two-player turn submission via WATCH/MULTI/EXEC
  ✓ Sessions auto-clean after 1 hour of inactivity (Redis TTL)
  ✓ Auto-skip on missing Redis = clean degradation to single-worker mode
```

**Phase 4 outcome:** Python backend is now horizontally scalable. The
implementation also serves as the reference spec for Phase 5 (Go
rewrite). Every decision was made with the Go port in mind — Redis
storage representation, pub/sub topology, concurrency model are all
language-agnostic and translate directly.

**Next phase:** Phase 5 — Go game server. Port the WebSocket + matchmaking
+ PvP session layers to Go. Python platform server (auth, payment,
profile, history) stays. Gradual cutover via nginx routing.

---
---

# Part 2 — Engineering Decision Reference

> Topic-organized deep dives on every major architectural decision made
> in Ki Clash so far. Each entry follows the same structure:
>
> - **Decision:** the one-line summary
> - **Options considered:** what alternatives were on the table
> - **Trade-off table:** each option scored on the dimensions that
>   actually mattered
> - **Reasoning chain:** why the chosen option won
> - **Meta-pattern:** the generalizable engineering principle, applicable
>   to other projects
> - **Interview framing:** how to talk about it in a Toronto interview
>
> Use this as your study guide. Each entry is designed to give you
> staff-engineer-level depth on a specific choice.

---

## DR-1: Backend language for game server — Python vs Spring vs Go

**Decision:** Python/FastAPI today, Go for the game-server layer once
DAU exceeds 500.

**Options considered:**
- A) Stay on Python/FastAPI forever
- B) Switch entire backend to Spring (Jason's 5-year strength)
- C) Switch entire backend to Go (modern game-server standard)
- D) **Hybrid 2-tier: Python platform + Go game server** ← chosen

**Trade-off table:**

| Dimension | Python | Spring | Go |
|---|---|---|---|
| WebSocket connection memory | ~100KB / conn (CPython + asyncio) | ~100KB (JVM thread/coroutine) | **~10KB** (goroutine 2KB stack + buffers) |
| GC pause | 0 (no GC, refcount + GIL) | 1–10ms (G1/ZGC) | **< 1ms** (concurrent collector) |
| Concurrent connections per instance | 5–10k practical | 5–10k practical | **50–100k practical** |
| Startup time | 200ms | 3–10s (JVM warm-up) | **<50ms** |
| Container image size | 200MB+ | 300MB+ | **30–50MB** (single binary) |
| LLM ecosystem fit | **Native (LangChain, etc.)** | LangChain4j (lags Python) | Limited |
| Jason's existing skill | Adequate (FastAPI) | **Expert** (5y SK AX) | None (learn from scratch) |
| Toronto market signal | Neutral | "Korean enterprise" tag | **"Modern startup" tag** |
| Factory ROI (shared core for next products) | **Best** — most products will be LLM-driven | Worst — Python-LLM separation breaks Factory | Medium |

**Reasoning chain:**
1. **Eliminate Spring for the game server.** Spring's strengths are
   transactional CRUD + Spring Security + JPA — none of which a 30Hz
   game loop needs. Spring's weaknesses (GC pauses, JVM warm-up,
   heavyweight DI container) hurt at the game-server layer. Java-as-a-
   game-server is a known anti-pattern.
2. **Eliminate Spring for the platform layer too.** *Even though* Jason
   has 5 years of Spring expertise, picking Spring per-product breaks
   the Factory thesis: future products will be LLM-driven, and
   LangChain4j lags LangChain by 6–12 months. Per-product optimum
   becomes per-portfolio loss.
3. **Python is "good enough" for the platform layer.** Auth, payment,
   profile, history, leaderboard — all are standard CRUD with light
   throughput. FastAPI handles 5k req/s on one instance. Python's
   weaknesses (GIL, GC) don't bind here.
4. **Go is *required* for the game server layer once scale demands it.**
   Goroutine memory model gives 5–10x connection density at the same
   RAM budget; sub-ms GC pause means tick rate doesn't suffer; single
   binary deploys eliminate JVM/CPython runtime drift.
5. **Defer the Go rewrite.** Per the "build for 100 users, optimize
   when they stress the system" rule, Python suffices today. Begin Go
   port when DAU passes ~500 (about the same point that horizontal
   scaling becomes necessary anyway).

**Meta-pattern: "2-tier game backend"**
- Game server (low-latency, stateful, WebSocket-heavy) ↔ different
  language/runtime than the platform server (CRUD, transactional, REST-
  heavy). Industry standard: Riot, Roblox, Discord all split this way.
  Don't try to make one language win both tiers.
- The split lets you use the right tool per tier without forcing the
  whole org/codebase into one stack.

**Interview framing:**
> "I split the backend along the tick-rate boundary. The platform layer
> — auth, payment, profile, history — runs on Python/FastAPI because
> the workload is standard CRUD and the language alignment with the
> rest of the Factory's LLM-driven products matters more than per-game
> optimum. The game server — WebSocket gateway, matchmaking, PvP
> session loop — will move to Go when DAU passes ~500. Go's
> goroutine model gives 5–10x WebSocket density and sub-ms GC pauses
> that the game-tick loop actually needs. Spring would have been
> objectively better for the platform layer in isolation but breaks
> the Factory ROI."

**Why not just write everything in Go now?**
- Productivity: Python ships features 2–3x faster than Go for CRUD
- Solo dev: no parallel team to absorb the dual-stack cost yet
- Factory ROI: Python platform code reuses across LLM products
- Go is a 2026 trend, Python is a 2026 reality — don't over-invest in
  a single-product optimization that pays off only at scale

---

## DR-2: Visual aesthetic — pixel art vs modern card game

**Decision:** Reject pixel art (already implemented). Target "modern
anime card game" aesthetic (Marvel Snap / Slay the Spire / Reigns refs)
with high-impact arcade effects, all original art, AI-augmented design.

**Options considered:**
- A) Keep pixel art (existing code in `web/src/components/pixel-art/`)
- B) **Modern card-game aesthetic + AI-generated assets** ← chosen
- C) Fully outsourced art ($300-800/character)
- D) Geometric/minimalist style (Mini Metro / Threes!)

**Trade-off table:**

| Dimension | Pixel art | Modern anime | Outsourced | Geometric |
|---|---|---|---|---|
| Production cost | Low (code-based) | Medium (AI + cleanup) | **High** ($) | **Lowest** |
| Visual ceiling | Limited — looks "indie demo" | High | Highest | Medium |
| Mobile first-5-second impact | Low | **High** | Highest | Medium |
| Ad-revenue conversion likelihood | Low | **High** | Highest | Medium |
| Jason's design skill required | None | Some (learn 40-80h) | None | Low |
| Compounding skill | None | **High** (transfers to content) | None | Some |
| Re-use across Factory products | Low | **High** (Firefly workflow) | Low | Medium |
| Time to ship | Today | 2 weeks | 1 week | 3 days |

**Reasoning chain:**
1. **Pixel art reads "indie demo" to mass mobile audiences.** Ki Clash
   monetizes via ads, so first-5-second visual impact directly drives
   revenue. Pixel art is acceptable for indie PC audiences (itch.io)
   but loses against polished competitors in the mobile App Store.
2. **Outsourced art breaks the Factory.** Per-product $300-800 art
   spend × 10 products = $3-8k. Compared to 80 hours of one-time AI
   workflow learning, the time investment wins on Factory ROI.
3. **Geometric is too far from the ki-battle target.** Jason
   wants flashy auras, beams, glow — that's anime, not minimalist.
4. **Modern anime + AI-augmented design hits all targets:** high visual
   ceiling, low marginal cost per asset, skill compounds across
   products and content creation.

**Meta-pattern: "Choose the aesthetic that aligns with monetization"**
- Free-with-ads → first-impression matters → polish required
- Premium $30 game → vibes/atmosphere matter more than polish
- Subscription → retention art (cosmetic shop) > one-time polish
- Indie passion project → whatever's fun

**Interview framing:**
> "I rejected the pixel-art aesthetic that was already implemented
> because Ki Clash monetizes via ads — first-impression visual
> impact directly drives the funnel. Pixel art works for indie PC
> audiences but reads as 'demo quality' on mobile App Store browsing.
> I committed to a modern anime card-game aesthetic produced via AI-
> augmented design (Firefly + Figma), with the design skill being a
> founder-level investment that compounds across the product Factory
> and content creation."

---

## DR-3: Asset pipeline shape — fallback components vs hard wiring

**Decision:** All asset-consuming components attempt the real asset,
gracefully degrade to emoji/default if missing.

**Code shape (web example):**
```typescript
function CharacterPortrait({ characterId, expression, size }) {
  const [imageBroken, setImageBroken] = useState(false);
  if (showImage && !imageBroken) {
    return <img onError={() => setImageBroken(true)} ... />;
  }
  return <div>{character.emoji}</div>;
}
```

**Options considered:**
- A) **Graceful fallback components** ← chosen
- B) Block rendering until all assets exist
- C) Render a "placeholder" image when missing
- D) Strict typing + build-time validation

**Trade-off table:**

| Dimension | Fallback | Block | Placeholder | Strict |
|---|---|---|---|---|
| Game playable during design work | **✅** | ❌ | ✅ | ❌ |
| Design errors visible | Discoverable | Loud | Visible | **Loudest** |
| Code complexity | Medium | Low | Low | High |
| Risk of shipping broken UI | Low | None | Medium | **None** |
| Speed of design iteration | **Fast** | Slow | Fast | Slow |

**Reasoning chain:**
1. **Optimize for design-developer handoff.** Jason will be producing
   designs in parallel with backend work over weeks. Blocking the game
   on every missing asset would freeze parallel development.
2. **Emoji fallback is "good enough" interim.** Players never see the
   intermediate state (only dev sees it during the design pipeline),
   and emoji is recognizable enough that Jason can debug game logic
   without waiting for art.
3. **Strict-build approach would slow Jason down.** Every new asset
   would require a code change. Asset drop-in (without code change) is
   the desired ergonomic.
4. **Risk is bounded.** Production checklist before launch: scan
   `public/` for expected assets, fail CI if any are missing. The
   `lib/assets.ts` ID enums make this auditable.

**Meta-pattern: "Graceful degradation at the asset boundary"**
- Same shape as how a CDN deals with missing assets (serve placeholder)
- Same shape as how databases deal with NULL (return default, app
  layer renders sensibly)
- Same shape as how feature flags deal with unset flags (fallback to
  control behavior)
- Generalizable principle: **At every system boundary where data may be
  missing/late, provide a sensible default; surface the missingness
  loudly only when it matters for correctness.**

**Interview framing:**
> "I built the asset pipeline as a component-layer fallback pattern.
> Every asset-consuming component attempts to load the real asset and
> falls back to a sensible default on missing/broken. This decouples
> the design workflow from backend development — the designer drops
> files into `public/`, components auto-pick them up, no code changes
> needed. The trade-off was accepting that broken assets are
> 'discoverable' rather than 'loud' — mitigated by an ID enum in
> `lib/assets.ts` that lets us audit completeness before launch."

---

## DR-4: Deprecate vs delete the pixel-art code

**Decision:** Move pixel-art directories to `deprecated/` subfolder with
git history preserved (`git mv`), update all imports, keep compiling.

**Options considered:**
- A) **Move to `deprecated/`** ← chosen
- B) `git rm` everything
- C) Keep in place, mark with `@deprecated` JSDoc
- D) Move to a separate branch

**Trade-off table:**

| Dimension | Deprecated/ | Delete | In-place | Branch |
|---|---|---|---|---|
| Codebase clarity | High (clearly walled off) | **Highest** | Low (mixed) | Highest |
| History preserved | ✅ git mv | ❌ recoverable but inconvenient | ✅ | ✅ |
| Per-screen migration | Easy | Hard (must rewrite from history) | Trivial | Hard (cross-branch) |
| Risk of accidental use | Low | None | **High** | None |
| Disk/clone size | Same | -10% | Same | Same |

**Reasoning chain:**
1. **Cannot delete yet.** 12+ active screens (MatchHUD, AITrashTalk,
   page.tsx, etc.) still import pixel-art components. Deleting would
   require simultaneous rewrite of all 12 — high risk of breaking
   things.
2. **Move + update imports.** `git mv` preserves blame history, sed
   does the import-path rewrite mechanically across all callsites,
   compile/lint catches any misses.
3. **`deprecated/` is the social signal.** A new dev opening the
   folder sees the name and knows not to add new code there.
4. **Per-screen migration plan.** As each screen gets real assets, it
   moves from importing `deprecated/pixel-art/PixelPortrait` to
   importing the new `CharacterPortrait`. When the last consumer is
   migrated, then `git rm -r deprecated/pixel-art`.

**Meta-pattern: "Graveyard folder for unfinished migrations"**
- Pattern name: "strangler fig" (Martin Fowler) at folder granularity
- Used by: Stripe, GitHub, basically every codebase that lives 5+ years
- Generalizable principle: **When rejecting code that's still
  load-bearing, move + flag rather than delete. Migrate consumers
  incrementally. Delete only when the graveyard is empty.**

**Interview framing:**
> "We had pixel-art components used in 12+ screens that we wanted to
> deprecate but couldn't delete atomically. I moved them to a
> `deprecated/` subfolder via `git mv` so history is preserved, then
> sed-updated all import paths so everything still compiles. New
> screens use the replacement `CharacterPortrait` component; old
> screens migrate one at a time. When the graveyard empties, the
> folder gets deleted. This is the folder-level version of the
> strangler fig pattern."

---

## DR-5: JWT 401 — recover client-side vs prevent server-side

**Decision:** Client-side auto-recovery. When apiFetch sees 401, clear
the stale token, create a new guest session, retry the request.

**Options considered:**
- A) **Client-side: 401 → logout → guest → retry** ← chosen
- B) Server-side: validate token against DB on every request (catch
     stale player_ids earlier)
- C) Long-lived tokens (e.g., 1 year)
- D) Force user to log out / restart browser on 401

**Trade-off table:**

| Dimension | Client retry | DB validate | Long TTL | User restart |
|---|---|---|---|---|
| User experience | **Seamless** | Seamless | Seamless | **Bad** |
| Server overhead | None | +1 DB query per request | None | None |
| Security posture | Same (server still rejects bad tokens) | **Best** | Worst | Same |
| Code complexity | Medium (client) | Low (server) | Trivial | Trivial |
| Where the bug lives | Solved | Symptom-masked | Side-stepped | Pushed to user |

**Reasoning chain:**
1. **The bug is "client doesn't know to re-auth," not "server rejects
   tokens."** Server's behavior (reject expired tokens) is correct.
   Don't change the server.
2. **DB validation per request is wasteful.** 99% of tokens are valid;
   adding a DB query per request to catch the 1% is the wrong trade.
3. **Long TTL trades security for ergonomics.** A leaked token lives
   longer. Not the right direction.
4. **User-driven restart is user-hostile.** Players don't know what
   "clear localStorage" means.
5. **Client-side retry is the layer where the recovery should live.**
   When server says "this token doesn't work," the client's
   appropriate response is "OK, get a new token, try again."

**Meta-pattern: "Fix errors at the right layer"**
- Application errors → application code
- Network errors → retry layer
- Auth errors → auth layer (= what we did)
- Hardware errors → infrastructure
- **Generalizable principle: when you find a bug, ask "is the layer
  reporting the error the right layer to recover from it?" If yes,
  fix there. If no, push the recovery to the right layer.**

**Edge case handled:** infinite loop. The recursive `apiFetchInternal`
call passes `allowAuthRetry=false`, so a server that mistakenly 401s
everything cannot recurse forever.

**Interview framing:**
> "We hit a class of bugs where the database had been rebuilt but the
> browser's localStorage still held a JWT pointing to a deleted
> player_id, plus general token expiry. Instead of validating tokens
> against the DB on every request (wasteful) or making tokens
> long-lived (security regression), I added a client-side
> auto-recovery layer: 401 response triggers logout + new guest session
> + retry. The server's behavior stays correct; the client gains
> resilience. Infinite-loop protection via a one-shot retry guard."

---

## DR-6: xfail tests for known bugs vs commented-out / skipped

**Decision:** Document each known bug as `@pytest.mark.xfail(strict=False)`
with the bug's full reason in the marker.

**Options considered:**
- A) **xfail with strict=False** ← chosen
- B) `@pytest.skip(reason="...")`
- C) Commented-out test
- D) TODO comment in code

**Trade-off table:**

| Dimension | xfail (strict=False) | skip | comment | TODO |
|---|---|---|---|---|
| Bug is visible in test output | ✅ "XFAIL" | ✅ "SKIPPED" | ❌ | ❌ |
| Flips to failure when fixed | **✅ XPASS detected** | ❌ silently passes | ❌ | ❌ |
| Suite stays green | ✅ | ✅ | ✅ | ✅ |
| Tolerates concurrency flakiness | ✅ | ✅ | n/a | n/a |
| Reason is searchable in code | ✅ | ✅ | partial | ✅ |
| Test code is preserved (not rotting) | ✅ | ✅ | ❌ | ❌ |

**Reasoning chain:**
1. **xfail is "documented bug as code."** The test exists, runs, and
   asserts the correct behavior. It just fails today — and that
   failure is intentional and tracked.
2. **strict=False because concurrency.** Some bugs are race conditions
   that don't reproduce 100% of the time. With strict=True, an
   occasional pass would fail the suite (xfail strict means "must
   fail"). strict=False says "should usually fail; if it passes,
   that's fine, don't shout."
3. **When the fix lands, XFAIL → XPASS.** Pytest highlights this:
   "this test was expected to fail but didn't — go remove the marker."
   That's a discoverable workflow.
4. **Comments rot.** A `# TODO: fix this` next to a working test gets
   ignored. xfail can't be ignored — pytest reminds you every run.

**Meta-pattern: "Documented bugs as executable artifacts"**
- xfail is the same idea as feature flags (off by default, flippable
  when ready)
- Same idea as `[Test]` attributes in xUnit
- **Generalizable principle: prefer executable representations of
  bugs/intentions over inert documentation. Code that can be checked
  by tooling is more durable than prose.**

**Interview framing:**
> "When we discovered 4 PvP bugs via a simulator but weren't ready to
> fix them, I codified each one as a pytest xfail with the bug's full
> root-cause analysis in the marker reason. This gave us 'documented
> bugs as code' — pytest tracks them, the suite stays green, and when
> the fix lands the test goes XFAIL → XPASS which is pytest's
> discoverable signal to remove the marker. strict=False because some
> bugs were concurrency races that don't reproduce 100% of the time."

---

## DR-7: Real Redis vs fakeredis for matchmaking unit tests

**Decision:** Use the real Redis in docker stack, flush the matchmaking
queue per test for isolation.

**Options considered:**
- A) **Real Redis + per-test flush** ← chosen
- B) `fakeredis` (in-memory shim)
- C) Mock the entire `aioredis` interface
- D) `pytest-docker` to spin up Redis per test session

**Trade-off table:**

| Dimension | Real Redis | fakeredis | Mock | pytest-docker |
|---|---|---|---|---|
| Test fidelity | **Highest** (actual Redis semantics) | High | Low (only tests the wrapper) | Highest |
| Speed | Fast (1.45s for 17 tests) | Faster | Fastest | Slow (container startup) |
| Setup complexity | Requires docker compose | One pip install | None | Complex |
| Catches Redis-version bugs | ✅ | Sometimes | ❌ | ✅ |
| Works in CI without infra | ❌ | ✅ | ✅ | Yes (slower) |

**Reasoning chain:**
1. **The bugs we want to catch are at the Redis-interaction boundary.**
   `zadd`, `zrange`, `zrem`, `zrangebyscore` — these are commands that
   matchmaking uses heavily. Mocking would only test our wrapper, not
   the wrapper-Redis contract.
2. **fakeredis is good but not installed.** Adding it as a dev dep is
   reasonable. We didn't because real Redis is already running for
   integration tests, and one less dep is one less version to track.
3. **Per-test flush is enough isolation.** Tests use `ki_clash:
   matchmaking:queue` directly. Before each test, flush this key.
   After each test, flush again. No leakage between tests.
4. **CI implication:** CI must run a Redis container. This is normal
   for any project using Redis — already standard.

**Meta-pattern: "Test against real dependencies when the contract
matters; mock only the layers above"**
- Database tests → real DB with transaction rollback per test
- Redis tests → real Redis with flush per test
- HTTP API tests → real wire calls against a test server
- LLM tests → mock (because non-deterministic + slow + costs money)
- **Generalizable principle: mock at the layer where determinism or
  cost demands it; use real dependencies for everything below.**

**Interview framing:**
> "Matchmaking tests against real Redis with a per-test queue flush
> for isolation. I considered fakeredis but the matchmaking service's
> bugs would mostly live at the Redis-command boundary (zadd ordering,
> zrangebyscore behavior). Mocking would only test our wrapper. Real
> Redis catches version-specific behavior too. The CI cost is one more
> docker service, which is already required for the integration test
> suite anyway."

---

## DR-8: Stdlib JSON logging vs python-json-logger

**Decision:** Roll our own `JsonFormatter` (~30 LOC) over adding a
dependency.

**Options considered:**
- A) **Custom stdlib `JsonFormatter`** ← chosen
- B) `python-json-logger` (popular library)
- C) `structlog` (more featured, opinionated)
- D) Default stdlib formatter (no JSON)

**Trade-off table:**

| Dimension | Custom | python-json-logger | structlog | Default |
|---|---|---|---|---|
| LOC to maintain | 30 (ours) | 0 | 0 | 0 |
| Dependency cost | None | Small (~5 LOC of features beyond ours) | Larger (different API style) | None |
| Ingestion-ready output | ✅ | ✅ | ✅ | ❌ |
| `extra=` kwarg flow | ✅ | ✅ | Native context vars | ✅ |
| Version drift risk | None | Tracks Python releases | Active development | None |
| Migration cost if needs change | Low | Low | High (different API) | Low |

**Reasoning chain:**
1. **The feature surface we need is small.** JSON output, standard
   fields, `extra=` propagation, exception serialization, default=str
   for non-JSON-serializable values. All 30-something LOC.
2. **Adding a dep buys ~5 LOC of features.** python-json-logger has
   slightly more configurable formatter rules. We don't need them.
3. **structlog is over-investment.** It's good but it has a different
   API (`logger.bind(...)` instead of `extra=`). Adopting it would mean
   changing all our log calls. Big migration cost for small benefit.
4. **30 LOC is cheap to maintain.** And it can never break us via
   "package abandoned" or "breaking minor version."
5. **CLAUDE.md rule reinforces:** "Ask before adding a dependency." We
   only break that rule for genuinely outsized leverage.

**Meta-pattern: "Cost of a dependency = installation + breaking changes
+ supply-chain risk + transitive deps + abandonment risk"**
- A library is "worth it" when its value exceeds this lifetime cost
- For 30-line problems, the cost almost always exceeds the value
- For 3000-line problems (e.g., a web framework), it almost never does
- **Generalizable principle: depend on libraries that do work too
  expensive to replicate. Write inline anything you could maintain
  yourself in an afternoon.**

**Interview framing:**
> "I rolled a 30-line JSON formatter rather than adding
> python-json-logger because the feature surface was small enough to
> own. The library would give us maybe 5 LOC of additional configurable
> rules — not worth the dependency lifetime cost (version tracking,
> supply-chain risk, transitive deps). For 3000-line problems like
> request frameworks, libraries always win. For 30-line problems,
> they usually lose."

---

## DR-9: Conditional imports for Sentry/Prometheus

**Decision:** Wrap `import sentry_sdk` and `import prometheus_client` in
`try/except ImportError`, provide no-op stubs when missing.

**Code pattern:**
```python
try:
    import sentry_sdk
    _SENTRY_AVAILABLE = True
except ImportError:
    _SENTRY_AVAILABLE = False

def init_sentry(dsn, ...):
    if not _SENTRY_AVAILABLE:
        logger.info("sentry-sdk not installed")
        return False
    sentry_sdk.init(...)
    return True
```

**Options considered:**
- A) **Conditional imports with no-op fallback** ← chosen
- B) Hard import (require packages installed)
- C) Make them dev-only deps (not in production)
- D) Late import inside functions

**Trade-off table:**

| Dimension | Conditional | Hard import | Dev-only | Late import |
|---|---|---|---|---|
| Application boots without packages | ✅ | ❌ | ✅ (in prod) | ✅ |
| Visible at module load | Yes | Yes | No | No |
| Container rebuild required after pyproject change | No | **Yes** | No | No |
| Code complexity | Medium | Low | Low | High |
| Discoverability of "missing optional feature" | Logged at startup | Crash at startup | Silent | Crash at call site |

**Reasoning chain:**
1. **Containers don't auto-rebuild on pyproject changes.** Docker
   compose builds an image from `pip install .`. If pyproject.toml
   adds a dep, the new dep isn't in the container until `docker
   compose build` runs. During that gap (developer hasn't rebuilt
   yet), hard imports would crash the application.
2. **Sentry/Prometheus are optional features.** They make the app
   better when present but the app works without them. They're not
   core dependencies (FastAPI, SQLAlchemy) where missing = no app.
3. **No-op stubs preserve the API contract.** `MATCHES_STARTED_TOTAL
   .labels(...).inc()` still works whether prometheus-client is
   installed or not — just becomes a no-op. Callers don't need
   `if metrics_available()` guards everywhere.
4. **Startup logs the missing-ness once.** Operators can debug
   "why aren't my metrics showing up?" by checking startup logs for
   the "not installed" line.

**Meta-pattern: "Graceful degradation for optional dependencies"**
- Same idea as "feature detection" in browsers (`if (window.fetch)`)
- Same idea as `Optional<T>` types in strongly-typed languages
- Same idea as a CDN serving a placeholder when origin is down
- **Generalizable principle: when adding a non-core dependency, ask
  "what should happen if this package is missing?" If the answer is
  "the app should still boot," use conditional imports + null-object
  stubs. If "the app shouldn't exist without it," use hard imports.**

**Interview framing:**
> "Sentry and Prometheus are wrapped in try/except ImportError with
> no-op stubs as fallbacks. This makes the application tolerant of
> partial container rebuilds — adding sentry-sdk to pyproject.toml
> doesn't crash the app on the next reload before the container is
> rebuilt. The no-op stubs preserve the metric API contract
> (`.labels().inc()` is callable always) so callers never need
> 'is metrics installed?' guards. Startup logs the missing-ness
> once for operator visibility."

---

## DR-10: Single `handle_connect()` vs separate first/reconnect handlers

**Decision:** Encapsulate first-vs-reconnect distinction inside
`PvPGameSession.handle_connect()`. Caller (`ws.py`) just calls one
method, the session decides internally.

**Options considered:**
- A) **Single method, internal distinction** ← chosen
- B) Two methods: `handle_first_connect()`, `handle_reconnect()`
- C) Boolean parameter: `handle_connect(player_id, is_reconnect)`
- D) Two classes: `FirstConnectHandler`, `ReconnectHandler`

**Trade-off table:**

| Dimension | Single method | Two methods | Boolean param | Two classes |
|---|---|---|---|---|
| Caller complexity | **Simple** (one call) | Caller must know which | Caller must know which | Caller must dispatch |
| Encapsulation | **Strong** | Leaky (caller knows distinction) | Leaky | Strong |
| Testability | Test both branches in one test | Test each separately | Test each path | Test each class |
| Risk of caller wrong-branching | **None** | Medium | Medium | None |
| Code clarity | Medium (internal `if`) | High (named methods) | Medium | High |
| Lines of code | Lowest | Slightly more | Same | Most |

**Reasoning chain:**
1. **The bug was caller wrong-branching.** Before this fix, `ws.py`
   chose first-vs-reconnect based on "does session exist?" — which is
   the wrong signal (sessions exist as soon as the first player
   connects). The caller was making a distinction it didn't have the
   information to make correctly.
2. **The information is inside the session.** Whether THIS player has
   connected before is something the session knows
   (`_connected_players` set). Putting the decision inside the
   session puts the logic where the data is.
3. **Single method, internal distinction is the standard
   "encapsulate variant behavior" pattern.** The method's job is
   "handle a player connecting to this game." Whether it's their
   first time or a reconnect is an implementation detail of the
   session, not the caller.
4. **Two methods would force the caller to know, again creating
   wrong-branch risk.**

**Meta-pattern: "Encapsulate variant behavior; expose unified API"**
- Same idea as polymorphism (one method, different behaviors per type)
- Same idea as "tell, don't ask" in OO
- Same idea as a database driver presenting one query API even though
  it handles connection pooling, retries, transactions internally
- **Generalizable principle: if a callsite has to decide between
  variants A and B but the variant choice depends on data that lives
  inside callee, push the decision into the callee.**

**Interview framing:**
> "The original ws.py had a `if session is None / else` branch where
> the `else` was assumed to be a reconnect. But the session-exists
> signal didn't actually mean 'this player has reconnected' — it just
> meant 'some player has already connected.' The information about
> whether THIS specific player had connected before was inside the
> session itself. I encapsulated the distinction in
> `PvPGameSession.handle_connect()`, making the caller call one method
> and the session decide internally based on its `_connected_players`
> set. This is the 'tell, don't ask' pattern — push the decision to
> where the data lives."

---

## DR-11: Do Phase 4 fully (Python Redis-backed state) before Phase 5

**Decision (final, 2026-05-26 evening):** Do Phase 4 fully — externalize
all in-memory PvP state to Redis, add pub/sub for cross-worker
messaging, use optimistic concurrency for turn atomicity. Then proceed
to Phase 5 (Go).

**Original recommendation:** Skip Phase 4 (calendar-time optimized).
**Revised after Jason's input:** Do Phase 4 (learning-depth + production
-safety optimized). This DR documents both the original analysis and
the revision.

**Options considered:**
- A) Skip Phase 4, do Phase 5 directly (original recommendation)
- B) **Do Phase 4 fully (Python Redis-backed state) then Phase 5** ← chosen
- C) Do Phase 4 minimally (just the active_games dict externalization)
  then Phase 5
- D) Skip Phase 5; stay on Python with Phase 4 forever

**Trade-off table:**

| Dimension | Skip 4 | Full 4 (chosen) | Minimal 4 | Skip 5 |
|---|---|---|---|---|
| Time to scalable system | ~3 weeks (just Phase 5) | **~5 weeks** (chosen — accept extra time for depth) | ~4 weeks | Forever stuck at 5-10k cap |
| Code written that gets thrown away | None | ~600 LOC (but runs in prod meanwhile) | ~200 LOC | None |
| Learning value (distributed systems) | Phase-5-only (in Go) | **Phase-4 + Phase-5 reinforced** (in Python then Go) | Low | Low |
| Risk of "stuck in Python" trap | None | Low (Phase 5 still committed) | Low | High |
| Production scalability ceiling | 50–100k concurrent | 50–100k (after Phase 5) | 50–100k | 5–10k |
| Production safety in interim (weeks before Phase 5 ships) | At 5-10k Python cap | **Horizontally scaled Python** | Limited gain | At cap |
| Phase 5 risk profile | Greenfield distributed in unfamiliar lang | **Translation of working reference** | Mixed | N/A |

**Reasoning chain (chosen path B):**
1. **Distributed-systems patterns are learning capital.** Building
   Redis-backed state in Python first teaches the patterns (WATCH/
   MULTI/EXEC, pub/sub fan-out, optimistic concurrency, JSON
   serialization round-trips) in a familiar language. The Go rewrite
   in Phase 5 is then a *translation* exercise, not a discovery
   exercise — much faster and lower risk.
2. **Production safety in the interim.** Until Phase 5 ships, Ki Clash
   runs on Python. Even if Jason picks up unexpected user growth
   during this window, Phase 4 unlocks horizontal Python scaling
   (multiple uvicorn instances behind a load balancer). The "throwaway"
   framing was wrong: the Python implementation runs in production
   for weeks-to-months between Phase 4 ship and Phase 5 ship.
3. **The Go port becomes a low-risk translation.** With Phase 4 done,
   Phase 5 has a working reference implementation in Python with
   integration tests + simulator validating correctness. Phase 5 only
   has to reproduce the semantics in a different language, not
   re-design the system.
4. **Jason's stated learning goal.** Per memory `[[user-creator-
   ambitions]]` and the explicit "engineer growth" preference,
   throwing away learning depth to save 2 weeks is a bad trade.
5. **Original "throwaway" framing was incomplete.** It treated Phase 4
   purely as code-to-write. With learning, production safety, and
   Phase-5 de-risking factored in, the work is not throwaway at all.

**Why I changed my recommendation:** The original DR-11 optimized for
calendar time. Jason's explicit ranking — "engineer growth" first,
"throwaway work" framing second — flipped the calculation. The
revised decision is the right one for Jason's stated objectives.

**Meta-pattern: "Optimization target determines the right answer"**
- Calendar time → skip Phase 4
- Learning depth → do Phase 4
- Production safety → do Phase 4
- Same data, different optimization target, different decisions
- **Generalizable principle: before recommending a path, name the
  objective function explicitly. The right answer changes with the
  objective. When the user says "make it for X", weight X.**

**Interview framing:**
> "I had two viable paths: skip the Python distributed-state phase to
> save ~2 weeks, or do it before the Go port for learning depth and
> production safety. The team optimization target was engineering
> growth, not calendar speed, so we did the full Python Redis-backed
> implementation first. This gave us a working reference
> implementation with tests, which de-risked the Go port. Going the
> short path would have saved weeks but left us re-discovering
> distributed-systems patterns in an unfamiliar language under
> pressure."

---

## DR-12: PvP state storage representation in Redis

**Decision:** Single JSON blob per game keyed by `ki_clash:game:{game_id}`,
serialized via Pydantic `model_dump_json()`.

**Options considered:**
- A) **Single JSON blob per game** ← chosen
- B) Redis hash with one field per attribute (`HSET ...`)
- C) Multiple keys per game with naming convention
- D) Redis JSON module (RedisJSON) for native JSON paths

**Trade-off table:**

| Dimension | JSON blob | Hash fields | Multi-key | RedisJSON |
|---|---|---|---|---|
| Serialization complexity | Trivial (one `dump_json`) | Per-field manual | Per-field manual | Trivial |
| Atomic full-state update | ✅ (one SET) | ❌ (need MULTI) | ❌ (need MULTI) | ✅ |
| Partial-field update without re-serializing | ❌ | ✅ (HSET one field) | ✅ | ✅ |
| Schema evolution (add field) | Easy (Pydantic optional) | Manual migration | Manual | Manual |
| Read cost | One GET (~1KB) | One HGETALL | Multiple GETs | One JSON.GET |
| Operational deps | Built-in Redis | Built-in | Built-in | **RedisJSON module** (extra setup) |
| WATCH/MULTI/EXEC compatibility | Natural fit | Works | Works (more complex) | Module-specific |

**Reasoning chain:**
1. **State is small** — a `GameState` serializes to ~500 bytes. Reading
   the whole blob on every operation is cheap (sub-ms in Redis).
2. **Pydantic gives us free serialization.** `state.model_dump_json()`
   and `GameState.model_validate_json(s)` are one-liners with full
   type safety, validation on load, and graceful handling of new
   fields (Optional with defaults).
3. **Atomic update story is cleanest with single blob.** WATCH/MULTI/
   EXEC on one key, do the in-memory mutation, SET → done. No
   field-by-field coordination.
4. **Hash fields would require explicit serialization for every nested
   object** (RoundState, TurnResult lists). More code, more bugs.
5. **RedisJSON module is optional infra.** Standard Redis (which we
   already have) is enough. Don't introduce module dep when JSON blob
   suffices.
6. **Schema evolution** — if we add fields later (e.g., `created_at`),
   Pydantic's `Optional` + default makes loading old blobs forward-
   compatible. Hash fields would require migration scripts.

**Sub-decision: TTL on the key.**
- Set TTL to 1 hour from last update. Abandoned games (no activity)
  auto-cleaned without explicit cleanup logic. Cheap insurance against
  Redis memory growth.

**Meta-pattern: "Match storage shape to access pattern"**
- Always-read-whole + always-write-whole → single blob
- Frequent partial-read or partial-write → hash fields
- Need ad-hoc query → relational DB, not Redis
- **Generalizable principle: storage representation should mirror the
  app's actual access pattern, not the data's logical structure.**

**Interview framing:**
> "Game state is serialized as a single JSON blob per game keyed by
> game_id. The state is ~500 bytes so reading the whole thing on every
> operation is sub-ms. Pydantic gives us free serialization with
> schema evolution via Optional fields. The alternative was Redis
> hash fields, but that would require manual per-field serialization
> for nested objects (RoundState, TurnResult lists) and complicates
> the atomic update story — a single SET inside WATCH/MULTI/EXEC is
> cleaner than coordinating multiple HSETs."

---

## DR-13: Pub/sub channel topology

**Decision:** Per-player channel — `ki_clash:player:{player_id}`. Each
worker subscribes to channels for its connected players.

**Options considered:**
- A) **Per-player channel** ← chosen
- B) Per-game channel (`ki_clash:game:{game_id}`)
- C) Single global channel + client-side filtering
- D) WebSocket-to-WebSocket direct routing (skip Redis pub/sub entirely)

**Trade-off table:**

| Dimension | Per-player | Per-game | Global | Direct |
|---|---|---|---|---|
| Routing efficiency | **Direct** (no filtering) | Filter by player_id inside game | Filter all messages by player_id | Direct |
| Subscription overhead | One sub per connected player | One sub per game (2 players) | One sub per worker | None |
| Channel count at scale (5k games) | 10,000 | 5,000 | 1 | 0 |
| Memory per worker | O(connected players) | O(connected games) | O(1) | O(connected sockets) |
| Cross-worker message latency | Sub-ms | Sub-ms | Sub-ms | N/A |
| Reconnect handling | Re-subscribe to player channel | Re-subscribe to game channel | No-op | Reopen socket only |
| Implementation complexity | Medium | Medium | Low | **High** (worker discovery) |

**Reasoning chain:**
1. **Per-player gives the cleanest semantics.** When the game session
   layer wants to send to player X, it publishes to player X's
   channel. The worker that has player X's WebSocket subscribes to
   that channel and forwards. No filtering, no game-id routing logic.
2. **Per-game would force filtering.** "I have player A in this game,
   message is for player B — drop it." Extra code path per message.
3. **Global channel doesn't scale.** Every worker receives every
   message and filters out 99% of them. At 5k concurrent games and
   60 turns each = 60×5000 = 300k messages/sec to filter per worker.
   Wasted bandwidth.
4. **Direct WebSocket routing requires worker discovery** (e.g.,
   "which worker has player X?"). Building a discovery layer (Redis
   set of player_id → worker_id, with TTL, with reconnect handling)
   reinvents pub/sub poorly.
5. **Channel count of 10k at our target scale is fine.** Redis
   handles millions of channels in benchmark. The "subscription
   overhead" concern is theoretical at our scale.

**Sub-decision: subscribe on connect, unsubscribe on disconnect.**
- Each worker maintains `Subscriber` task per connected player.
- On `_ws_manager.connect(player_id)` → spawn subscriber task.
- On `_ws_manager.disconnect(player_id)` → cancel subscriber task.
- Reconnect handled naturally by the new connection re-subscribing.

**Meta-pattern: "Fan-out at the topology level the consumer cares about"**
- Per-user notifications → per-user channel
- Per-room chat → per-room channel
- Broadcast announcements → global channel
- **Generalizable principle: the channel granularity should match the
  natural unit of message recipient. Coarser = wasted bandwidth.
  Finer = wasted subscriptions. The "right" granularity equals the
  smallest unit your app actually addresses messages to.**

**Interview framing:**
> "Per-player pub/sub channels. When the game session layer wants to
> send to player X, it publishes to `ki_clash:player:{X}`. The
> worker holding player X's WebSocket subscribes to that channel and
> forwards. This gives direct routing — no filtering, no game-id
> dispatch logic. Per-game channels would have forced 'message for
> player A but I have player B' filtering. Global channels would have
> sent every message to every worker. At 5k concurrent games we
> have ~10k subscriptions; Redis handles millions, so this scales
> well within margins."

---

## DR-14: Concurrency control for turn submission

**Decision:** Redis WATCH/MULTI/EXEC optimistic concurrency. Retry with
backoff on WatchError up to 3 times, then surface error to client.

**Options considered:**
- A) **WATCH/MULTI/EXEC (optimistic)** ← chosen
- B) Distributed lock via Redis (RedLock or SET NX EX)
- C) Lua scripts (server-side atomic logic)
- D) Single-writer queue per game

**Trade-off table:**

| Dimension | Optimistic (WATCH) | Lock | Lua | Queue |
|---|---|---|---|---|
| Lock-free under contention | **✅** | ❌ (blocks) | ✅ (server atomic) | ❌ (queues) |
| Latency under no-contention | **Lowest** (one round-trip) | Lower (no transaction overhead) | Lowest (one round-trip) | Lowest |
| Code complexity | Medium | Low | High (Lua maintenance) | High |
| Behavior under contention | Retry on conflict | Wait | No-op (atomic) | FIFO order |
| Risk of deadlock | None | Possible (must TTL) | None | None |
| Two-player-submit-same-time correctness | ✅ | ✅ | ✅ | ✅ |

**Reasoning chain:**
1. **Contention is rare.** Two players submit at the same time only
   when both happen to act in the same Redis round-trip window
   (sub-ms). At 5k concurrent games × 5-second turn windows, true
   contention is < 0.1% of operations.
2. **WATCH gives "first writer wins" semantics naturally.** P1 reads
   state, P1 writes back. If P2 wrote in between, WATCH detects it,
   EXEC fails, P1 retries with the updated state. P1's logic sees
   P2's action already applied — natural ordering.
3. **Locks introduce blocking + deadlock risk.** Under load, hot
   locks become bottlenecks. Lock TTLs are guesswork (too short ⇒
   double-acquire, too long ⇒ stuck on crashed worker).
4. **Lua is maintenance pain.** Game logic in Lua means duplicating
   game-engine code in a second language, untestable from pytest,
   debugged via Redis logs. Not worth it for our concurrency profile.
5. **Per-game queue serializes everything** — needlessly slow when
   most operations are independent.
6. **Retry budget of 3.** First retry catches transient races (other
   player submitted). Second retry catches genuine bursts. Third
   retry suggests something is wrong → log + return error. Better
   than infinite retry which can mask runaway bugs.

**Sub-decision: state-load retries on WatchError must re-fetch state.**
The whole point of optimistic concurrency is "see the latest state."
Reusing a stale `state` variable defeats the purpose. Wrap the
fetch-mutate-write triple in the WATCH block.

**Meta-pattern: "Optimistic concurrency when conflicts are rare,
pessimistic when they're common"**
- Rare conflicts → optimistic (WATCH, OCC) — low overhead per
  operation, retry on the rare miss
- Common conflicts → pessimistic (locks, transactions) — accept
  overhead to avoid wasted work
- **Generalizable principle: pick concurrency control based on the
  contention rate, not the worst case.**

**Interview framing:**
> "Turn-submission concurrency uses Redis WATCH/MULTI/EXEC optimistic
> control with up to 3 retries. Two players submitting in the same
> sub-ms window is < 0.1% of operations at our scale, so optimistic
> wins — no lock overhead in the common case, and the retry handles
> the rare conflict by re-reading the latest state. Locks would have
> introduced blocking and deadlock-via-TTL-tuning risk. Lua scripts
> would have duplicated the game engine in a second untestable
> language."

---

## DR-15: Session statefulness — stateless workers + Redis-as-truth

**Decision:** Workers are stateless w.r.t. game state. Every operation
loads from Redis, mutates in memory, writes back. Only WebSocket
connections live in worker memory.

**Options considered:**
- A) **Stateless workers, Redis is truth** ← chosen
- B) Cached sessions in worker memory with pub/sub invalidation
- C) Sticky session routing (game_id → always same worker)
- D) Workers own their games; cross-worker requests proxied

**Trade-off table:**

| Dimension | Stateless | Cached | Sticky | Owned |
|---|---|---|---|---|
| Horizontal scaling | **Trivial** (workers identical) | Easy | Limited by routing layer | Hard |
| Failover on worker crash | **No state lost** | State lost (rebuilt from Redis) | State lost (game stops) | State lost |
| Latency per operation | One Redis round-trip | Cache hit fast, miss slow | Cache always hot | Local fast, remote slow |
| Cache-coherence complexity | None | High (invalidation) | None | High (RPC) |
| Memory footprint per worker | O(WS connections) | O(WS conns + active games) | O(WS conns + assigned games) | O(WS conns + owned games) |
| Reasoning load | Lowest | Highest | Medium | High |

**Reasoning chain:**
1. **Stateless workers are the simplest mental model.** "Every
   operation reads from Redis, writes to Redis." No cache coherence,
   no invalidation, no consistency questions.
2. **Worker crashes don't lose state.** A killed worker takes its
   WebSocket connections with it, but the game state lives in Redis.
   Players reconnect, get routed to any worker, resume. Reconnect
   logic from Phase 3 still works — it just talks to Redis instead
   of in-memory dict.
3. **One extra Redis round-trip per operation is sub-ms.** Not a
   bottleneck given the 5000ms turn budget.
4. **Cached sessions create the worst kind of bug.** Stale cache +
   real state → players see inconsistent views, hard to reproduce.
   Avoid.
5. **Sticky routing creates single-points-of-failure.** If worker N
   crashes, every game it owned is stuck until reroute. Stateless +
   Redis avoids this.

**Sub-decision: PvPGameSession becomes a method bundle, not a stateful
object.** Today PvPGameSession holds `_p1_action`, `_p2_action`,
`_connected_players`, `_started`, etc. All of these move into the
Redis-stored state. The class becomes a *façade* of methods that take
(game_id, ...) and load/mutate/save.

**Meta-pattern: "Stateless service layer, stateful storage layer"**
- Web app → stateless (12-factor app)
- Microservices → stateless
- Game backend → stateless (this DR)
- DB / Redis / message queue → stateful, replicated, durable
- **Generalizable principle: when in doubt, push state to a layer
  designed to manage state (DB, Redis), not to a layer designed to
  serve requests (app server). The app layer's job is to translate
  protocols, not to remember.**

**Interview framing:**
> "Workers are fully stateless — every operation loads from Redis,
> mutates in memory, writes back. Only the WebSocket connection
> objects live in worker memory. This eliminates cache coherence
> problems, makes horizontal scaling trivial, and makes worker
> crashes recoverable (game state survives in Redis; players just
> reconnect to any worker). The trade-off is one extra Redis
> round-trip per operation, which is sub-ms and fits easily in our
> 5000ms turn budget."

---

## DR-16: Client-ready handshake — gate turn 1 on both WebSockets

**Context:** The 5-second turn clock (with auto-`charge` on timeout) must
not start until *both* players are actually connected over WebSocket.
The room flow (REST) spawns the game and hands each browser a `game_id`;
each browser then opens its own `wss://…/ws/game/{id}`. But browsers
finish loading at different speeds — one player's arena (2× ~400KB
fighter PNGs + arena) can take 5–6s to render. If the turn clock starts
on the *first* connection, the early player burns turn 1 (and hits the
5s auto-charge) before the opponent's socket is even open.

**Symptom (measured, live, before fix):** A two-client probe connected
P1, waited, then connected P2:
```
[0.60s] P1 connects → immediately receives waiting_for_action  ← clock started solo
[5.60s] P1 5s timer expires → auto-charge → turn_result        ← turn 1 resolved with no P2
[6.60s] P2 connects (turn 1 already gone)
```

**Decision:** Gate the first `waiting_for_action` on a **presence
count** — emit it only when `len(connected_players) == 2`. The WS
handler adds the connecting player to the Redis `connected_players` set
(`handleConnect`) *before* calling `start()`, so the **second** socket to
connect is the one that opens the gate and broadcasts turn 1 to both.
The first connector is a logged no-op (`start_waiting_for_opponent`).

**Options considered:**
- A) **Presence gate** (`len(connected)==2` triggers turn 1) ← chosen
- B) Server-side deadline only (start the 5s clock at game spawn / first connect)
- C) Explicit client "loaded" ack (browser sends a `client_ready` frame after assets render)

**Trade-off table:**

| Dimension | A: Presence gate | B: Deadline only | C: Explicit ack |
|---|---|---|---|
| Fixes the ghost-opponent timer | **Yes** | No (the exact bug above) | Yes |
| New protocol surface | None (connection *is* the signal) | None | New client→server msg + handling |
| Extra round-trip | None | None | One (client must send ack) |
| Handles slow asset load | Connection completes after load | No | **Most precise** (waits for render) |
| Reconnect reuse | Same set drives reconnect detection | n/a | Separate path |
| Complexity | Lowest correct option | Lowest but wrong | Highest |

**Reasoning chain:**
1. The bug is fundamentally *"started the clock against a player who
   isn't there yet."* The fix must hold turn 1 until everyone is present.
2. The WebSocket connection is already a readiness signal — by the time
   the socket is open, the JS that opens it has run. Option C's extra
   precision (wait for full asset render) wasn't worth a new protocol
   message; the socket-open signal is good enough and the perceived
   start latency is tiny (measured below).
3. We already track presence in Redis `connected_players` (DR-13/DR-15
   reuse it for cross-instance reconnect). The gate is one `len()==2`
   check inside the same atomic `watchAndUpdate` that marks the player
   connected — no new state, no new round-trip.
4. "Second-arrival triggers" falls out naturally: `handleConnect` adds
   the player, then `start()` checks the count. First socket → count 1
   → no-op. Second socket → count 2 → fire. Idempotent via the
   `Started` flag against a double-fire.

**Verification (measured, live, after fix):** Same two-client probe:
```
[0.64s] P1 connects → ZERO frames for the full 6s solo window
        (total_msgs=0, waiting_for_action=0, turn_result=0 — past the
        5s limit, so NO phantom auto-charge fired)
[6.60s] P2 connects
[6.603s] P2 ← waiting_for_action      (turn=1, time_limit=5, ki 0/0)
[6.607s] P1 ← waiting_for_action      (both within ~8ms of P2 connect)
```
A later 8-dimension verification workflow re-confirmed this independently
under the `handshake-timing`, `ws-auth`, `full-match`, and `turn-timeout`
agents (all PASS).

**Trade-off / follow-on (resolved):** The gate couples turn-start to
connection state *at match open*. The verification workflow then found
that the same coupling was missing *mid-match*: on disconnect the 5s
timer kept firing (auto-charging the absent player) and
`opponent_reconnected` was never broadcast. Those were fixed in commit
`9d7ad2d` by applying the same "presence-aware scheduling" idea during
the disconnect grace window — `handleDisconnect` now pauses the turn
timer (`cancelTurnTimeout`), reconnect resumes it, and reconnect is
correctly detected via `Started && !wasLive` (the disconnect had removed
the player from `connected_players`, so the old `HasConnected()` test
misfired). Re-verified live: a dropped player's game stays paused (zero
`turn_result` for 8s while gone), and the survivor receives
`opponent_reconnected` on return. See `docs/troubleshooting.md`.

**Meta-pattern:** *Never start a synchronized clock on the first
participant.* Gate the first synchronized event on a readiness condition
covering **all** participants, tracked in shared state, and let the last
arrival trigger it.

**Interview framing:**
> "I gated the first turn behind a two-player presence check so the
> 5-second turn clock never starts against a ghost opponent. I verified
> it by measurement: the lone player gets zero frames for 6 seconds —
> past the timeout, so no phantom auto-charge — and then both players
> get turn 1 within ~8ms of the second socket connecting. The presence
> set was already in Redis for cross-instance reconnect, so the fix was
> one `len(connected)==2` gate with no new protocol surface."

**Commit:** `fix(game): client-ready handshake — hold turn 1 until BOTH connect`

---

## DR-17: WebGL effects via PixiJS — not a game engine, not staying on DOM

**Context:** The battle arena's visual ceiling was the problem. The DOM/CSS
arena (`KiAuraArena`, framer-motion + a few dozen divs) tops out at tens of
animated elements; CSS `blur` glow is expensive and there's no way to do
thousands of additive particles, screen-warp shockwaves, chromatic
aberration, or bloom. The goal was "진짜 화려하게" — spectacular,
particle-heavy effects — while keeping the product shippable to **web + PWA +
iOS/Android app store from one codebase**.

**Decision:** Render only the battle arena with **PixiJS v8 (WebGL)**, keep
React for all UI. A game engine (Unity/Godot) was rejected.

**Options considered:**
- A) **PixiJS WebGL arena, React for UI** ← chosen
- B) Stay on DOM/CSS + framer-motion
- C) Canvas 2D (hand-drawn, no GPU shaders)
- D) Game engine (Unity / Godot WebGL export)

**Trade-off table:**

| Dimension | A: PixiJS WebGL | B: DOM/CSS | C: Canvas2D | D: Unity/Godot |
|---|---|---|---|---|
| Effect ceiling (particles/shaders) | **Thousands + GPU filters** | ~dozens, no shaders | thousands, no shaders | Highest |
| Runs on web + PWA + Capacitor app | **Yes, same code** | Yes | Yes | iOS WKWebView: no WebGPU, heavy |
| Bundle size | mid (tree-shaken) | tiny | tiny | 20–50MB (load hell) |
| Reuse existing React/TS + PNG assets | **All of it** | All | Most | **Discarded** |
| Fit for a turn-based 1v1 | Great | weak visuals | ok | overkill (physics/3D unused) |
| Learning cost | medium (Pixi v8) | none | medium | high |

**Reasoning chain:**
1. The two axes are independent: **how you draw** (DOM < Canvas < WebGL <
   native engine) vs **how you ship** (web < PWA < Capacitor < native). The
   user's instinct conflated them — "install / app store" is packaging and
   doesn't change graphics. The graphics ceiling is the draw axis, and that's
   where WebGL is the jump.
2. **WebGL runs identically on web, PWA, and Capacitor (WKWebView).** This is
   the load-bearing fact for "one codebase → everywhere." Unity WebGL is the
   opposite — WKWebView has **no WebGPU** and Unity's WASM bundle is a
   mobile-load liability. So the spectacular-effects goal and the
   one-codebase goal both point at PixiJS, not an engine.
3. A turn-based duel needs **no** physics/3D/scene-graph engine — Unity's
   value is wasted, and its 0% asset reuse is a pure cost.
4. **Readability beats per-character effect shapes for a fast RPS-style
   game.** Action effects keep a *unified shape* so players read "that was an
   attack" in 0.1s; identity comes from a per-character *color tint*
   (`character.color`). The bespoke spectacle lives in the match-end
   **finisher** (6 DOM finishers) where readability doesn't matter — the
   격겜 norm: normals read clean, only the super is bespoke.

**Implementation (verified against installed Pixi 8.19 / pixi-filters 6.1
source before writing):**
- `particles.ts`: pooled additive `GlowEmitter` (recycle, no GC stutter),
  runtime soft-glow texture (2D-canvas radial gradient → `Texture.from`,
  sidestepping the version-sensitive `FillGradient`), 3 emission patterns.
- `effects.ts`: 6 self-cleaning ticker effects + pixi-filters (Glow,
  Shockwave, RGBSplit, AdvancedBloom, ColorMatrix). Energy wave is
  kamehameha-class: 3-layer beam + muzzle orb + screen flash + impact shock.
- `PixiBattleArena.tsx`: v8 async init with unmount-race guard, clean
  `destroy({removeView},{children,texture,textureSource})`, `preference:
  'webgl'` (no WebGPU on WKWebView), DPR cap 2, ticker pause on background.
- Integration: **one persistent arena** across gameplay phases (single WebGL
  context per match), effects fired at reveal via a **ref-tracked nonce**
  (ref not state → two fires per turn get distinct nonces, neither lost to
  React batching).

**Meta-pattern:** *Separate "how you draw" from "how you ship"* — and when you
need a higher graphics ceiling, reach for the lightest tool that clears it
(WebGL via Pixi) before a heavyweight engine, especially under a
one-codebase-everywhere constraint.

**Interview framing:**
> "I needed a much higher effects ceiling than DOM/CSS but had to keep one
> codebase shipping to web, PWA, and the app stores. A game engine like Unity
> breaks that — WKWebView has no WebGPU and the bundle is a mobile-load
> liability — so I went WebGL via PixiJS for just the arena and kept React for
> UI; WebGL runs identically across all those targets. I also kept action
> effects unified-shape-but-color-tinted for readability in a fast
> rock-paper-scissors game and put the bespoke character spectacle in the
> match-end finisher — the fighting-game convention."

**Commit:** `feat(arena): PixiJS v8 WebGL effect engine` + `feat(pvp): wire PixiBattleArena into live match`

---

## DR-18: Retrospective — "enhance" means ADD a layer, not REPLACE the working thing

**What happened (the mistake):** Asked to make the battle effects "진짜
화려하게" (truly spectacular) and explicitly to add "이펙트만" (effects
ONLY), I instead **replaced the entire dynamic DOM arena** (`KiAuraArena`)
with a static-PNG PixiJS arena (`PixiBattleArena`) on both the AI and PvP
pages. KiAuraArena was not just an effects container — it owned the
**character motion** (windup / impact / recoil / pose changes via
`useActionAnimation` + `FighterSprite` transforms). Replacing it silently
deleted all that motion and made fighters look blurry (upscaled PNG + glow).
The user noticed immediately: "동작이랑 다 삭제했냐 … 이펙트만 넣어야지."

**Root cause:** I treated "enhance the effects" as "rewrite the arena."
Replacement throws away the value you didn't inventory. KiAuraArena's
*motion* was invisible-to-me value — I was focused on effects and never
catalogued what else the component did before swapping it out.

**Compounding errors (symptom-chasing on a wrong foundation):** Once the
arena was wrong, every follow-up "fix" tuned the wrong base —
fighter scale 0.5→0.78, a wide-desktop layout, fighter spread — and one of
them (positioning computed once at init) introduced a resize bug
(troubleshooting: "fighters mispositioned after resize"). I also misread
"초창기 배치" as just the CSS box size and fixed dimensions while the real
loss (motion) stayed gone because the *component* had been replaced.

**Whose fault:** Mine, not the user's. "이펙트만" was an unambiguous,
correct directive. Terse user directives are usually precise — "only
effects" meant *do not touch the motion*, and I violated it from the first
step.

**The fix:** Reverted both pages to the pre-Pixi dynamic `KiAuraArena`
verbatim (from commit `e44850d`). The correct way to add the WebGL effects
is a **transparent Pixi overlay layered on top** of KiAuraArena — additive,
motion untouched — not a replacement.

**Trade-off table (the decision I should have made up front):**

| Dimension | Replace component | ADD overlay layer ← right call |
|---|---|---|
| Preserves existing motion/behavior | **No — silently lost** | Yes (untouched) |
| Matches an "only add X" request | No | **Yes** |
| Blast radius if X is wrong | Whole arena | Just the overlay |
| Rollback cost | Rewrite | Delete one layer |
| Risk of re-introducing solved bugs | High (rebuild from scratch) | Low |

**Meta-pattern:** *Enhancement is composition, not substitution.* When a
request is to ADD a capability, default to layering/overlay/decoration over
the working thing. Before replacing any component, **inventory everything it
does that is NOT the thing you're changing** — that list is the value
replacement destroys. Keep enhancements behind a thin, deletable layer so a
"no, revert" is one line, not a rewrite.

**Interview framing:**
> "I learned this the hard way on my own game: asked to *add* spectacular
> effects, I rewrote the whole battle arena in WebGL and silently deleted the
> character animation the old component owned. The lesson — enhancement is
> composition, not substitution. Now when a request is additive I default to
> an overlay layer and inventory what the existing component does beyond the
> part I'm touching, so I don't throw away invisible value or blow up the
> blast radius."

**Commit:** `revert(arena): restore original dynamic KiAuraArena on both pages`

---

## DR-19: CI as a merge gate — and keep load tests OFF the per-PR path

**Decision:** Add a GitHub Actions pipeline that runs hermetic unit + build
gates on every push/PR to `main`; keep the k6 load/perf suite as a manual /
scheduled tool that hits a live stack, **not** a per-PR gate.

**Context:** Until now the flow was "commit → push → Vercel auto-deploys." That
is CD with **no test gate** — the only thing standing between a broken commit and
production was manual testing. During the PixiJS work (DR-17/18) the TypeScript
build broke repeatedly and was only caught by hand or in a preview. Separately,
the new k6 suite (`5837e07`) can drive real load, which raised the question of
where load tests belong in the pipeline.

**Options considered:**
- **A) No CI** — keep relying on Vercel CD + manual testing. (status quo)
- **B) CI with unit + build gates per push/PR; load tests manual/scheduled.** ← chosen
- **C) Full CI including k6 load/perf on every PR.**

**Trade-off table:**

| Dimension | A) No CI | B) Unit+build gate, load off-path | C) Load tests per PR |
|---|---|---|---|
| Catches regressions before merge | ❌ prod/manual only | ✅ fast, deterministic | ✅ but slow |
| Pipeline determinism / flakiness | n/a | ✅ hermetic (containers) | ❌ load is noisy |
| Protects live infra | n/a | ✅ never touched by gate | ❌ hammers single t3.micro |
| PR feedback speed | n/a | ✅ minutes | ❌ load runs are long |
| Perf signal captured | ❌ | ⚠️ on-demand only | ✅ continuous |

**Reasoning chain:** A leaves the exact gap that bit us — Vercel deploys
whatever is on `main` with nothing verifying it builds, so a red build reaches
users. B closes that with three **hermetic** jobs (Postgres/Redis as service
containers, `tsc --noEmit` + `next build`, `go test ./...`) — cheap, fast, and
deterministic, the only kind of check that belongs on a blocking path. C is the
trap: the k6 suite defaults at a **live, single-instance** backend
(`api.jjan.daeseon.ai`, one t3.micro), so gating every PR on it would both
**hammer production** and make the pipeline **flaky** (load latency is
non-deterministic by nature). Load tests are point-in-time *perf* checks, not
*correctness* gates. They still encode non-zero-exit thresholds (`http_req_failed
< 2%`, `p95 < 1.5s`), so they *can* later be wired into a nightly job against a
throwaway stack — but never onto the per-PR path.

**Meta-pattern:** *Match the test to the gate.* Deterministic, cheap, hermetic
checks (unit, type, build) belong on the blocking per-PR path. Expensive,
environment-coupled, non-deterministic checks (load, perf, e2e against live
infra) belong on a manual/scheduled path against disposable infrastructure —
letting them gate a merge buys flakiness and collateral load, not safety.

**Interview framing:**
> "I added CI as a merge gate but deliberately kept the k6 load tests *off* the
> per-PR path. The unit and build jobs are hermetic — Postgres and Redis as
> service containers, a typecheck and a production build — so they're fast and
> deterministic, which is the bar for anything that blocks a merge. The load
> suite hits a live single-instance backend, so gating PRs on it would hammer
> prod and make the pipeline flaky; load is a point-in-time perf check, not a
> correctness gate. The principle is matching each test's cost and determinism
> to where in the pipeline it runs."

**Commits:** `5837e07` (k6 load/perf suite), `3362f9b` (GitHub Actions CI).

---

---

## Engineering Patterns & Principles Surfaced

A consolidated index of the meta-patterns observed across this project's
decisions. Each one is a generalizable engineering principle worth
keeping in your "senior dev toolkit":

| # | Pattern | First seen | Generalizes to |
|---|---|---|---|
| P1 | **2-tier backend split** (game server ↔ platform server in different languages) | DR-1 | Anything with mixed latency-budget workloads |
| P2 | **Aesthetic ↔ monetization alignment** | DR-2 | Product design across every category |
| P3 | **Graceful degradation at the asset boundary** (fallback components) | DR-3 | Any data boundary where late/missing is expected |
| P4 | **Graveyard folder** (strangler fig at folder granularity) | DR-4 | Any rejected-but-still-used code |
| P5 | **Fix errors at the right layer** | DR-5 | All error recovery design |
| P6 | **Documented bugs as executable artifacts** (xfail) | DR-6 | Any known-unfixed issue |
| P7 | **Test against real dependencies; mock only the layers above** | DR-7 | All testing strategy |
| P8 | **Cost-benefit of dependencies** (custom 30 LOC vs lib) | DR-8 | Every dep decision |
| P9 | **Conditional imports for optional features** | DR-9 | Optional integrations |
| P10 | **Tell, don't ask** (encapsulate variant behavior) | DR-10 | Any caller-callee design |
| P11 | **Throwaway work is throwaway only if you don't learn from it** | DR-11 | Roadmap pruning |

These patterns are reusable beyond Ki Clash. Each is a Toronto-staff-
interview answer waiting to happen.

---

## How to use this document

**As a daily reference:** When you're about to make a decision, search
this file for similar patterns. The trade-off tables show what
dimensions to evaluate on.

**As interview prep:** Pick a DR entry, read the trade-offs and
reasoning, then practice saying it out loud as if explaining to an
interviewer. The "Interview framing" sections are templates.

**As a learning roadmap:** The "Meta-pattern" lines name the
generalizable principle. Look up that pattern in your favorite
engineering resource (Designing Data-Intensive Applications, Building
Microservices, etc.) to see how the broader industry applies it.

**As a portfolio artifact:** Link to this file from your résumé /
portfolio when interviewing. It demonstrates engineering depth that
code alone doesn't show.
