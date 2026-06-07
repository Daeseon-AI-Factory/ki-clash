# Ki Clash — Troubleshooting

Problem-indexed reference of non-trivial fixes. Companion to the date-indexed
timeline in `content/logs/ki-clash/`.

Grounding rules (same discipline as the timeline): every **Symptom** is the
literal message or observable behavior, every **Cause** is verified against the
commit diff or `docs/engineering-log.md`, every **Commit** hash is real, and any
inference is marked `Hypothesis:` / `Suspected:`. Entries with no captured
runtime error say so. Concrete only — no "lessons learned" essays.

Format per entry: **Symptom / Cause / Fix / Commit / Pattern**.

---

## Spurious `opponent_reconnected` on first connect

- **Symptom**: On its very first connection to the game WebSocket, a client received an unhandled `opponent_reconnected` message although no disconnect/reconnect had occurred. PvP simulator trace (engineering-log):
  ```
  T+00489ms  P1  ←recv (unhandled) opponent_reconnected: {}
  ```
- **Cause**: In `app/api/v1/endpoints/ws.py`, `game_ws()` branched on `if session is None / else`, treating any *already-existing* session as a reconnect. The session is created by the **first** player to connect, so the **second** player always hit the `else` branch → `handle_reconnect()` → `opponent_reconnected()`. The "session exists" signal only meant "someone already connected," not "this player reconnected." No per-player tracking existed.
- **Fix**: Added `self._connected_players: set[UUID]` and a single `handle_connect(player_id)` entrypoint in `PvPGameSession`: already-in-set ⇒ true reconnect (cancel forfeit timer, notify opponent, resend state); otherwise first connect (record silently, no notification). `ws.py` dropped the if/else and now always calls `session.handle_connect(...)`. Files: `app/api/v1/endpoints/ws.py`, `app/modules/ki_clash/game_session.py`, `app/schemas/ws.py`, `tests/integration/test_pvp_flow.py`.
- **Commit**: `7dc3dde` (bundles all four PvP fixes below)
- **Pattern**: When a call site must pick between variants but the deciding data lives inside the callee, push the decision into the callee instead of inferring it from a proxy signal. (DR-10)

## Duplicate `waiting_for_action` per turn

- **Symptom**: A client received two `waiting_for_action` messages for the same single turn at match start. Simulator trace:
  ```
  T+07087ms  P1 ←recv waiting_for_action round=2 turn=3
  T+07991ms  P1 ←recv waiting_for_action round=2 turn=3   (duplicate)
  ```
  No server error was raised — observable behavior only.
- **Cause**: `session.start()` was reachable from two call sites in `ws.py` (the post-session-creation branch and the trailing `room_size >= 2` check). With both players connected, both paths fired, so `_send_waiting_for_action()` ran twice per turn. `start()` had no idempotency guard.
- **Fix**: Added `self._started: bool` to `PvPGameSession`; `start()` now early-returns if already started (idempotent no-op). Collapsed the two `ws.py` call sites into one trailing call guarded by `room_size(room_id) >= 2`. Files: `app/modules/ki_clash/game_session.py`, `app/api/v1/endpoints/ws.py`.
- **Commit**: `7dc3dde`
- **Pattern**: Idempotency-guard any state-transition method (`start` / `init`) reachable from multiple call sites or retried by concurrent connections.

## `action_confirmed` / `turn_result` arrive out of order

- **Symptom**: A player received `turn_result` before its own `action_confirmed` for the same submission. Simulator trace:
  ```
  T+02820ms  P2  send→ submit_action block
  T+02820ms  P2  ←recv turn_result (!)         ← arrived before action_confirmed
  T+02832ms  P2  ←recv action_confirmed
  ```
  Captured by the xfail test `test_action_confirmed_arrives_before_subsequent_turn_result`.
- **Cause**: Per the engineering log's revised analysis, the duplicate `start()` (entry above) introduced extra await points where events interleaved across the two players' sockets. WebSocket delivery is in-order *per socket*, but `_resolve_turn()` crosses both sockets. `Suspected:` no code change targeted this bug directly — it shared the same interleaving window as the duplicate-`start()` bug.
- **Fix**: Fell out of the duplicate-`start()` cleanup — the single `start()` call path plus the idempotency guard removed the extra await points, so `submit_action()` sends `action_confirmed` immediately and `_resolve_turn()` only runs after both submissions land. The xfail test was converted to a passing regression assertion. Same files as the entry above.
- **Commit**: `7dc3dde`
- **Pattern**: Fixing a concurrency bug that removes spurious await points can implicitly resolve downstream ordering races that share the same interleaving window.

