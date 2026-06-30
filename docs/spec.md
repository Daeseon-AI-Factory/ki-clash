# Ki Clash (기싸움) — Product Specification

## Product Overview

Ki Clash is a real-time 1v1 strategy game based on the Korean schoolyard hand game "기싸움" (Korean ki duel). Players simultaneously choose actions each turn — charging ki, blocking, attacking, or using special moves — creating a tense mind-game of prediction and resource management. Available on web and mobile with AI opponents and online PvP matchmaking.

## Target Instinct

**Competitive prediction** — the primal satisfaction of reading your opponent's mind. Same dopamine loop as rock-paper-scissors, but with the strategic depth of resource management (ki economy). "I *knew* you were going to charge."

## Revenue Model

**Free with ads:**
- Interstitial ads between matches (not during gameplay — never interrupt the flow)
- Rewarded video ads: watch ad → get cosmetic reward or rematch without waiting
- Banner ad on lobby/menu screens only
- Ad provider: Google AdMob (mobile), Google AdSense (web)
- Future upgrade path: ad-free pass ($2.99), cosmetic shop (card skins, effects)

---

## Game Rules (Canonical)

### Turn Structure
Each turn, both players simultaneously select one action. A 3-second countdown plays (with beat rhythm: slap-clap-slap-REVEAL), then both actions are revealed simultaneously.

### Actions

| Action | Name (KR) | Ki Cost | Ki Gain | Description |
|---|---|---|---|---|
| **Charge** | 기 모으기 | 0 | +1 | Accumulate ki. Vulnerable to all attacks. |
| **Block** | 막기 | 0 | 0 | Blocks Attack (파). Fails against Ki Burst. |
| **Attack** | 파 | 1 | 0 | Basic attack. Hits Charge. Blocked by Block. Dodged by Teleport. |
| **Ki Burst** | 기폭 | 3 | 0 | Pierces Block. Hits Charge. Dodged by Teleport. |
| **Teleport** | 순간이동 | 1 | 0 | Dodges Attack and Ki Burst. Wastes ki vs Charge/Block. |

### Outcome Matrix

| Attacker → / Defender ↓ | Charge | Block | Attack | Ki Burst | Teleport |
|---|---|---|---|---|---|
| **Charge** | Draw | Draw | **DEF WINS** | **DEF WINS** | Draw |
| **Block** | Draw | Draw | **ATK WINS** (blocked) | **DEF WINS** | Draw |
| **Attack** | **ATK WINS** | **DEF WINS** (blocked) | Clash (both -1 ki) | **DEF WINS** | **DEF WINS** (dodged) |
| **Ki Burst** | **ATK WINS** | **ATK WINS** (pierced) | **ATK WINS** | Clash (both -3 ki) | **DEF WINS** (dodged) |
| **Teleport** | Draw | Draw | **ATK WINS** (dodged) | **ATK WINS** (dodged) | Draw |

**Correction on matrix reading:** Each cell = "Row player vs Column player". Result is from Row player's perspective.

Simplified outcome logic:
- **Attack vs Charge** → Attacker wins the round
- **Attack vs Block** → Attack is blocked, no one wins, attacker loses 1 ki
- **Attack vs Attack** → Clash, both lose 1 ki, no winner
- **Attack vs Teleport** → Attack is dodged, attacker loses 1 ki
- **Ki Burst vs Charge** → Ki Burst wins the round
- **Ki Burst vs Block** → Ki Burst pierces, wins the round
- **Ki Burst vs Attack** → Ki Burst wins the round
- **Ki Burst vs Teleport** → Ki Burst is dodged, attacker loses 3 ki
- **Ki Burst vs Ki Burst** → Clash, both lose 3 ki, no winner
- **All other combinations** → No winner, game continues (ki costs still apply)

### Match Format
- **Best of 3 rounds**
- Each round: both players start with 0 ki
- A round ends when one player successfully lands an unblocked/undodged attack while the opponent is vulnerable (Charging)
- If both players reach 20 turns in a round with no winner → the player with more ki wins the round. If tied → sudden death (next successful hit wins).
- Match winner = first to win 2 rounds

### Constraints
- Players cannot use actions they can't afford (no Attack with 0 ki)
- Maximum ki cap: 10 (prevents infinite hoarding)
- Turn time limit: 5 seconds (auto-selects Charge if no input)

---

## Core Features (MVP)

### P0 — Must Have for Launch

