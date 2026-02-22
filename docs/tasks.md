# Ki Clash — Task Breakdown

## Implementation Order Philosophy

Ship the game loop first. If someone can play one round vs AI on their phone, you have a product. Everything else layers on top.

---

## Phase 1: Game Engine + AI (Days 1-3) 🎯 MVP Milestone 1

> **Goal:** Playable game logic with tests. No UI, no server — pure Python.

### Task 1.1: Core Types & Outcome Matrix
- **Description:** Define `Action`, `TurnOutcome`, `GameState`, `TurnResult`, `RoundResult`, `MatchResult` as Pydantic models. Implement the outcome matrix as a pure function.
- **Effort:** 3-4 hours
- **Dependencies:** None
- **Files:** `app/core/game_engine/types.py`, `app/core/game_engine/outcome_matrix.py`
- **Done when:** `resolve_actions(Action.ATTACK, Action.CHARGE)` returns `P1_WINS_ROUND`

### Task 1.2: Game Engine
- **Description:** Implement `GameEngine` class with `resolve_turn()`, `validate_action()`, `check_round_end()`, `check_match_end()`. Handles ki tracking, turn counting, round/match lifecycle.
- **Effort:** 4-5 hours
- **Dependencies:** Task 1.1
- **Files:** `app/core/game_engine/engine.py`
- **Done when:** Full best-of-3 match can be simulated programmatically with all edge cases (ki cap, timeout default, 20-turn limit)

### Task 1.3: AI Opponents
- **Description:** Implement `EasyAI`, `MediumAI`, `HardAI`. Easy = weighted random. Medium = pattern counter (tracks last 3 moves). Hard = approximate Nash equilibrium mixed strategy.
- **Effort:** 4-5 hours
- **Dependencies:** Task 1.1
- **Files:** `app/core/ai_opponent/base.py`, `easy.py`, `medium.py`, `hard.py`
- **Done when:** AI can play a full match. Hard AI doesn't have exploitable patterns.

### Task 1.4: Game Engine Tests
- **Description:** Comprehensive tests for outcome matrix (all 25 combinations), engine lifecycle, ki boundaries, AI behavior.
- **Effort:** 3-4 hours
- **Dependencies:** Tasks 1.1-1.3
- **Files:** `tests/core/test_game_engine.py`, `tests/core/test_ai_opponent.py`
- **Done when:** 100% coverage on outcome matrix, >90% on engine

---

## Phase 2: Backend API + Database (Days 4-6) 🎯 MVP Milestone 2

> **Goal:** Game playable via REST API. Can create game, submit turns, get results.

### Task 2.1: Project Setup & Config
- **Description:** FastAPI app scaffold, pydantic-settings config, PostgreSQL connection, Redis connection, Alembic setup.
- **Effort:** 2-3 hours
- **Dependencies:** None (can parallel with Phase 1)
- **Files:** `app/main.py`, `app/config.py`, `app/dependencies.py`, `pyproject.toml`, `Dockerfile`
- **Done when:** `uvicorn app.main:app` starts, DB connects, health endpoint responds

### Task 2.2: Database Models & Migrations
- **Description:** SQLAlchemy models for Player, Match, Round, Turn. Initial Alembic migration.
- **Effort:** 3-4 hours
- **Dependencies:** Task 2.1
- **Files:** `app/models/player.py`, `match.py`, `round.py`, `turn.py`, `alembic/versions/001_initial.py`
- **Done when:** `alembic upgrade head` creates all tables

### Task 2.3: Guest Auth
- **Description:** Auto-generate guest accounts with UUID. JWT issuance. Optional email registration to upgrade guest → permanent. Refresh token flow.
- **Effort:** 4-5 hours
- **Dependencies:** Task 2.2
- **Files:** `app/core/auth/jwt_handler.py`, `app/core/auth/guest_auth.py`, `app/api/v1/endpoints/auth.py`
- **Done when:** Can create guest, get JWT, access protected endpoint, upgrade to email account

### Task 2.4: Game REST API (AI Mode)
- **Description:** Endpoints: create AI game, submit action, get game state. Integrates game engine + AI opponent. Persists turns to DB.
- **Effort:** 5-6 hours
- **Dependencies:** Tasks 1.2, 1.3, 2.2, 2.3
- **Files:** `app/api/v1/endpoints/games.py`, `app/services/game_service.py`, `app/schemas/game.py`
- **Done when:** Can play full best-of-3 AI match via curl/Postman

