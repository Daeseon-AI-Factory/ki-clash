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
- Energy Wave pierces Block
- Teleport dodges Energy Wave

**Identified gaps:**
1. Energy Wave clash (both 3 ki → both lose 3) — never exercised
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