1. **Game Engine** — Turn resolution logic implementing the full outcome matrix
2. **vs AI Mode** — Play against AI opponents with 3 difficulty levels:
   - Easy: random with slight bias toward Charge
   - Medium: pattern-based (reacts to player's last 3 moves)
   - Hard: game-theory optimal mixed strategy with adaptation
3. **Online PvP** — Real-time 1v1 matchmaking via WebSocket
   - Matchmaking queue (simple FIFO for MVP, no skill-based)
   - Simultaneous action reveal
   - Disconnect handling (auto-forfeit after 30s)
4. **Card-Style UI** — 5 action cards, tap to select, countdown + simultaneous flip reveal
5. **Turn Rhythm** — 3-beat countdown animation with sound (slap-clap-REVEAL)
6. **Match HUD** — Ki meters for both players, round score (0-0, 1-0, etc.), turn history
7. **Ad Integration** — Interstitial between matches, banner on lobby
8. **Cross-Platform** — Web (Next.js) + Mobile (React Native) sharing same backend

### P1 — Post-MVP

9. **Ranked Mode** — ELO-based matchmaking and leaderboard
10. **Cosmetics Shop** — Card skins, reveal effects, countdown sounds
11. **Ad-Free Pass** — $2.99 one-time purchase to remove ads
12. **Match History** — Review past matches turn by turn
13. **Friend System** — Challenge friends by share link
14. **Spectate Mode** — Watch live matches

### P2 — Future

15. **Tournament Mode** — 8/16 player brackets
16. **Seasonal Rewards** — Monthly ranked rewards
17. **3+ Player Mode** — Target selection adds complexity

---

## User Stories

### Onboarding
- As a new player, I want a quick interactive tutorial (3 practice rounds vs AI) so that I learn the 5 actions without reading a manual.
- As a new player, I want to play vs AI immediately without creating an account so that I can try the game with zero friction.

### vs AI
- As a player, I want to choose AI difficulty so that I can practice at my level.
- As a player, I want to see the AI's "thinking" indicator during countdown so that it feels like a real opponent.

### Online PvP
- As a player, I want to tap "Find Match" and be paired with an opponent within 10 seconds so that I'm not waiting.
- As a player, I want both actions revealed simultaneously so that neither player has an advantage.
- As a player, I want to see my opponent's ki count so that I can make strategic decisions.
- As a player, I want the game to handle disconnects gracefully (opponent gets 30s to reconnect, then I win) so that I'm not stuck.

### Gameplay
- As a player, I want a rhythmic countdown before each turn so that the game has tension and flow.
- As a player, I want action cards to show whether I can afford them (dim if not enough ki) so that I don't waste time.
- As a player, I want to see a turn history so that I can read my opponent's patterns.
- As a player, I want a dramatic reveal animation when both cards flip so that the moment feels exciting.

### Monetization
- As a player, I want ads to only appear between matches (never during) so that gameplay isn't interrupted.
- As a player, I want to watch a rewarded ad for a small bonus (e.g., extra AI difficulty unlock) so that ads feel optional and fair.

---

## API Endpoints

### Auth
| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/guest` | Create guest session (auto on first visit) | No |
| POST | `/api/v1/auth/register` | Register with email (optional upgrade from guest) | No |
| POST | `/api/v1/auth/login` | Login | No |
| POST | `/api/v1/auth/refresh` | Refresh JWT token | Yes |

### Game
| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/v1/games/ai` | Start new AI game (body: difficulty) | Yes |
| GET | `/api/v1/games/{game_id}` | Get game state | Yes |
| POST | `/api/v1/games/{game_id}/action` | Submit turn action | Yes |

### Matchmaking (PvP)
| Method | Path | Description | Auth |
|---|---|---|---|
| WebSocket | `/api/v1/ws/matchmaking` | Join matchmaking queue | Yes |
| WebSocket | `/api/v1/ws/game/{game_id}` | Real-time game connection | Yes |

### Player
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/players/me` | Get player profile & stats | Yes |
| GET | `/api/v1/players/me/matches` | Get match history | Yes |

---

## Tech Stack (Overrides from CLAUDE.md defaults)

| Layer | Choice | Reason |
|---|---|---|
| Backend | Python 3.11+ / FastAPI | Default ✓ |
| Frontend Web | Next.js 14+ (TypeScript) | Default ✓ |
| Frontend Mobile | React Native (Expo) | Mobile + web simultaneously |
| Database | PostgreSQL (SQLAlchemy 2.0 async) | Default ✓ |
| Cache / PubSub | Redis | Matchmaking queue + game state pub/sub |
| WebSocket | FastAPI WebSocket + Redis pub/sub | Real-time PvP |
| Auth | JWT (guest-first, optional registration) | Simplified from default — guest accounts reduce friction |
| Ads | Google AdMob (mobile) / AdSense (web) | Standard for free games |
| Deploy | Railway (backend + Redis), Vercel (web) | Default ✓ |
| AI Opponent | Deterministic algorithms (no LLM needed) | Game AI is pure code, no LLM calls |

**Note:** No LLM/AI integration needed. The "AI opponent" is deterministic game-theory logic, not an LLM. This aligns with the Deterministic Backbone principle — game logic is pure code.

---

## Non-Functional Requirements

- **Turn resolution latency:** < 200ms (server-side)
- **Matchmaking time:** < 10s average (with fallback to AI if no match found in 30s)
- **Simultaneous reveal:** Actions must not be visible to opponent until both submitted (server holds both, reveals together)
- **Concurrent matches:** Support 100 simultaneous games for MVP
- **Mobile performance:** 60fps animations on 3-year-old devices