### Task 2.5: Player API
- **Description:** Get player profile, stats (wins/losses), match history.
- **Effort:** 2-3 hours
- **Dependencies:** Task 2.2, 2.3
- **Files:** `app/api/v1/endpoints/players.py`, `app/services/player_service.py`, `app/schemas/player.py`
- **Done when:** Can view win/loss record and past match summaries

### Task 2.6: Backend Tests
- **Description:** Integration tests for all API endpoints. Mock nothing (use test DB).
- **Effort:** 3-4 hours
- **Dependencies:** Tasks 2.3-2.5
- **Files:** `tests/api/test_auth.py`, `test_games.py`, `test_players.py`

---

## Phase 3: Web Frontend (Days 7-10) 🎯 MVP Milestone 3

> **Goal:** Playable in a browser. Card UI, countdown, AI mode works end-to-end.

### Task 3.1: Next.js Project Setup
- **Description:** Next.js 14+ with TypeScript, Tailwind CSS, project structure, API client setup.
- **Effort:** 2-3 hours
- **Dependencies:** None
- **Files:** `web/` directory scaffold

### Task 3.2: Game Board & Action Cards
- **Description:** 5 action cards (Charge, Block, Attack, Energy Wave, Teleport) with tap selection. Cards dim when unaffordable. Selected card highlights. Ki-cost badges on cards.
- **Effort:** 5-6 hours
- **Dependencies:** Task 3.1
- **Files:** `web/src/components/GameBoard.tsx`, `ActionCard.tsx`
- **Done when:** Can see 5 cards, tap to select, visual feedback on selection and affordability

### Task 3.3: Countdown & Reveal Animation
- **Description:** 3-beat countdown (visual pulse + sound). Both cards flip simultaneously. Result text/animation (HIT!, BLOCKED!, DODGED!, etc.). Screen shake on successful attack.
- **Effort:** 5-6 hours
- **Dependencies:** Task 3.2
- **Files:** `web/src/components/CountdownTimer.tsx`, `TurnReveal.tsx`
- **Done when:** Full turn feels dramatic: countdown → select → flip → result

### Task 3.4: Match HUD
- **Description:** Ki meters (both players), round score indicator (★★☆), turn history sidebar (scrollable list of past actions), opponent info bar.
- **Effort:** 4-5 hours
- **Dependencies:** Task 3.2
- **Files:** `web/src/components/KiMeter.tsx`, `MatchHUD.tsx`

### Task 3.5: Game Flow Integration
- **Description:** Connect UI to backend API. Guest auto-auth on first visit. Game creation → turn loop → match result screen. Difficulty selection for AI. Play again button.
- **Effort:** 5-6 hours
- **Dependencies:** Tasks 2.4, 3.2-3.4
- **Files:** `web/src/hooks/useGameApi.ts`, `web/src/lib/gameApi.ts`, page components
- **Done when:** Full AI match playable in browser: pick difficulty → play 3 rounds → see result → play again

### Task 3.6: Tutorial / Onboarding
- **Description:** 3-step interactive tutorial. Step 1: "This is Charge" (forced Charge vs AI Charge). Step 2: "This is Attack" (forced Attack vs AI Charge — you win!). Step 3: "This is Block" (AI Attacks, you Block — you survive!). Skip button available.
- **Effort:** 3-4 hours
- **Dependencies:** Task 3.5
- **Files:** `web/src/components/Tutorial.tsx`

---

## Phase 4: Online PvP (Days 11-14) 🎯 MVP Milestone 4

> **Goal:** Play against real humans in real-time.

### Task 4.1: WebSocket Infrastructure
- **Description:** FastAPI WebSocket endpoints. WSManager for connection tracking, rooms, broadcasting. Heartbeat/ping-pong for connection health.
- **Effort:** 5-6 hours
- **Dependencies:** Task 2.1
- **Files:** `app/core/ws_manager/manager.py`, WebSocket endpoint handlers
- **Done when:** Two clients can connect to same room and exchange messages

### Task 4.2: Matchmaking Service
- **Description:** Redis-backed matchmaking queue. Player joins → waits → paired → game created → both notified. 30s timeout → offer AI fallback.
- **Effort:** 4-5 hours
- **Dependencies:** Task 4.1
- **Files:** `app/modules/ki_clash/matchmaking.py`, `app/services/matchmaking_service.py`
- **Done when:** Two players can find each other and start a game

### Task 4.3: Real-Time Game Session
- **Description:** WebSocket-based turn flow for PvP. Both submit actions → server resolves → broadcasts result. Handles disconnect (30s reconnect window). Turn timeout (5s → auto-Charge).
- **Effort:** 6-8 hours
- **Dependencies:** Tasks 4.1, 4.2, 1.2
- **Files:** `app/modules/ki_clash/game_session.py`
- **Done when:** Two players can play full best-of-3 match via WebSocket with disconnect recovery

