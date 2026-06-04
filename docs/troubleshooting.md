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