## `action_confirmed` lacks `turn_number` (stale-turn messages)

- **Symptom**: The `action_confirmed` payload carried only `{"type": "action_confirmed", "data": {"action": ...}}` — no turn sequence number. A client could not distinguish a stale `action_confirmed` (e.g. turn 3) from the current turn (turn 4). Observable message shape; no runtime error.
- **Cause**: The payload was built as an inline dict literal in `game_session.py` (`submit_action`) instead of going through a schema function, so the `turn_number` field was simply omitted.
- **Fix**: Added `action_confirmed(turn_number, action)` to `app/schemas/ws.py`, returning `{"type": "action_confirmed", "data": {"turn_number": ..., "action": ...}}`. `submit_action()` now calls `ws_msg.action_confirmed(turn_number=current_round.turn_number + 1, action=action.value)`, matching the `waiting_for_action` convention so clients can correlate confirmations and ignore stale arrivals. Files: `app/schemas/ws.py`, `app/modules/ki_clash/game_session.py`.
- **Commit**: `7dc3dde`
- **Pattern**: Build outbound WS/event payloads through one schema function, not inline dict literals at call sites — inlining makes it easy to silently drop required fields like a sequence number.

## Expired JWT → web client stuck on 401

- **Symptom**: The browser repeatedly showed an auth failure, even after clearing localStorage (engineering-log, line 617):
  ```
  Invalid token: Signature has expired
  ```
  The server rejects the invalid token with HTTP 401 and the web client had no recovery, so it stayed stuck.
- **Cause**: A guest JWT in localStorage becomes invalid via several paths to the same symptom: the `exp` claim passes, the JWT secret rotates, or — the diagnosed case — the `pgdata` docker volume is recreated during `docker compose up --build`, so the token's `player_id` no longer exists in the rebuilt database. Clearing localStorage didn't help because a new stale token kept getting re-created.
- **Fix**: `web/src/lib/api.ts` — `apiFetch` now delegates to `apiFetchInternal` with an `allowAuthRetry` flag. On HTTP 401, when `allowAuthRetry` is true and the path is not `/api/v1/auth/guest`, it calls `logout()` to clear the stale token, `createGuestSession()` for a fresh one, and retries the original request once with `allowAuthRetry = false`. The one-shot guard plus the guest-endpoint skip prevent infinite recursion.
- **Commit**: `b13e837`
- **Pattern**: Fix errors at the right layer — when the server's 401 is *correct*, recovery belongs in the client/auth layer (re-auth + retry), not in weakening server validation or extending token TTL. (DR-5)

## Docker image `CMD` hardcoded port 8000 instead of binding `$PORT`

- **Symptom**: The image's own `CMD` bound a hardcoded port in exec form, so it would ignore an injected `$PORT`:
  ```
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```
  Observable in the Dockerfile; no runtime error was captured.
- **Cause**: Exec-form `CMD` performs no shell variable expansion, so `--port 8000` was bound unconditionally. `Note:` at this commit the **actual Railway entrypoint was `railway.toml`'s `[deploy] startCommand`**, which already used `--port ${PORT:-8000}`. So this was **not** a live "unreachable deploy" — the change corrected the *image's own* `CMD` (drift / standalone `docker run` correctness) ahead of the `startCommand` being removed later in `20dafa4`.
- **Fix**: Changed `CMD` to shell form `["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]` so the variable expands (falling back to 8000 locally). The diff also removed an inline comment (`# Railway overrides this via railway.toml startCommand`) that was, in fact, accurate at the time. File: `Dockerfile`.
- **Commit**: `23a9a0f`
- **Pattern**: PaaS containers should bind the platform-injected `$PORT`; use the **shell** `CMD` form so the variable actually expands, and keep the image `CMD` and any platform `startCommand` from drifting.

## Docker build/start not self-contained — copy order + embedded start command