### Task 4.4: Frontend WebSocket Integration
- **Description:** `useGameWebSocket` hook. Matchmaking UI (searching... with animation). Seamless transition from matchmaking to gameplay. Disconnect handling UI.
- **Effort:** 5-6 hours
- **Dependencies:** Tasks 4.3, 3.5
- **Files:** `web/src/hooks/useGameWebSocket.ts`, `useMatchmaking.ts`, matchmaking page
- **Done when:** Web user can find match, play PvP, handle disconnects gracefully

### Task 4.5: PvP Tests
- **Description:** Test matchmaking pairing, WebSocket message flow, disconnect scenarios, turn timeout.
- **Effort:** 3-4 hours
- **Dependencies:** Tasks 4.1-4.3

---

## Phase 5: Mobile App (Days 15-18) 🎯 MVP Milestone 5

> **Goal:** Same game on mobile via React Native.

### Task 5.1: React Native (Expo) Setup
- **Description:** Expo project, TypeScript, navigation, shared types with web project.
- **Effort:** 2-3 hours
- **Dependencies:** None (can start anytime)

### Task 5.2: Mobile Game UI
- **Description:** Port GameBoard, ActionCards, CountdownTimer, TurnReveal, MatchHUD to React Native. Gesture-based card selection (tap). Haptic feedback on reveal.
- **Effort:** 6-8 hours
- **Dependencies:** Tasks 5.1, 3.2-3.4 (web components as reference)
- **Notes:** Don't copy web code — rebuild for native. Share type definitions and API client logic only.

### Task 5.3: Mobile Game Flow
- **Description:** Guest auth, AI mode, PvP matchmaking — same flows as web, native UI.
- **Effort:** 4-5 hours
- **Dependencies:** Tasks 5.2, 2.4, 4.3

### Task 5.4: Mobile-Specific Polish
- **Description:** Push notifications (match found), background handling (pause/resume), app store assets.
- **Effort:** 3-4 hours
- **Dependencies:** Task 5.3

---

## Phase 6: Ads & Launch (Days 19-21) 🎯 LAUNCH

> **Goal:** Monetized and deployed.

### Task 6.1: Ad Integration (Web)
- **Description:** Google AdSense. Banner on lobby. Interstitial between matches (not during). Rewarded video for bonus (e.g., rematch without ad cooldown).
- **Effort:** 3-4 hours
- **Dependencies:** Task 3.5

### Task 6.2: Ad Integration (Mobile)
- **Description:** Google AdMob. Same placements as web. Test on real devices.
- **Effort:** 3-4 hours
- **Dependencies:** Task 5.3

### Task 6.3: Deploy Backend
- **Description:** Railway deployment. PostgreSQL + Redis provisioned. Environment variables configured. CI/CD via GitHub Actions.
- **Effort:** 3-4 hours
- **Dependencies:** All backend tasks

### Task 6.4: Deploy Frontend
- **Description:** Vercel deployment for web. Expo build for mobile (TestFlight / internal testing).
- **Effort:** 2-3 hours
- **Dependencies:** All frontend tasks

### Task 6.5: Launch Checklist
- **Description:** Error monitoring (Sentry), basic analytics (Vercel Analytics / Expo), rate limiting on API, CORS configuration, production env vars audit.
- **Effort:** 3-4 hours
- **Dependencies:** Tasks 6.3, 6.4

---

## Summary Timeline

| Phase | Days | Milestone |
|---|---|---|
| 1. Game Engine + AI | 1-3 | Core logic tested ✅ |
| 2. Backend API | 4-6 | AI game playable via API ✅ |
| 3. Web Frontend | 7-10 | AI game playable in browser ✅ |
| 4. Online PvP | 11-14 | PvP playable on web ✅ |
| 5. Mobile App | 15-18 | Mobile app working ✅ |
| 6. Ads & Launch | 19-21 | **SHIPPED** 🚀 |

**Total estimated: 21 working days to launch.**

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| WebSocket complexity delays PvP | High | Ship AI-only first (end of Phase 3), add PvP as update |
| React Native takes longer than expected | Medium | Web is primary, mobile can launch 1-2 weeks later |
| Low matchmaking pool (not enough players) | High | AI fallback after 30s wait. Add friend invite links early. |
| Dragon Ball IP concerns | Low | No DB characters or names. Generic "ki" and "energy" theme. Original art style. |
| Game balance issues | Medium | Hard AI uses Nash equilibrium — if it's balanced for AI, it's balanced for PvP |
