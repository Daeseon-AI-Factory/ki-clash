# Ki Clash - Complete Project Guide

Everything you need to explain this project in an interview, debug it, deploy it, or hand it off to another developer.

---

## Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [How the Game Works](#2-how-the-game-works)
3. [Tech Stack & Why](#3-tech-stack--why)
4. [Project Structure](#4-project-structure)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture (Web)](#6-frontend-architecture-web)
7. [Mobile Architecture](#7-mobile-architecture)
8. [Pixel Art System](#8-pixel-art-system)
9. [Animation System](#9-animation-system)
10. [Real-Time PvP (WebSockets)](#10-real-time-pvp-websockets)
11. [Authentication](#11-authentication)
12. [Payment (Stripe)](#12-payment-stripe)
13. [Ads (AdSense)](#13-ads-adsense)
14. [Database & Migrations](#14-database--migrations)
15. [Deployment](#15-deployment)
16. [How to Run Locally](#16-how-to-run-locally)
17. [Troubleshooting & Lessons Learned](#17-troubleshooting--lessons-learned)
18. [Interview Talking Points](#18-interview-talking-points)

---

## 1. What Is This Project?

Ki Clash (기싸움) is a **real-time 1v1 strategy game** inspired by the Korean schoolyard game "Dragon Ball Ki Battle." Two players simultaneously choose actions each turn (charge, block, attack, etc.) creating a mind-game of prediction and resource management.

**What makes it interesting:**
- Full-stack: Python backend + Next.js web + React Native mobile
- Real-time multiplayer via WebSockets
- AI opponents with 3 difficulty levels (random, pattern-tracking, game-theory optimal)
- Pixel art rendering using pure CSS (no images, no canvas)
- Monetization: ads + Stripe payments
- ELO ranking system

**Scale of the project:**
- ~55 Python files (backend)
- ~54 TypeScript files (web)
- ~38 TypeScript files (mobile)
- ~147 source files total

---

## 2. How the Game Works

### Actions (5 total)

| Action | Ki Cost | Ki Gain | What It Does |
|--------|---------|---------|--------------|
| **Charge** | 0 | +1 | Build ki. You're vulnerable while charging. |
| **Block** | 0 | 0 | Blocks Attack. Fails against Energy Wave. |
| **Attack** | 1 | 0 | Hits a charging opponent. Blocked by Block. Dodged by Teleport. |
| **Energy Wave** | 3 | 0 | Pierces Block. Hits Charge. Dodged by Teleport. |
| **Teleport** | 1 | 0 | Dodges Attack and Energy Wave. Wastes ki vs Charge/Block. |

### Outcome Matrix

Think of it like advanced rock-paper-scissors with a resource economy:
- **Attack beats Charge** (you hit them while they're powering up)
- **Block beats Attack** (you deflected their punch)
- **Energy Wave beats Block** (your beam pierces their shield)
- **Teleport beats Attack and Energy Wave** (you dodged)
- **Attack vs Attack** = Clash (both lose ki)

### Match Format
- **Best of 3 rounds**
- Each round: both start at 0 ki
- Round ends when someone lands an unblocked hit on a charging opponent
- 5-second turn timer (auto-Charge if you don't pick)
- Max 20 turns per round (higher ki wins if no knockout)

### Why This Design Works
The ki economy creates depth. You NEED to charge to attack, but charging makes you vulnerable. So you have to READ your opponent: "Will they charge? Attack? Block?" This is the same dopamine loop as poker — reading people.

---

## 3. Tech Stack & Why

| Layer | Technology | Why This Choice |
|-------|-----------|-----------------|
| **Backend** | Python 3.11 + FastAPI | Async-first, auto-generated API docs, Pydantic validation |
| **Web Frontend** | Next.js 16 + TypeScript | Server-side rendering, file-based routing, React ecosystem |
| **Mobile** | React Native (Expo) | Share logic with web, single codebase for iOS/Android |
| **Database** | PostgreSQL + SQLAlchemy 2.0 async | Battle-tested relational DB, async for non-blocking I/O |
| **Cache/Queue** | Redis | Matchmaking queue (sorted set), fast pub/sub for real-time |
| **Real-time** | WebSockets (FastAPI native) | Bidirectional, low-latency for simultaneous action reveal |
| **Auth** | JWT (guest-first) | No signup friction, upgrade path to registered accounts |
| **Payment** | Stripe | Industry standard, good developer experience |
| **Ads** | Google AdSense (web) | Standard for web games |
| **CSS** | Tailwind CSS v4 | Utility-first, fast prototyping, consistent design |
| **Deploy** | Railway (backend) + Vercel (web) | Simple, cheap, auto-deploy from GitHub |
| **Container** | Docker + docker-compose | Reproducible local dev environment |

### Key Decision: No Canvas/WebGL for Graphics

We render pixel art using **CSS `box-shadow`** instead of `<canvas>`. Why?

- Zero dependencies (no Pixi.js, no Phaser)
- Works everywhere (any browser, SSR-compatible)
- Each pixel is a box-shadow offset: `3px 6px 0 #ff0000` = one red dot at position (3,6)
- The entire character is one `<div>` with hundreds of box-shadow values
- Animations are pure CSS transforms on the wrapper div (translate, scale, rotate)

This is clever but has limits — it works for small sprites (12x16 pixels) but wouldn't scale to full game scenes.

---

## 4. Project Structure

```
Product003_DragonballTurnGame/
│
├── app/                          # BACKEND (Python/FastAPI)
│   ├── main.py                   # App entry point, lifespan, CORS
│   ├── config.py                 # Environment variables (pydantic-settings)
│   ├── database.py               # SQLAlchemy async engine + session
│   ├── dependencies.py           # FastAPI dependency injection
│   ├── exceptions.py             # Custom error hierarchy
│   │
│   ├── core/                     # REUSABLE modules (tagged CORE_CANDIDATE)
│   │   ├── game_engine/          # Pure game logic (no I/O, no DB)
│   │   │   ├── engine.py         # State machine: match → round → turn
│   │   │   ├── outcome_matrix.py # Who wins each action matchup
│   │   │   └── types.py          # Action, GameState, TurnResult enums
│   │   ├── ai_opponent/          # AI difficulty strategies
│   │   │   ├── easy.py           # Random with charge bias
│   │   │   ├── medium.py         # Pattern-tracking counter strategy
│   │   │   └── hard.py           # Nash equilibrium mixed strategy
│   │   ├── auth/                 # JWT + guest authentication
│   │   ├── payment/              # Stripe checkout + webhooks
│   │   └── ws_manager/           # WebSocket room manager
│   │
│   ├── services/                 # Business logic layer
│   │   ├── game_service.py       # Bridges engine ↔ database
│   │   ├── matchmaking_service.py # Redis queue + player pairing
│   │   ├── ranked_service.py     # ELO calculations + leaderboard
│   │   └── payment_service.py    # Ad-free purchase fulfillment
│   │
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── player.py             # Player account + stats
│   │   ├── match.py              # Match record
│   │   ├── round.py              # Round within a match
│   │   └── turn.py               # Individual turn actions + outcome
│   │
│   ├── schemas/                  # Pydantic request/response models
│   │   ├── game.py               # Game API schemas
│   │   ├── auth.py               # Auth schemas
│   │   ├── ranked.py             # Leaderboard schemas
│   │   └── payment.py            # Stripe schemas
│   │
│   ├── api/v1/                   # REST + WebSocket endpoints
│   │   ├── router.py             # Aggregates all routers
│   │   └── endpoints/
│   │       ├── auth.py           # POST /guest, /login, /register
│   │       ├── games.py          # POST /ai, POST /{id}/action
│   │       ├── players.py        # GET /me, match history
│   │       ├── ranked.py         # GET /leaderboard
│   │       ├── purchases.py      # Stripe checkout + webhook
│   │       └── ws.py             # WebSocket matchmaking + game
│   │
│   └── modules/ki_clash/         # Product-specific logic
│       └── game_session.py       # PvP game session over WebSocket
│
├── web/                          # WEB FRONTEND (Next.js)
│   └── src/
│       ├── app/                  # Pages (file-based routing)
│       │   ├── page.tsx          # Main game (AI mode)
│       │   ├── pvp/page.tsx      # PvP mode
│       │   ├── tutorial/page.tsx # Interactive tutorial
│       │   ├── ranked/page.tsx   # Leaderboard
│       │   ├── shop/page.tsx     # Ad-free purchase
│       │   ├── history/page.tsx  # Match history
│       │   ├── invite/page.tsx   # Friend challenge
│       │   └── globals.css       # Animations (keyframes)
│       │
│       ├── components/           # UI components
│       │   ├── GameBoard.tsx     # 5 action cards + countdown
│       │   ├── TurnReveal.tsx    # Card flip animation + outcome
│       │   ├── MatchHUD.tsx      # Score, ki meters, turn history
│       │   ├── CharacterSelect.tsx # 6-character picker
│       │   ├── AITrashTalk.tsx   # Speech bubble
│       │   ├── pixel-art/        # Pixel rendering system
│       │   │   ├── PixelFighter.tsx  # Animated sprite
│       │   │   ├── BattleArena.tsx   # Full battle scene
│       │   │   ├── PixelEffects.tsx  # Beam, shield, flash, etc.
│       │   │   └── Scanlines.tsx     # CRT overlay
│       │   └── ads/              # AdSense components
│       │
│       ├── hooks/                # React hooks (state machines)
│       │   ├── useGame.ts        # AI game state machine
│       │   ├── usePvP.ts         # PvP state + WebSocket
│       │   ├── usePixelAnimation.ts # Animation phase sequencer
│       │   ├── useTutorial.ts    # Tutorial flow
│       │   ├── useSoundEffects.ts # Audio playback
│       │   └── useAdTiming.ts    # When to show ads
│       │
│       └── lib/                  # Data + utilities
│           ├── api.ts            # HTTP client + auth tokens
│           ├── characters.ts     # 6 character definitions
│           ├── pixel-art-types.ts # Pixel frame types
│           ├── pixel-art-utils.ts # box-shadow renderer
│           └── pixel-frames/     # Character sprite data (6 files)
│
├── mobile/                       # MOBILE (React Native / Expo)
│   ├── app/                      # Screens (Expo Router)
│   └── src/                      # Components, hooks, lib (mirrors web)
│
├── alembic/                      # Database migrations
├── tests/                        # pytest test suite
├── Dockerfile                    # Container image
├── docker-compose.yml            # Local dev (PostgreSQL + Redis + API)
├── railway.toml                  # Railway deployment config
└── pyproject.toml                # Python dependencies
```

---

## 5. Backend Architecture

### Layer Diagram

```
   HTTP Request / WebSocket Connection
              │
    ┌─────────v──────────┐
    │   API Endpoints     │   ← Thin layer: validation + routing
    │   (api/v1/)         │
    └─────────┬──────────┘
              │
    ┌─────────v──────────┐
    │   Services          │   ← Business logic: orchestration
    │   (services/)       │
    └─────────┬──────────┘
              │
    ┌─────────v──────────┐
    │   Core Modules      │   ← Pure logic: no I/O, reusable
    │   (core/)           │
    └─────────┬──────────┘
              │
    ┌─────────v──────────┐
    │   Models + Database │   ← Persistence
    │   (models/)         │
    └────────────────────┘
```

### Dependency Rule (Critical!)

```
core/     ← depends on NOTHING product-specific
   ↑
services/ ← depends on core
   ↑
api/      ← depends on services + core
   ↑
modules/  ← product-specific, can depend on anything above
```

**Core NEVER imports from services or api.** This means the game engine, AI opponent, WebSocket manager, and Stripe handler can all be reused in a completely different product without any changes.

### Game Engine (core/game_engine/)

The game engine is a **pure state machine**. It has zero knowledge of databases, HTTP, or WebSockets. You give it actions, it gives you results.

```python
# This is all the engine does:
engine = GameEngine()
state = engine.create_match(match_type="ai", difficulty="medium")
state, turn_result = engine.submit_turn(state, p1_action="attack", p2_action="charge")
# turn_result.outcome = "p1_wins_round"
```

**Why pure?** Because you can:
1. Unit test it without mocking anything
2. Run it in a CLI (`play.py`)
3. Use it for AI mode AND PvP mode with the same code
4. Reuse it in a completely different frontend

### AI Opponent (core/ai_opponent/)

Three strategies, each implementing the same interface:

**Easy (`easy.py`):**
- Weighted random: Charge 45%, Block 20%, Attack 20%, Energy Wave 10%, Teleport 5%
- Dumb but not completely random — charges a lot, which feels realistic

**Medium (`medium.py`):**
- Tracks your last 3 actions
- If you charge a lot → attacks you
- If you attack a lot → blocks
- Basically punishes repetitive play

**Hard (`hard.py`):**
- Starts with Nash equilibrium (game-theory optimal mixed strategy)
- Gradually adapts to your patterns
- Uses opponent modeling to shift probabilities
- Almost impossible to beat consistently because it plays optimally

### Game Service (services/game_service.py)

Bridges the pure engine with the database:

```
Player clicks "Attack"
  → API endpoint receives request
    → game_service.submit_action() called
      → Gets AI action from ai_opponent
      → Calls engine.submit_turn()
      → Saves Turn record to database
      → If round ended: saves Round, creates new Round
      → If match ended: updates Player stats (wins/losses)
      → Returns result to API
    → API sends response to client
```

In-memory game state cache (`_active_games` dict) keeps active games in RAM for fast access. This works for single-server MVP but would need Redis for multi-server.

### Matchmaking (services/matchmaking_service.py)

Uses Redis sorted set as a FIFO queue:

```
Player 1 clicks "Find Match" → added to Redis queue (score = timestamp)
Player 2 clicks "Find Match" → added to Redis queue

Background task (every 500ms):
  - Pulls first 2 players from queue
  - Creates game state
  - Notifies both via WebSocket: "match_found"
  - Both connect to game WebSocket
  - Game begins
```

30-second timeout: if no match found, client gets `matchmaking_timeout` and can fall back to AI.

---

## 6. Frontend Architecture (Web)

### State Machine Pattern

The entire game UI is driven by a **phase enum**:

```
lobby → character_select → loading → playing → revealing → round_end → match_end
```

Each phase renders completely different UI. There's one big conditional in `page.tsx`:

```tsx
{phase === "lobby" && <LobbyScreen />}
{phase === "playing" && <GameBoard />}
{phase === "revealing" && <TurnReveal />}
// etc.
```

**Why this works:** No complex routing or nested state. One variable (`phase`) controls everything. Easy to debug — just log the phase.

### Custom Hooks (The Brain)

| Hook | What It Manages |
|------|----------------|
| `useGame()` | All AI game state: phase transitions, API calls, game state |
| `usePvP()` | PvP state + 2 WebSocket connections (matchmaking + game) |
| `usePixelAnimation()` | Animation timing: idle → windup → impact → recover → idle |
| `useTutorial()` | 3-step scripted tutorial with hardcoded AI responses |
| `useSoundEffects()` | Audio playback (hit, clash, block, dodge sounds) |
| `useAdTiming()` | When to show interstitial ads (every N matches) |

### Data Flow: One Turn

```
1. Player taps "Attack" card          [GameBoard.tsx]
2. playAction("attack") called        [useGame.ts]
3. Phase → "loading"
4. POST /api/v1/games/{id}/action     [api.ts → backend]
5. Backend resolves turn, returns result
6. State updated: lastTurn, gameState
7. Phase → "revealing"
8. triggerPixelAction("attack")        [usePixelAnimation.ts]
9. BattleArena animates fighters       [BattleArena.tsx + PixelFighter.tsx]
10. TurnReveal does card flip          [TurnReveal.tsx]
11. Outcome text appears: "HIT!"
12. Screen shakes                      [page.tsx CSS class]
13. Sound plays                        [useSoundEffects.ts]
14. Player clicks "Next Turn"
15. Phase → "playing"
16. Repeat from step 1
```

### API Client (lib/api.ts)

All HTTP calls go through `apiFetch()`:
- Auto-injects `Authorization: Bearer {token}` header
- Base URL from `NEXT_PUBLIC_API_URL` env var (defaults to `http://localhost:8000`)
- Token stored in `localStorage` (web) or `SecureStore` (mobile)

Guest auth: On first visit, `ensureAuth()` calls `POST /api/v1/auth/guest` to get a JWT token. No signup required.

---

## 7. Mobile Architecture

The mobile app (React Native / Expo) **mirrors the web structure**:

```
web/src/hooks/useGame.ts    →  mobile/src/hooks/useGame.ts
web/src/lib/api.ts          →  mobile/src/lib/api.ts
web/src/components/         →  mobile/src/components/
```

### Key Differences from Web

| Aspect | Web | Mobile |
|--------|-----|--------|
| Token storage | `localStorage` | `expo-secure-store` (encrypted) |
| Styling | Tailwind CSS classes | React Native `StyleSheet` |
| Pixel art | CSS `box-shadow` | Individual `<View>` elements (no box-shadow in RN) |
| Animations | CSS keyframes + transitions | `Animated` API (spring, timing) |
| Navigation | Next.js file routing | Expo Router (stack navigation) |
| Haptics | None | `expo-haptics` (vibration on hit/clash) |
| Sound | Web Audio API | `expo-av` |

### Why Not Share Code Directly?

React Native doesn't support CSS box-shadow or Tailwind. The logic (hooks, api, game rules) is identical, but the rendering layer must be rewritten for native components.

---

## 8. Pixel Art System

### How It Works

Each character is a **2D array of hex colors**:

```typescript
// Haneul's sprite (12 wide × 16 tall)
const haneul: PixelFrame = [
  [null, null, "#1E3A5F", "#1E3A5F", "#1E3A5F", null, ...],  // row 0 (hair)
  [null, "#1E3A5F", "#1E3A5F", "#1E3A5F", "#1E3A5F", ...],   // row 1
  // ... 16 rows total
];
```

This array is converted to CSS `box-shadow`:

```typescript
function frameToBoxShadow(grid: PixelFrame, px: number): string {
  const shadows: string[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x]) {
        shadows.push(`${x * px}px ${y * px}px 0 ${grid[y][x]}`);
      }
    }
  }
  return shadows.join(", ");
}
```

The result: one tiny `<div>` (3px × 3px) with hundreds of box-shadows creates the entire sprite. `px=3` means each "pixel" is 3 real pixels wide.

### 6 Characters

| Character | Color | Personality |
|-----------|-------|-------------|
| Haneul (하늘) | Blue #60A5FA | Philosophical monk |
| Bora (보라) | Purple #C084FC | Mysterious oracle |
| Taeyang (태양) | Yellow #FBBF24 | Brash hothead |
| Danbi (단비) | Cyan #22D3EE | Serene warrior |
| Seokjin (석진) | Orange #FB923C | Old mountain master |
| Yuri (유리) | Pink #F472B6 | Elegant prodigy |

Characters are **cosmetic only** — no gameplay differences. AI difficulty is set separately.

---

## 9. Animation System

### Phase State Machine

Every animation follows the same 4-phase cycle:

```
idle → windup (600ms) → impact (800ms) → recover (600ms) → idle
```

The `usePixelAnimation` hook drives this timing. Components read `phase` and apply different CSS transforms per phase.

### Per-Action Transforms (PixelFighter.tsx)

| Action | Windup | Impact | Recover |
|--------|--------|--------|---------|
| **Charge** | Crouch down, scale 0.85 | Burst up, scale 1.4 | Float, scale 1.1 |
| **Block** | Brace, lean back, scale 0.8 | Absorb, push back | Stand up |
| **Attack** | Pull back 20px, rotate -12deg | Lunge forward 55px, leap up | Bounce back |
| **Energy Wave** | Lean back, scale 1.3, rotate | Recoil forward, scale 0.8 | Settle |
| **Teleport** | Phase out, opacity 0.3, spin | Vanish upward, opacity 0 | Reappear 40px ahead |
| **Victory** | Crouch | Jump up, scale 1.5 | Float big |
| **Defeat** | Stagger | Fall down, rotate -25deg, fade | Stay down |

### Phase-Based Easing

Each phase uses different CSS timing:
- **Windup:** `cubic-bezier(0.34, 1.56, 0.64, 1)` — overshoot (builds anticipation)
- **Impact:** `0.15s cubic-bezier(0, 0, 0.2, 1)` — snap fast (feels powerful)
- **Recover:** `0.6s cubic-bezier(0.22, 1, 0.36, 1)` — smooth ease out

### Visual Effects

| Effect | When | What |
|--------|------|------|
| PixelEnergyBall | Energy Wave windup | Glowing orb with radial gradient |
| PixelBeam | Energy Wave impact | Wide beam across 60% of arena |
| PixelShield | Block windup/impact | Checkerboard pixel wall |
| PixelFlash | Attack/Wave impact | White screen flash |
| PixelChargeAura | Charge windup/impact | Scattered pulsing particles |
| PixelTeleportTrail | Teleport impact/recover | Fading purple ghost |
| PixelVictoryBurst | Victory (match end) | Golden sparkles floating up |
| PixelDefeatSmoke | Defeat (match end) | Rising dark smoke |

### TurnReveal Card Flip

The card flip is pure CSS 3D:

```css
.card-flip-inner.flipped {
  transform: rotateY(180deg);
}
.card-front {
  transform: rotateY(180deg);  /* pre-rotated, invisible until flipped */
  backface-visibility: hidden;
}
```

Staged timing (2.1 seconds total):
1. **0ms** — Both cards show "?"
2. **300ms** — Cards start flipping (800ms CSS transition)
3. **1100ms** — Cards visible, outcome still hidden (suspense!)
4. **2100ms** — Outcome text pops in ("HIT!", "CLASH!", etc.)

### Independent Fighter Animations

Each fighter animates their own chosen action independently. If you block and AI attacks, YOUR fighter braces while AI's fighter lunges. This required:

1. `BattleArena` accepts separate `playerAction` and `aiAction` props
2. Each `PixelFighter` receives its own action
3. Effects render per-side (left beam vs right beam)

---

## 10. Real-Time PvP (WebSockets)

### Two WebSocket Connections

**1. Matchmaking WebSocket** (`/api/v1/ws/matchmaking`):
```
Client connects → joins Redis queue → waits for match
Server background task (every 500ms): pulls 2 players → pairs them
Server sends "match_found" with game_id → client disconnects this WS
```

**2. Game WebSocket** (`/api/v1/ws/game/{game_id}`):
```
Both players connect → game starts
Player sends: { type: "submit_action", action: "attack" }
Server waits for BOTH players to submit
Server resolves turn → broadcasts result to both
Repeat until match ends
```

### WSManager (core/ws_manager/)

Observer pattern for managing connections:

```python
class WSManager:
    _connections: dict[UUID, WebSocket]      # player → socket
    _rooms: dict[str, set[UUID]]             # room → players
    _player_rooms: dict[UUID, str]           # player → room

    async def send_to_player(player_id, message)    # direct message
    async def broadcast_to_room(room_id, message)    # everyone in room
    async def send_personal_to_room(room_id, fn)     # different msg per player
```

The `send_personal_to_room` method is crucial — it lets the server send DIFFERENT data to each player (e.g., hiding opponent's action until both have submitted).

### Why Not Socket.IO?

FastAPI has native WebSocket support. Socket.IO adds overhead (polling fallback, rooms abstraction) that we handle ourselves more efficiently. Plus, one fewer dependency.

---

## 11. Authentication

### Guest-First Flow

```
1. User opens game for first time
2. ensureAuth() checks localStorage for token
3. No token found → POST /api/v1/auth/guest
4. Server creates Player with random name ("Brave Tiger", "Swift Dragon")
5. Server returns JWT access + refresh tokens
6. Tokens stored in localStorage
7. All subsequent API calls include: Authorization: Bearer {token}
```

**Why guest-first?** Zero friction. Nobody wants to create an account to try a casual game. They can optionally upgrade to a registered account later.

### JWT Structure

```python
# Access token payload
{
  "sub": "a6ef73d6-5079-4f17-...",  # player UUID
  "exp": 1772356124,                 # expires in 7 days
  "type": "access"
}
```

- Access token: 7 days
- Refresh token: 30 days
- Algorithm: HS256
- Secret: from `JWT_SECRET_KEY` env var

### Token Storage

| Platform | Storage | Security |
|----------|---------|----------|
| Web | `localStorage` | Accessible to JS (XSS risk, acceptable for guest tokens) |
| Mobile | `expo-secure-store` | Encrypted, hardware-backed on iOS |

---

## 12. Payment (Stripe)

### Flow: Ad-Free Pass ($2.99)

```
1. User clicks "Remove Ads" on /shop page
2. Frontend calls POST /api/v1/purchases/checkout/ad-free
3. Backend creates Stripe Checkout Session
4. Backend returns checkout URL
5. Frontend redirects to Stripe's hosted checkout page
6. User enters payment info on Stripe
7. Stripe processes payment
8. Stripe sends webhook to POST /api/v1/purchases/webhook/stripe
9. Backend verifies webhook signature
10. Backend sets player.ad_free = True
11. User redirected back to /shop?success=true
12. Frontend shows "Ad-free pass activated!"
13. useAdTiming hook checks getAdFreeStatus() → showAds = false
```

### StripeHandler (CORE_CANDIDATE)

```python
class StripeHandler:
    def create_checkout_session(price_id, customer_email, metadata, success_url, cancel_url)
    def verify_webhook(payload, sig_header)
```

Tagged `CORE_CANDIDATE` — this exact code can handle payments for any future product. Product-specific logic (what happens after payment) lives in the service layer, not here.

---

## 13. Ads (AdSense)

### Where Ads Appear

| Location | Type | When |
|----------|------|------|
| Lobby screen | Banner (bottom) | Always visible on lobby |
| Between matches | Interstitial (fullscreen) | After match ends, before next game |

### Ad-Free Logic

```typescript
// useAdTiming.ts
const { showAds } = useAdTiming();

// In page.tsx:
{showAds && <AdBanner />}
{showAds && <InterstitialAd />}
```

On mount, `useAdTiming` calls `getAdFreeStatus()` API. If player has `ad_free = true`, `showAds` is `false` and no ads render.

**Critical rule:** Ads NEVER appear during gameplay. Only on lobby and between matches. Interrupting gameplay would destroy the user experience.

---

## 14. Database & Migrations

### Schema

```
players
├── id (UUID, primary key)
├── guest_token (string, unique)
├── email (nullable)
├── password_hash (nullable)
├── display_name
├── wins, losses, draws
├── elo_rating (default 1000)
├── ranked_wins, ranked_losses
├── ad_free (boolean, default false)
├── created_at, last_active_at

matches
├── id (UUID)
├── player1_id → players.id
├── player2_id → players.id (nullable for AI)
├── match_type ("ai" | "pvp")
├── difficulty (nullable)
├── status ("in_progress" | "completed" | "abandoned")
├── winner ("p1" | "p2" | "draw" | null)
├── rounds_won_p1, rounds_won_p2

rounds
├── id (UUID)
├── match_id → matches.id
├── round_number
├── winner
├── total_turns

turns
├── id (UUID)
├── round_id → rounds.id
├── turn_number
├── p1_action, p2_action
├── p1_ki_before, p1_ki_after
├── p2_ki_before, p2_ki_after
├── outcome
```

### Alembic Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "add new column"

# Run all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1
```

The `alembic/env.py` reads `DATABASE_URL` from `app.config.settings`, so it automatically uses the right database. It uses async SQLAlchemy engine for PostgreSQL.

---

## 15. Deployment

### Architecture

```
┌─────────────┐     HTTPS      ┌──────────────┐
│   Browser    │ ──────────────→│   Vercel      │
│   (User)     │                │  (Next.js)    │
└──────┬──────┘                └──────┬───────┘
       │                              │
       │  API calls (HTTPS)           │ NEXT_PUBLIC_API_URL
       │                              │
       └──────────────────────────────┘
                    │
            ┌───────v────────┐
            │   Railway       │
            │  (FastAPI)      │
            ├────────────────┤
            │  PostgreSQL     │
            │  Redis          │
            └────────────────┘
```

### Railway (Backend)

**What Railway does:** Builds Docker image from `Dockerfile`, runs it, provides PostgreSQL and Redis as plugins.

**Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir "."
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

The CMD runs migrations first (`alembic upgrade head`), then starts the server. This means every deploy automatically applies any new database migrations.

**Environment variables on Railway:**
```
DATABASE_URL=postgresql+asyncpg://...    # MUST have +asyncpg
REDIS_URL=redis://...
JWT_SECRET_KEY=<random-64-chars>
CORS_ORIGINS=["https://your-app.vercel.app"]
DEBUG=false
```

### Vercel (Web Frontend)

**What Vercel does:** Builds Next.js app, deploys to CDN, handles routing.

**Configuration:**
- Root directory: `web` (because Next.js is in a subdirectory)
- Framework: auto-detected as Next.js
- Env var: `NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app`

### CORS (Connecting Them)

The backend must allow requests from the frontend domain. `CORS_ORIGINS` on Railway must include the Vercel URL:

```
CORS_ORIGINS=["https://ki-clash.vercel.app","http://localhost:3000"]
```

Without this, browsers block all API calls (you'll see OPTIONS 400 errors).

---

## 16. How to Run Locally

### Prerequisites
- Docker Desktop (for PostgreSQL + Redis)
- Python 3.11+
- Node.js 18+

### Step-by-Step

```bash
# 1. Start databases
docker compose up -d db redis

# 2. Run migrations
alembic upgrade head

# 3. Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. In another terminal, start frontend
cd web && npm run dev
```

Open http://localhost:3000 — you're playing.

### Testing PvP Locally

PvP needs 2 players. Open two browser windows:
1. Regular window → http://localhost:3000/pvp → Find Match
2. Incognito window → http://localhost:3000/pvp → Find Match

They'll match because incognito has separate localStorage = different guest accounts.

---

## 17. Troubleshooting & Lessons Learned

### Error: `ModuleNotFoundError: No module named 'stripe'`
**Cause:** Added `stripe` to `pyproject.toml` but forgot to run `pip install`.
**Fix:** `pip install stripe` or `pip install "."` to install all deps.
**Lesson:** Always install after adding dependencies. In Docker, the Dockerfile handles this.

### Error: Railway health check fails
**Cause:** Dockerfile had `COPY pyproject.toml .` then `RUN pip install "."` then `COPY . .` — the install ran BEFORE the source code was copied, so pip couldn't find the `app/` package.
**Fix:** Changed to `COPY . .` first, then `RUN pip install "."`.
**Lesson:** Docker layers execute in order. If a step needs files, those files must be `COPY`'d first.

### Error: OPTIONS /api/v1/auth/guest 400 Bad Request
**Cause:** CORS. The frontend (Vercel) is on a different domain than the backend (Railway). Browsers send an OPTIONS preflight request, and if the backend doesn't allow that origin, it returns 400.
**Fix:** Add the Vercel URL to `CORS_ORIGINS` env var on Railway.
**Lesson:** Always update CORS when deploying to a new domain.

### Error: Both fighters animate the same action
**Cause:** `BattleArena` had a single `action` prop applied to BOTH PixelFighters.
**Fix:** Split into `playerAction` and `aiAction` props. Each fighter gets its own action.
**Lesson:** When two independent things need different state, don't share a single variable.

### Error: Animations too fast to understand
**Cause:** Default timings were: windup 200ms, impact 300ms, recover 300ms (total 800ms). Too fast.
**Fix:** Increased to windup 600ms, impact 800ms, recover 600ms (total 2000ms). Also slowed card flip from 500ms to 800ms and outcome reveal from 900ms to 2100ms.
**Lesson:** Animations need to be readable. If the user can't tell what happened, the animation is pointless.

### Error: Energy wave beam invisible
**Cause:** Beam was 24×4 pixels (72×12px real) using box-shadow — tiny and barely visible.
**Fix:** Replaced with CSS gradient beam spanning 60% of arena width, with glow effects.
**Lesson:** Pixel art box-shadow technique doesn't scale for large effects. Use regular CSS for big visuals.

### Error: Docker Desktop won't connect
**Cause:** Docker daemon wasn't fully started. The socket file existed but wasn't accepting connections.
**Fix:** Fully quit Docker Desktop, relaunch, wait 30+ seconds for daemon to initialize.
**Lesson:** Docker Desktop is slow to start on macOS. Be patient.

### Error: PvP won't match two tabs
**Cause:** Both tabs share `localStorage` = same JWT token = same player. Matchmaking won't pair a player with themselves.
**Fix:** Use incognito window for second player (separate localStorage = separate guest account).
**Lesson:** Auth tokens are per-browser-profile, not per-tab.

### Error: Vercel won't deploy from org repo
**Cause:** GitHub org repos require Vercel Pro ($20/month) for deployment.
**Fix:** Created a personal repo (`DDaeseon/Ki-clash-public`), pushed code there, deployed from personal account on free Hobby plan.
**Lesson:** Vercel free tier only works with personal GitHub accounts, not organizations.

---

## 18. Interview Talking Points

### Architecture & Design Patterns

**"Tell me about the architecture of your project."**
> "It's a three-tier backend: API endpoints → services → core modules. The core layer is completely isolated — the game engine, AI opponent, and WebSocket manager have zero knowledge of the database or HTTP. This means I can unit test the game engine with pure inputs/outputs, and I can reuse the core modules in completely different products. I call it the 'factory mindset' — every module I build today becomes a building block for the next product."

**"Why did you separate the game engine from the service layer?"**
> "The game engine is a pure state machine — same input always produces the same output. The service layer handles I/O: saving to database, looking up player records, coordinating AI responses. By separating them, the engine is testable without mocking, reusable across AI and PvP modes, and portable to any frontend. This is the Deterministic Backbone principle — if it can be deterministic, keep it deterministic."

**"How does real-time multiplayer work?"**
> "Two WebSocket connections per PvP game. First, a matchmaking WebSocket where players join a Redis-backed FIFO queue. A background task polls every 500ms, pairs the first two players, and notifies both via WebSocket. Then both connect to a game WebSocket where they submit actions. The server waits for both submissions before resolving the turn and broadcasting results. The WSManager uses an Observer pattern — rooms are subjects, connected players are observers. It supports personalized messages per player, which is critical for hiding actions until both submit."

### Frontend & Animations

**"How did you build the pixel art system?"**
> "Each character is a 12×16 grid of hex colors. I convert this grid into CSS box-shadow values — each pixel becomes one shadow offset. So one tiny div renders the entire sprite. Animations are pure CSS transforms on the wrapper: translate for movement, scale for size changes, rotate for dynamic poses. Different easing per phase — overshoot cubic-bezier for windup anticipation, snap-fast for impact, smooth ease-out for recovery. No canvas, no sprite sheets, no game engine library."

**"How do you manage state in the frontend?"**
> "Custom hooks as state machines. The useGame hook manages the entire game lifecycle as a phase enum: lobby → character_select → playing → revealing → round_end → match_end. Each phase renders completely different UI via conditional rendering. No Redux, no Context needed — the game is a single component tree where one phase variable controls everything. For PvP, usePvP adds WebSocket management on top of the same pattern."

### Backend & Database

**"How does the ELO system work?"**
> "Standard ELO with K-factor 32. Expected score = 1 / (1 + 10^((opponent_elo - your_elo) / 400)). Winner gains K × (1 - expected), loser loses K × expected. So beating a higher-rated player gives more points than beating a lower-rated one. Floor of 100 so ratings never go negative. Leaderboard is a simple ORDER BY elo_rating DESC query."

**"How did you handle payments?"**
> "Stripe Checkout Sessions. The backend creates a session with the price ID and success/cancel URLs, returns the checkout URL to the frontend. After payment, Stripe sends a webhook to our endpoint. We verify the webhook signature to prevent fraud, then set the player's ad_free flag to true. The Stripe handler is a CORE_CANDIDATE module — zero game-specific code, reusable across products."

### Deployment & DevOps

**"Walk me through your deployment pipeline."**
> "Railway builds from the Dockerfile, which copies source → installs dependencies → runs Alembic migrations → starts uvicorn. Vercel auto-detects Next.js from the web/ subdirectory. CORS connects them — the backend must explicitly allow the Vercel domain. Every git push to main triggers auto-deploy on both platforms."

**"What was the hardest bug you encountered?"**
> "The Dockerfile had the steps in the wrong order — it ran pip install before copying the source code. The build appeared to succeed because Docker cached the layer, but the app package wasn't actually installed. The health check failed with no useful error. I had to reason about Docker layer ordering to realize COPY must come before RUN pip install."

### Product & Business

**"Why this game?"**
> "It taps into a universal human instinct — competitive prediction. The same dopamine loop as rock-paper-scissors or poker: 'I KNEW you were going to charge.' Ki economy adds strategic depth beyond pure guessing. It's also culturally rooted — every Korean kid played 기싸움 in school. The business model is freemium: ads between matches (never during gameplay), optional $2.99 ad-free pass."

**"How would you scale this?"**
> "Currently single-server with in-memory game state. First bottleneck would be the in-memory cache — move game states to Redis for multi-server support. The WSManager already uses a room abstraction that could be backed by Redis pub/sub instead of in-memory dicts. Database is already async PostgreSQL which handles thousands of concurrent connections. The matchmaking queue is already in Redis, so that's ready. For massive scale, I'd add a load balancer and horizontal scaling on Railway or migrate to AWS ECS."