- **Symptom**: The build/start was not self-contained: `pip install "."` ran after copying only `pyproject.toml` (before the source tree), and the migrate-then-serve command lived only in `railway.toml`'s `[deploy] startCommand` rather than in the image. `Hypothesis:` no literal build error was captured — inferred from the diff and commit message.
- **Cause**: Installing a PEP 517 project (`pip install "."`) before `COPY . .` means the package source is not present at install time. Separately, the image `CMD` only started uvicorn; running migrations was a platform-only concern.
- **Fix**: Reordered the Dockerfile to `COPY . .` before `RUN pip install --no-cache-dir "."`; changed the image `CMD` to `sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"`, baking migrate-then-serve into the image; removed the now-redundant `startCommand` from `railway.toml`. Files: `Dockerfile`, `railway.toml`.
- **Commit**: `20dafa4`
- **Pattern**: Copy source before installing a self-referential / PEP 517 package, and bake the start/migration command into the image `CMD` rather than a platform-specific `startCommand`, so the container is self-contained.

## Migration state opaque on deploy — added a status marker (diagnostic, not a fix)

- **Symptom**: Deploy logs gave no confirmation that `alembic upgrade head` had run or completed before uvicorn started — migration state was opaque in the startup sequence. No runtime error captured.
- **Cause**: `Hypothesis:` the `startCommand` chained `alembic upgrade head && uvicorn ...` with no echo/marker, so the deploy logs showed no signal of migration completion (and with `&&`, a silent migration failure would also abort startup).
- **Fix** (*diagnostic*): Changed `railway.toml`'s `startCommand` to `alembic upgrade head; echo 'MIGRATIONS DONE'; uvicorn ...`. Two effects: (1) the `echo 'MIGRATIONS DONE'` marker makes the migration step visible in deploy logs; (2) swapping `&&` for `;` starts uvicorn regardless of the alembic exit code. This surfaces migration state during debugging — it is **not** a root-cause fix. `Note:` the `;` also means uvicorn now starts even if alembic fails, which can *mask* a real migration failure. File: `railway.toml`.
- **Commit**: `76983bf`
- **Pattern**: Add observability (a log/marker) to make state visible before guessing at the cause.

## First turn starts before both players connect (timer fires on lone client)

- **Symptom**: After both players hit Ready and the room spawned the game, the player whose browser finished loading first saw the 5-second turn timer running *before the opponent had even connected*. With slow asset loads (5-6s), the first turn could auto-resolve (auto-`charge`) before the screen finished rendering. Measured directly against the live Go server (`api.jjan.daeseon.ai`) with a two-client script that connected P1, waited, then connected P2:
  ```
  [0.60s] P1 WS connected → immediately receives waiting_for_action   ← bug
  [5.60s] P1 5s timer expires → auto-charge → turn_result
          (P2 has NOT connected yet; turn 1 already resolved solo)
  [6.60s] P2 connects
  [11.21s] second waiting_for_action ...
  ```
- **Cause**: In `go-server/session.go`, the WS handler calls `session.start()` on every connect. `start()` only checked the `Started` flag (idempotency) — it did **not** check whether *both* players were present in `connected_players`. So the first client to open its WebSocket triggered the first `waiting_for_action` + the turn-timeout goroutine, with no "wait for the opponent" gate. This is the classic missing **client-ready handshake** in real-time multiplayer: the server must hold the first turn until every participant has joined (cf. a LoL "waiting for players… 87%" loading screen).
- **Fix**: Gate the first turn on both players being connected. `start()` now only fires `sendWaitingForAction` when `len(connected_players) == 2`; the WS handler calls it after `handleConnect` adds the player to the set, so whichever client connects *second* is the one that actually starts the match. `Started` flips to true only at that point (still idempotent against double-fire). Files: `go-server/session.go`, `go-server/handler.go`.
- **Commit**: (this change)
- **Pattern**: In real-time multiplayer, never start the clock on the first connection. Gate the first synchronized event (turn 1) on a readiness condition covering **all** participants — track presence in shared state (Redis `connected_players`) and let the last arrival trigger the start.

## Mid-match disconnect: game does not pause, absent player auto-charged (FIXED, commit `9d7ad2d`)

