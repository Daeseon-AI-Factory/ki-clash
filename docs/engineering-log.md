# Ki Clash — Engineering Log

> Chronological record of every non-trivial engineering decision and step.
> Read top-to-bottom to reconstruct the project's full reasoning. Updated
> as work proceeds, not retroactively.
>
> Format per entry: `Date → Phase → What / Why / Decisions / Discoveries / Next`.

---

## 2026-05-24 — Project genesis

**Context:** Jason (5y SK AX backend, prepping for Toronto) initialized Ki Clash
as **Product003** of his AI Product Factory. Game concept: real-time 1v1
strategy based on the Korean schoolyard "기싸움" (Dragon Ball ki-battle) hand
game. Best-of-3 rounds, 5 actions (Charge / Block / Attack / Energy Wave /
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
   Reigns refs), with Dragon Ball-style effects rendered legally safe
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