- **Symptom**: When a player dropped mid-match, the game did NOT pause for the 30-second grace window — the per-turn 5s timer kept firing and the server auto-submitted `charge` for the absent player, bleeding turns/rounds while they were gone. Measured (live, 8-dimension verification workflow, `disconnect-reconnect` agent): forfeit run played turns 1→5 with `opponent_action="charge"` across the 30s window before forfeit fired; a reconnect run saw a full turn cycle elapse in a 4s disconnect gap (P2 reached `p2_ki:5`).
- **Cause**: The turn scheduler (5s `turnTimeout` goroutine + auto-charge) was independent of connection state. On disconnect the server started a 30s forfeit timer but never paused the per-turn timer (contrast DR-16, where scheduling IS coupled to presence at match open — it was missing mid-match).
- **Fix**: `handleDisconnect` now calls `s.cancelTurnTimeout(gameID)` — the per-turn clock stops the moment a player drops, so the game truly pauses. It resumes in `handleConnect`'s reconnect branch (`sendWaitingForAction` restarts `startTurnTimeout`); if the player never returns, `forfeitAfterTimeout` is the only terminal path. File: `go-server/session.go`.
- **Verification (live, after fix)**: disconnected P1, observed P2 for 8s → received only `opponent_disconnected` and **zero `turn_result`** (game stayed paused — before the fix turns kept resolving). On reconnect the flow resumed. RESULT: pause=PASS.
- **Commit**: `9d7ad2d`
- **Pattern**: A "grace period" only works if the clock that can end the game is paused during it. Couple the turn scheduler to connection state mid-match, the same way DR-16 couples turn-start to presence at match open.

## Reconnect: opponent_reconnected never broadcast to the surviving player (FIXED, commit `9d7ad2d`)

- **Symptom**: When a dropped player reconnected within the 30s window they fully resumed play, but the *surviving* player was NEVER told. Measured: across 2 reconnect runs P1 reconnected well inside the window (one run 4.0s after disconnect) and resumed, yet P2's captured stream had zero `opponent_reconnected` frames. A client showing an "opponent disconnected, waiting…" overlay would never clear.
- **Cause**: `handleConnect` keyed reconnect detection on `HasConnected(playerID)` — but `handleDisconnect` REMOVES the player from `connected_players`, so on return `HasConnected()` was always false → every reconnect was misclassified as a fresh first-connect → the `opponent_reconnected` branch never ran.
- **Fix**: Changed the reconnect signal to `isReconnect = sess.Started && !wasLive` (game already started + this player not currently live = they dropped and came back). Reconnecting players are re-added to `connected_players` (also required so `forfeitAfterTimeout`'s `HasConnected` abort works), and the survivor receives `opponent_reconnected`. File: `go-server/session.go`.
- **Verification (live, after fix)**: P1 reconnect → P2's captured stream = `['opponent_reconnected', 'waiting_for_action']`. RESULT: reconnect_notify=PASS.
- **Commit**: `9d7ad2d`
- **Pattern**: Every state-change notification needs a symmetric counterpart — emit `opponent_reconnected` on the inverse of `opponent_disconnected`, or the peer's UI sticks forever. And: don't reuse a "currently connected" set to answer "has this player ever connected" — different questions.

## Forfeit match_result carries zeroed stats (FIXED, commit `9d7ad2d`)

- **Symptom**: A forfeit-win `match_result` reported `rounds_won_p1:0, rounds_won_p2:0, total_turns:0` even when turns were played (measured: 5 turns played, P2 ki reached 5, yet all counters 0). The `winner` field was correct.
- **Cause**: `total_turns` was summed only from completed `RoundResults`. On a mid-round-1 forfeit no round had completed, so the sum was 0 — the in-progress `CurrentRound.TurnNumber` was never added. (`rounds_won` 0-0 was actually correct — no round won yet.)
- **Fix**: `forfeitAfterTimeout` now adds `sess.GameState.CurrentRound.TurnNumber` to the completed-round sum. File: `go-server/session.go`.
- **Verification (live, after fix)**: played 2 turns, P1 forfeited → `{rounds_won_p1:0, rounds_won_p2:0, total_turns:4, winner:'you'}`. `total_turns:4` (was 0). RESULT: PASS.
- **Commit**: `9d7ad2d`
- **Pattern**: Terminal-state payloads should be derived from accumulated state including in-flight progress, not just finalized sub-results.

## /health responds 405 to HEAD (FIXED, commit `9d7ad2d`)

- **Symptom**: `curl -sI https://api.jjan.daeseon.ai/health` (HEAD) → `HTTP/2 405, allow: GET`; a follow-up GET → 200. HEAD-based uptime monitors / load balancers would misreport the API as down.
- **Cause**: The FastAPI `/health` route was declared `@app.get` only, so HEAD wasn't allowed.
- **Fix**: Changed to `@app.api_route("/health", methods=["GET","HEAD"])`. File: `app/main.py`.
- **Verification (live, after fix)**: `curl -sI` (HEAD) → `HTTP/2 200`; GET → `{"status":"ok"}`.
- **Commit**: `9d7ad2d`
- **Pattern**: Liveness endpoints should answer the method your monitor actually uses; many default to HEAD.

## Verification mission summary (2026-06-04, 8-dimension live workflow)

- **What**: After deploying to AWS (DR-16 handshake fix included), ran an 8-agent verification workflow against the LIVE backend (`api.jjan.daeseon.ai`) — each agent wrote and ran a real python3 script (no fabricated results), covering: REST room lifecycle, WS auth edge cases, client-ready handshake timing, full match playthrough, turn-timeout auto-charge, disconnect/reconnect/forfeit, concurrency/atomicity, and static-assets/infra health.
- **Result**: Overall **GREEN** — an uninterrupted 2-player match starts, plays to completion, and resolves with NO desync. 7/8 dimensions PASS; `disconnect-reconnect` PARTIAL (the 4 bugs above).
- **Proven working (measured)**: REST lifecycle + all error codes (409/403/404/400); WS auth ordered before upgrade (401/404/403); handshake (lone player 0 frames for 6s, both get turn 1 ~8ms after 2nd connect); full best-of-3 (charge math, perspective-flip both sides, match_result rounds 2-0, no desync); 5s auto-charge anchored to turn start; concurrency (8 simultaneous submits + 10 parallel games, zero lost/dup/out-of-order, no cross-game leakage); infra (36/36 PNGs 200, bundle ships prod API URL with no localhost leak, JJAN title, valid TLS+HSTS, 5/5 containers healthy, separate /data EBS mounted, 2GB swap, alembic at b8f3c72e1a44).
- **Residual risk / not-tested**: outcome-matrix rows other than charge/charge and attack-vs-charge unverified; disconnect path partially broken (above); single-run timing samples (no soak/load test); no token-expiry/refresh, Redis/DB-failure, or rate-limit abuse tests.
- **Pattern**: Verify a live deployment by measurement across independent dimensions in parallel, force every claim to cite an observed value, and treat "expected-but-didn't-happen" as a logged bug — not a silent pass.

## Single-player "Game '<id>' not found" mid-match (FIXED, commit `d3ef61f`)

- **Symptom**: During a single-player (vs AI) match the client intermittently got `Game '<uuid>' not found` (HTTP 404) and the game appeared to vanish — happening "계속" (constantly, ~half the requests). PvP (rooms / quick match) was unaffected.
- **Cause**: Single-player game state lives in a **per-process in-memory dict** (`_active_games` in `app/services/game_service.py`), but the API ran **`uvicorn --workers 2`**. The create request (`POST /games/ai`) stored the game in worker A's dict; the next `GET /games/{id}` or `POST /games/{id}/action` round-robined to worker B, whose dict didn't have it → `NotFoundError("Game", id)` whose format is `f"{resource} '{resource_id}' not found"` — exactly the observed message. ~50% per request. This is the same statelessness gap DR-15 closed for PvP (Redis-as-truth) but never applied to the single-player REST path.
- **Fix**: `docker-compose.prod.yml` api command `--workers 2` → `--workers 1`. All requests now hit the same process, so the in-memory store is consistent. One async worker handles many concurrent connections on the event loop and also eases memory on the t3.micro (1GB). PvP is Redis-backed so it's worker-count-agnostic.
- **Verification (live, after fix)**: created an AI game, then `GET /games/{id}` ×16 with no mutation → **16/16 HTTP 200, zero 404** (round-robin would scatter ~50% 404s). The only legitimate post-fix 404 is *after* a match ends, when the game is correctly `del`-eted from `_active_games`.
- **Commit**: `d3ef61f`
- **Known follow-up (Scale Later)**: with >1 API **instance** behind a load balancer, in-memory `_active_games` breaks again. Before multi-instance scale, migrate single-player game state to Redis (mirror DR-15 / the PvP `GameStore`). Documented, not yet done — per CLAUDE.md "Scale Later, Ship Now" (single t3.micro today).
- **Pattern**: In-memory per-process state + >1 worker = intermittent "not found". Either pin to one worker (single instance) or move state to a shared store (multi-instance). The error being ~50% (not 100%) is the tell-tale sign of round-robin across workers.

## PixiJS arena: fighters mispositioned/mis-scaled after canvas resize (FIXED, commit `321ab15`)

- **Symptom**: After adding a responsive wide-desktop arena box (`lg:max-w-6xl` / `lg:62vh`), the WebGL graphics looked "broken" (병신됨) — fighters drifted off-center, wrong size, or bunched in a corner.
- **Cause**: `PixiBattleArena` computed `groundY`, fighter scale, and X positions **once at init** from `app.screen`. But `resizeTo: host` makes the renderer track the host box, which changes size on responsive breakpoints / layout shift / hydration. The sprites kept their stale init-time pixel positions+scale while the canvas grew → visual breakage. The wide-layout change altered the box size after init and exposed the latent bug.
- **Fix**: Extracted a `layout()` that recomputes `groundY` + scale + positions from the CURRENT `app.screen`, called at init AND on every `ResizeObserver` fire (observer on the host div). `groundY` is mutable so the idle-bob ticker tracks the live ground. Observer disconnected on cleanup. Robust at any size now. File: `web/src/components/arena/pixi/PixiBattleArena.tsx`.
- **Commit**: `321ab15`
- **Pattern**: Any canvas/WebGL view with `resizeTo` (or a responsive container) must RE-LAYOUT on resize — never position/scale once at init. Drive it from a `ResizeObserver` on the host, not a one-shot init read.

## Wide-desktop arena layout rolled back to narrow mobile-first (commit after `321ab15`)

- **What**: A wide-desktop arena (`lg:max-w-6xl`, `lg:h-[62vh]`) was tried so the stage filled large screens. Rolled back per user preference to the consistent narrow `max-w-2xl` / `40vh` column on all viewports.
- **Why**: The wider stage didn't read better for this game and (combined with the resize bug above) made the arena feel off. Mobile-first narrow column is the app's baseline; kept it everywhere.
- **Note**: This was a layout/preference rollback only — the PixiJS arena and the resize-robust `layout()` fix were retained. The fighter spread (outer fifths, 0.2/0.8) and ~0.74 height fit stay (they prevent the "따닥 붙음" crowding without needing the wide box).
- **Pattern**: Ship layout experiments behind cheap, reversible changes (Tailwind responsive classes) so a preference rollback is a one-line revert, not a rewrite.

## Vercel preview deployment URLs return 401 (auth wall) — not an app bug

- **Symptom**: Old version URLs from `vercel ls` (e.g. `kiclash-<hash>-<team>.vercel.app`) returned **HTTP 401** and showed a login/SSO page; opening them surfaced "fetch 에러" because the protected shell couldn't call the API. Looked like the old version was "broken."
- **Cause**: Vercel **Deployment Protection (Vercel Authentication)** is enabled on the project, so per-deployment preview URLs require being logged into the Vercel account. Only the **production domain** (`jjan.daeseon.ai`) is public. The production site itself was verified healthy throughout (`/health` 200, guest auth 200, AI game create 200, CORS OK).
- **Fix / options**: (a) To make old version URLs publicly viewable for A/B comparison: Vercel dashboard → project → Settings → Deployment Protection → Vercel Authentication → Disable. (b) Or add an in-app arena toggle (e.g. `?arena=dom`) so both versions render from the public production deployment with no auth. Neither applied yet — documented for when version comparison is needed.
- **Pattern**: Vercel preview URLs are private by default. For stakeholder/version comparison, either disable deployment protection or expose the variants behind a flag on the public production URL — don't hand out raw preview URLs expecting them to load.
