<div align="center">

# Ki Clash · 기싸움

**실시간 1v1 기싸움 게임 — 상대의 수를 읽고, 기를 모으고, 결정타를 친다**

<sub>FastAPI + **두 개 병렬 런타임** (Python + Go) 가 같은 Redis 상태 공유 · Next.js 16 PWA · Tekken식 4-letter 코드 룸 PvP · 6 캐릭터 시그니처 필살기 · AI 스프라이트 파이프라인</sub>

[**🌐 라이브 프런트엔드 → kiclash.daeseon.ai**](https://kiclash.daeseon.ai) · [GitHub](https://github.com/Daeseon-AI-Factory/ki-clash)

[English](./README.md) · **한국어**

</div>

---

> **요약.** 한국 학교에서 하는 "기싸움"을 실시간 1v1 PvP로 재해석한 게임. **백엔드가 두 런타임으로 같은 Redis 게임 상태를 공유함** — Python (auth / matchmaking / 룸 / REST + WebSocket) 이 현재 권한자고, Go WebSocket 게이트웨이 (게임 루프 풀 포팅 + E2E 검증 완료) 는 Caddy 라우트 한 줄로 hot path 인계 받을 준비 완료. **Tekken식 룸 PvP**: 호스트가 룸 생성 → 4-letter 코드 → 친구 조인 → 양쪽 캐릭터 선택 → ready → 게임 시작. 매치 끝 시네마틱은 **6명 캐릭터별 시그니처 필살기**로 분기 (윈드 보텍스 / 루나 슬래시 / 솔라 플레어 / 아이스 셰터 / 메테오 / 핑크 크리스털 폭풍). 6명 캐릭터 스프라이트는 모두 진짜 PNG — **Pollinations/flux → rembg 투명 BG → image-first fallback chain** 파이프라인으로 생성 (총 36장: 6 캐릭 × 6 포즈).

## 목차

- [Ki Clash 가 뭔가](#ki-clash-가-뭔가)
- [왜 이 프로젝트인가](#왜-이-프로젝트인가)
- [제품 워크스루](#제품-워크스루)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [멀티플레이어 정확성](#멀티플레이어-정확성)
- [게임 엔진 & API](#게임-엔진--api)
- [로컬 실행](#로컬-실행)
- [배포](#배포)
- [엔지니어링 로그](#엔지니어링-로그)
- [정직한 한계](#정직한-한계)
- [프로젝트 구조](#프로젝트-구조)

---

## Ki Clash 가 뭔가

*Ki Clash (기싸움)* 은 한국에서 자란 사람이면 다 아는 그 손바닥 게임의 아케이드 버전이다 — 양쪽이 동시에 기 **모으기**, **막기**, **때리기**, **에네르기파**, **순간이동** 중 하나 선택. 동시에 공개되고 outcome matrix 가 누가 맞았는지 / 누가 기를 모았는지 / 누가 빗나갔는지 결정. 먼저 **3판 중 2판 승리** 한 쪽이 매치 승.

플레이 방식 2가지:

1. **Quick Match** — 로비에서 자동 매칭, 다음 들어온 사람과 페어링.
2. **Create / Join Room** — 호스트 4-letter 코드 받아서 (Slack / iMessage / 구두로) 공유, 친구 조인, 양쪽 캐릭터 선택, ready, 게임 시작. "인터뷰어가 30초만에 같이 플레이" 경로.

6명 캐릭터, 매치 마지막 결정타에 캐릭터별 시그니처 필살기 발동.

---

## 왜 이 프로젝트인가

> *바쁜 리뷰어용 — 이 repo 가 실제로 보여주는 엔지니어링.*

- **🔀 병렬 서버 런타임 2개, 공유 진실 1개.** Python 과 Go 가 같은 Redis JSON blob (`ki_clash:game:{id}`) 을 read/write. 어느 쪽이든 WebSocket 연결 서빙 가능; 표준 패턴 (load → `WATCH`/`MULTI`/`EXEC` 클로저 내 mutate → per-player Redis 채널 publish) 이 런타임 간 byte-for-byte 포팅. **E2E 검증됨**: Python REST 엔드포인트로 룸 생성, 양쪽 플레이어가 Go WebSocket 으로 접속, 양쪽 `charge` 제출, 양쪽 정확히 personalize 된 `turn_result` envelope + 올바른 ki accounting 수신 (`go-server/test_e2e.py` 통과).
- **🛡️ 분산 상태 강화 + 버그 문서화.** in-process 시뮬레이터가 발견한 PvP-concurrency 버그 4개 수정 (첫 접속에 spurious `opponent_reconnected`, `start()` 가 두 곳에서 호출되어 중복 `waiting_for_action`, message ordering, `action_confirmed` 의 `turn_number` 누락). 4개 다 [`docs/troubleshooting.md`](./docs/troubleshooting.md) 에 symptom / cause / commit 해시 와 함께 기록, Python 통합 테스트 (`tests/integration/test_pvp_flow.py::TestPhase3Regressions`) 가 재발 방지.
- **🧠 15개 작성된 디자인 결정.** 엔지니어링 로그의 `## Engineering Decision Reference` 가 DR-1 ~ DR-15 — 각 100-300 줄 entry: 백엔드 언어 (Python vs Spring vs Go), 시각 미학, 자산 파이프라인 모양, JWT 복구 전략, `xfail` 정책, 테스트에 real Redis vs fakeredis, stateless workers + Redis-as-truth, per-player pub/sub topology, turn submission 동시성 제어 등.
- **🎨 저작권 + 투명도 리뷰 통과한 AI 스프라이트 파이프라인.** 36개 fighter PNG (6 캐릭 × 6 포즈: idle / windup / impact / hit / ko / victory), 다 캐릭터별 prompt 로 **Pollinations/flux** 생성 → 흰 배경 제거를 위해 **rembg (U2Net)** 으로 재처리. 컴포넌트가 포즈별 PNG 선택; 포즈-specific PNG 가 로드되면 CSS "puppet" rotation transform 이 미세한 scale-only 로 줄어들어서 `ko.png` (이미 누워있음) 가 이중 회전 안 됨. 특정 라이선스 캐릭터에 너무 가깝게 나온 스프라이트 1회 재생성 통과.
- **🎬 6개 캐릭터별 시그니처 필살기.** 공유 카메하메하 빔 하나 아니고, 각 fighter 가 자기 multi-phase finisher 받음 (번개 동반 윈드 보텍스, void 포털 루나 이클립스 슬래시, multi-beam solar flare, frozen-block + shard explosion ice shatter, magma cracks 동반 meteor bombardment, 하트 폭발 pink crystal storm). 각 finisher 는 dispatched motion-design 컴포넌트, FinalBlowStage 의 charge → fire → hit → fly → land 페이즈 머신 후킹.
- **🧱 ~3.5개월 / 93 commits 빌드, 로그가 증명.** 공개 추론 트레일 (`docs/engineering-log.md`, 2,136 줄; `docs/troubleshooting.md` 문제 인덱스) — 모든 non-trivial 선택에 대체안 / 받아들인 트레이드오프 / 이후 재사용된 패턴 명시.

---

## 제품 워크스루

| 흐름 | 동작 |
|---|---|
| **로비** | 3 카드: **Quick Match** · **Create Room** · **Join Room** (inline 4-letter 코드 입력). |
| **Quick Match** | 글로벌 Redis matchmaking 큐 조인. FIFO 페어링 — 다음 조인하는 사람과 매칭. |
| **Create Room** | `POST /api/v1/rooms` 가 4-letter 코드 발행 (32자 알파벳, 모호한 글자 제외 — `1`/`I`/`L`/`0`/`O`). 호스트가 코드 + copy 버튼 보임. |
| **Join Room** | 게스트가 코드 입력, `POST /api/v1/rooms/{code}/join` 으로 페어링. 양쪽이 서로 보임. |
| **선택 + ready** | 양쪽 6명 중 캐릭 선택 (`PUT /rooms/{code}/character`), ready 토글 (`PUT /rooms/{code}/ready`). 양쪽 ready 되면 룸 자동 게임 생성 (`POST /rooms/{code}/start`, idempotent — 어느 client 든 호출 가능). |
| **게임플레이** | 매 턴: 줄어드는 바 위 5초 카운트다운, 5개 액션 중 선택 (Charge / Block / Attack / Energy Wave / Teleport). 타임아웃 시 `charge` 자동 제출. 양쪽 액션 들어오면 서버 resolve, personalized turn results 브로드캐스트. |
| **라운드 종료** | 라운드 승자 표시, 4.5초 후 자동 진행. |
| **매치 종료** | 캐릭터별 finale: charge → fire → hit (RGB chromatic split, 3-wave confetti, max screen-shake) → fly (loser 따라 debris 무리) → land (impact crater) → vignette → "VICTORY / DEFEAT / DRAW" 텍스트 슬램 → stats 패널 슬라이드 업 + **Play Again**. |

싱글플레이 흐름은 같은 게임 엔진을 deterministic AI (`app/core/ai_opponent/`) 상대로 — 3 난이도 (easy: 랜덤 + charge 편향 · medium: 최근 너 액션 패턴 매칭 · hard: 게임 이론 mixed strategy).

---

## 기술 스택

| 레이어 | 선택 |
|---|---|
| **Platform server** | Python 3.11 / FastAPI (async) — auth, matchmaking, rooms, profile, REST, *현재 권한자* WebSocket. 61개 파일에 5,313 LOC. |
| **Game server** | Go 1.23 / gorilla/websocket — PvP 게임 루프 풀 포팅 (engine + session + Redis WATCH/MULTI/EXEC + per-player pub/sub + heartbeats). 10개 파일에 2,018 LOC. Python과 같은 JWT secret; 같은 Redis namespace. 프로덕션 compose 의 독립 Docker 서비스. |
| **Database** | PostgreSQL 16 + SQLAlchemy 2.0 async — users, matches, ranked Elo, purchases. |
| **State store** | Redis 7 — game session JSON (`ki_clash:game:{id}` 1시간 TTL), matchmaking queue (sorted set), per-player pub/sub channels (`ki_clash:player:{id}`), 룸 (`ki_clash:room:{code}`), rate-limit counters. |
| **Auth** | JWT (HS256), guest-first 발행: 플레이어는 이메일 없이 시작 가능; 나중에 옵션으로 업그레이드. 프런트는 stale token 자동 복구 (401 → guest 재발행 → 1회 재시도). |
| **결제** | Stripe Checkout (ad-free 패스 — 웹훅 핸들러 스캐폴드, live 키는 env 로). |
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 · 조연출용 `framer-motion` · 임팩트 버스트용 `canvas-confetti` · `lottie-react` (설치만 — 현재 FX는 in-house). 46개 파일에 10,053 LOC. |
| **AI opponent** | Pure-Python deterministic 전략 — 게임플레이 경로에 LLM 없음 (CLAUDE.md "Deterministic Backbone" 규칙). |
| **스프라이트 파이프라인** | Pollinations/flux text-to-image · `rembg` (U2Net) background removal · 3단 fallback (`<pose>.png` → `idle.png` → procedural SVG chibi). `web/public/fighters/` 에 36개 PNG. |
| **Reverse proxy** | Caddy 2 — automatic Let's Encrypt SSL, env-driven `API_DOMAIN`, WebSocket upgrade 자동 처리. `/api/v1/ws/game/*` 는 Go 서비스로, 나머지는 Python으로 라우팅. |
| **Observability** | 양쪽 런타임에 structured JSON logging (stdlib), Prometheus `/metrics`, 옵션 Sentry (`SENTRY_DSN` opt-in). |
| **테스트** | 8개 `tests/` 모듈에 Python test function 112개 (engine, game-store, matchmaking service, AI opponent, ws-manager pub/sub, logging, observability, integration PvP flow). `go-server/engine_test.go` 에 Go 단위 테스트 13개. |

---

## 아키텍처

**한 매치, 두 런타임, 하나의 Redis.** Hot-path WebSocket 게임플레이가 Python 또는 Go 둘 다로 클라이언트가 알아채지 못하게 서빙 가능 — 양쪽이 같은 JSON envelope, 같은 Redis 키, 같은 JWT secret 사용. Caddy 가 단일 스위치.

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
                              │   그 외 전부         →  api:8000    │  ← Python
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
                       Postgres │     │ Redis ───────┘ (공유 진실)
                       (users,  │     │   ki_clash:game:{id}    JSON 세션
                       matches) │     │   ki_clash:room:{code}  4-letter 룸
                                │     │   ki_clash:matchmaking:queue  ZSET
                                │     │   ki_clash:player:{id}  pub/sub 채널
```

**핵심 결정** (`docs/engineering-log.md` Part 2 DR-N 별 풀 reasoning):

- **Stateless workers, Redis-as-truth (DR-15).** 게임 상태는 Redis 에만. 어느 런타임의 어느 worker든 JSON blob 로드해서 게임 WebSocket 서빙 가능; 프로세스 메모리에는 WebSocket 연결 자체 외에 아무것도 안 들고 있음. 이게 Python + Go 동거를 안전하게 만드는 핵심.
- **Pessimistic lock 아니고 Optimistic concurrency (DR-14).** 두 플레이어가 같은 ms 안에 액션 제출하면 Redis `WATCH` / `MULTI` / `EXEC` + 3-retry budget 으로 처리. Python (`watch_and_update`) 과 Go (`Store.watchAndUpdate`) 같은 패턴. 현재 스케일에서 single-digit per-day contention; Lua 스크립트는 future work (`go-server/submit_action.lua` PoC 존재 — Redis `cjson` 이 Python Pydantic 과 빈 배열 round-trip 깨서 deferred, inline 문서화).
- **Per-player pub/sub channels (DR-13).** 서버가 플레이어에게 push 보내야 할 때 — 로컬 WebSocket 보유 중이면 직접; 아니면 `ki_clash:player:{id}` 에 `PUBLISH` → 연결 보유 인스턴스가 relay. 이게 cross-runtime push 를 정확하게: Python 이 Go-served 플레이어에게 push 가능, 반대도 가능.
- **Two-envelope action submission, atomic resolution.** 서버가 양쪽 액션 둘 다 들어올 때까지 보유, 그 다음 single atomic write 로 턴 resolve. Phase 3 의 4개 PvP-concurrency 버그 (`docs/troubleshooting.md`) 닫음.
- **Lazy / conditional integration (DR-9).** Sentry, Prometheus, Stripe — 모든 외부 통합이 env var 없으면 no-op. 로컬 dev 에 0 계정 필요.

---

## 멀티플레이어 정확성

1v1 턴제 PvP 게임을 어렵게 만드는 5가지 구체적인 사항, 이 repo 가 처리하는 방식.

| 우려사항 | 구현 |
|---|---|
| **동시 액션** | Two-envelope 패턴. 서버가 `p1_action` / `p2_action` 따로 저장하고 둘 다 있을 때만 `resolveTurn`. atomic Redis update 가 두 번째 제출의 **저장**과 둘 다의 **클리어**를 같은 `EXEC` 안에서 — 한쪽이 set 됐는데 다른 worker 가 stale 데이터 읽는 window 없음. |
| **같은 ms 동시 제출** | `WATCH` / `MULTI` / `EXEC` + 3-retry budget. in-process PvP 시뮬레이터 (`scripts/pvp_simulator.py`) + `tests/services/test_matchmaking_service.py` 매치메이킹 서비스 테스트로 검증. |
| **Client-server 메시지 ordering** | `action_confirmed` envelope 가 적용되는 명시적 `turn_number` 캐리, 클라이언트는 자기 제출 correlate (도착 순서 의존 X). (Phase 3 Bug 4 — 턴 5의 stale `action_confirmed` 가 이미 in-flight 인 턴 6 제출 확인으로 잘못 해석될 수 있었음.) |
| **Disconnect / reconnect** | 끊긴 플레이어별로 30초 forfeit 타이머 동작. fire 시 **Redis 재읽기** — `connected_players` 에서 window 안에 어느 worker (Go 또는 Python) 든 reconnect 가 보이면 forfeit 은 no-op. 양쪽 런타임이 같은 set 업데이트. |
| **First-connect vs reconnect** | 단일 `handle_connect(game_id, player_id)` 가 atomic update 안에서 결정: 플레이어 id 가 이미 `connected_players` 에 있으면 reconnect (opponent 알림 + state 재송신); 아니면 add 하고 silent 진행. WebSocket 엔드포인트의 이전 if/else 가 첫 접속에 `opponent_reconnected` 잘못 발사하던 거 (Phase 3 Bug 1) 대체. |

전체 타임라인 + 이 버그들을 surface 한 시뮬레이터 출력은 `docs/engineering-log.md` Phase 3 섹션.

---

## 게임 엔진 & API

**게임 규칙** (`app/core/game_engine/types.py`):

| 상수 | 값 |
|---|---|
| `KI_CAP` | 10 (라운드당 ki 상한) |
| `TURN_LIMIT` | 20 (어느 쪽도 결정타 안 내면 라운드 종료) |
| `ROUNDS_TO_WIN` | 2 (3판 2선승) |
| `TURN_TIME_LIMIT_SECONDS` | 5 (타임아웃 시 `charge` 자동 제출) |

**Outcome matrix** (`app/core/game_engine/outcome_matrix.py`): 손으로 튜닝한 5×5 테이블 `(p1_action, p2_action) → outcome`. 예: `Attack ⨯ Charge → P1 라운드 승` (charge 읽음); `Energy Wave ⨯ Block → P1 라운드 승` (energy wave 가 block 관통); `Energy Wave ⨯ Teleport → dodged`; `Attack ⨯ Attack → clash` (양쪽 ki 잃음). 매트릭스는 `tests/core/test_game_engine.py` 와 `go-server/engine_test.go` 에서 셀별 테스트 — 양쪽 런타임이 동일하게 resolve.

**API surface** (`app/api/v1/`) — 7개 라우터에 23 엔드포인트:

```
Auth          POST  /api/v1/auth/guest                 guest JWT 발행
              POST  /api/v1/auth/upgrade               guest 에 이메일/이름 첨부
              POST  /api/v1/auth/refresh

Players       GET   /api/v1/players/me                 profile + 통계
              GET   /api/v1/players/me/matches         매치 히스토리

Games (vs AI) POST  /api/v1/games/ai                   AI 매치 시작
              GET   /api/v1/games/{id}
              POST  /api/v1/games/{id}/action          액션 제출

Rooms (PvP)   POST  /api/v1/rooms                      생성 — 4-letter 코드 반환
              GET   /api/v1/rooms/{code}               state 폴링 (멤버 게이트)
              POST  /api/v1/rooms/{code}/join
              PUT   /api/v1/rooms/{code}/character
              PUT   /api/v1/rooms/{code}/ready
              POST  /api/v1/rooms/{code}/start         idempotent, 게임 spawn
              POST  /api/v1/rooms/{code}/leave

Ranked        GET   /api/v1/ranked/leaderboard
              GET   /api/v1/ranked/me

Purchases     POST  /api/v1/purchases/checkout/ad-free Stripe Checkout 세션
              GET   /api/v1/purchases/ad-free-status
              POST  /api/v1/purchases/webhook          Stripe 웹훅 (서명 검증)

WebSocket     /api/v1/ws/matchmaking?token=...         quick-match 큐 조인
              /api/v1/ws/game/{game_id}?token=...      게임플레이 채널

Ops           GET   /health
              GET   /metrics                            Prometheus exposition
```

---

## 로컬 실행

**로컬 dev 는 외부 계정 0개 필요** — Stripe X, Sentry X, AWS X, 도메인 X. Docker Compose 가 스택 띄움; 나머지는 graceful no-op.

```bash
# Repo + 백엔드
git clone https://github.com/Daeseon-AI-Factory/ki-clash.git
cd ki-clash
docker compose up -d              # Postgres + Redis + Python API on :8000
docker compose exec api alembic upgrade head

# 프런트
cd web
npm install
npm run dev                       # http://localhost:3000

# 검증
curl http://localhost:8000/health    # → {"status":"ok"}
open http://localhost:3000           # AI 매치 플레이
```

**PvP 로컬 시도**: 두 브라우저 열어 (하나 일반, 하나 incognito) → 둘 다 `/pvp` → 하나가 **Create Room** 탭 + 4-letter 코드 복사 → 다른 쪽 **Join Room** 탭 + 코드 입력 → 양쪽 캐릭 선택 → 양쪽 ready → 매치 시작.

**Go 게임 서버 시도 (옵션)** — `:8001` 에서 같은 Redis 공유:

```bash
brew services stop redis             # host 에 6379 듣고 있는 Redis 있으면
cd go-server
JWT_SECRET_KEY=$(cd .. && docker compose exec -T api python -c \
  "from app.config import settings; print(settings.jwt_secret_key)") \
go run .

curl http://localhost:8001/health    # → {"status":"ok","server":"go"}
python3 test_e2e.py                  # Go 상대 풀 게임 루프 smoke test
```

**테스트 실행:**

```bash
docker compose exec api python -m pytest        # Python test function 112개, 8 파일
cd go-server && go test ./...                   # Go test function 13개
```

---

## 배포

하이브리드 플랜 확정: **Vercel (프런트) + AWS EC2 free-tier t3.micro (백엔드)** + `daeseon.ai` 레지스트라 DNS.

**작성 시점 라이브:**

| 서비스 | 상태 |
|---|---|
| `https://kiclash.daeseon.ai` (Vercel — Next.js 프런트) | ✅ 라이브 |
| `https://api.kiclash.daeseon.ai` (EC2 — Python + Go + Postgres + Redis + Caddy via `docker-compose.prod.yml`) | ⏳ 스캐폴드 완성, 아직 미프로비전 |

풀 단계별 (security group, Elastic IP, DNS A/CNAME 레코드, `openssl rand` secret 생성, `docker compose up -d --build`, Caddy 자동 Let's Encrypt cert 발급) 은 [`deploy/aws-ec2/QUICKSTART.md`](./deploy/aws-ec2/QUICKSTART.md), 긴 형식 동반 문서 [`deploy/aws-ec2/README.md`](./deploy/aws-ec2/README.md).

> **Vercel 모노레포 노트.** 이 repo 는 Next.js 프로젝트가 `web/` 에 있는 polyrepo (repo 루트는 Python 백엔드 + Go 서버 + docs). Vercel 대시보드에서 **Settings → General → Root Directory → `web`** 설정해야 빌드가 올바른 위치에서 실행됨.

프로덕션 스택 (단일 인스턴스, free tier 에서 ~100 동시 매치, DR-15 statelessness 로 horizontal scale 필요 시):

```
EC2 t3.micro (Ubuntu 24.04)
└── docker-compose.prod.yml
    ├── caddy   (80/443 — Let's Encrypt auto-SSL, reverse proxy)
    ├── api     (Python FastAPI, 2 uvicorn workers)
    ├── game    (Go WebSocket gateway)
    ├── db      (Postgres 16 — pgdata 볼륨)
    └── redis   (Redis 7 — AOF persistence)
```

---

## 엔지니어링 로그

이 repo 는 disciplined **anti-fabrication** 작성 파일들 보유. 인용된 모든 commit 해시는 진짜; 트러블슈팅 docs 의 모든 "Symptom" 은 literally 관찰된 메시지; Decision Reference 의 모든 entry 가 고려되고 거절된 대안 명시.

- [`docs/engineering-log.md`](./docs/engineering-log.md) — 2,136 줄. **Part 0** 가 "RESUME HERE" 현재 상태 스냅샷; **Part 1** 은 연대순 빌드 스토리 (Phase 1 → 11); **Part 2** 가 *Engineering Decision Reference* — DR-1 (백엔드 언어) ~ DR-15 (stateless workers + Redis-as-truth) — 각 entry 가 100-300 줄 트레이드오프 분석 + 대안 + 거절된 경로 + 재사용 가능 meta-pattern.
- [`docs/troubleshooting.md`](./docs/troubleshooting.md) — 문제 인덱스 reference. Entry 별 format: **Symptom / Cause / Fix / Commit / Pattern**. PvP 버그 1-4, JWT 401 stale-token loop, Pollinations rate-limit 충돌, Lua `cjson` empty-array 이슈 (reasoning 과 함께 deferred) 등 커버. 같은 anti-fabrication 규칙.
- [`docs/spec.md`](./docs/spec.md) — MVP 전체가 만들어진 original product spec (게임 규칙, 타겟 본능, 수익 모델, MVP 스코프).
- [`docs/architecture.md`](./docs/architecture.md), [`docs/multiplayer-networking.md`](./docs/multiplayer-networking.md), [`docs/firefly-prompts.md`](./docs/firefly-prompts.md) — 부속 디자인 / ops docs.

**Stats** (검증됨, 추론 아님):

```
$ git log --oneline | wc -l
   93
$ git log --reverse --format='%ai' | head -1   # 첫 commit
2026-02-12 16:07:43 +0900
$ git log -1 --format='%ai'                    # 최근 commit (작성 시점)
2026-06-02 15:17:24 -0400
```

---

## 정직한 한계

> 명백히 적어둠 — 가장자리 아는 게 엔지니어링의 일부이기 때문.

- **EC2 백엔드 아직 미프로비전.** Vercel 의 프런트는 라이브; 백엔드 `docker-compose.prod.yml` + Caddyfile + 배포 runbook 다 커밋 + 준비, 하지만 EC2 launch / DNS A 레코드 / 첫 배포는 대기 중이고 interactive AWS-console 작업 필요.
- **자동 프런트엔드 테스트 없음.** 112개 Python test function 이 engine, matchmaking service, game store, AI opponent, WebSocket manager 의 pub/sub, observability, integration PvP flow 커버. 13개 Go 단위 테스트가 engine 셀별 + perspective-flip 헬퍼 커버. 웹 프런트는 현재 자동 테스트 0개 — `npm run dev` + 브라우저 DevTools 로 manually 검증. React 컴포넌트용 테스트 스위트가 명백한 다음 투자.
- **Go 런타임은 와이어드, 권한자 아님.** Go 게임 서버가 진짜 Python 발행 게임 세션 정확히 서빙할 수 있음을 E2E 검증. `docker-compose.prod.yml` 이 `game` 을 `api` 옆에 같이 실행하고, Caddyfile 의 거기로 라우트가 commit 됨 — 켜는 건 한 줄 uncomment + redeploy. 그 전엔 Python 이 실 사용자 서빙.
- **Lua atomic submit deferred.** `go-server/submit_action.lua` 를 `WATCH`/`MULTI`/`EXEC` 의 single-round-trip atomic 대안으로 작성. Redis 의 `cjson` empty-array-as-object 인코딩 한계 hit (Python Pydantic 의 strict-mode 가 round-trip 된 JSON 거절). `WATCH`/`MULTI`/`EXEC` 로 복귀, 현재 스케일엔 fine (contention 이 single-digit/day). `go-server/session.go::submitAction` 에 inline 문서화.
- **일부 스프라이트 생성이 commercial release 에 편하지 않을 정도로 특정 라이선스 캐릭터에 가까움.** 가장 노골적인 케이스 1회 재생성 (Konoha 스타일 헤드밴드를 generic 빨간 sweatband 로 교체). 실 commercial 런칭의 정직한 경로는 Adobe Firefly (Adobe 가 commercial indemnification) 또는 commission artist — 파일 경로 `/fighters/<id>/<pose>.png` 가 코드 변경 0 으로 drop-in 교체 가능하게 함.
- **Cross-instance disconnect 감지는 이제 Redis 사용** — 코드 리뷰로 검증, 실제 multi-instance 배포 대상 스트레스 테스트는 아직 안 함.
- **Mobile (Expo) 타겟 일시중지.** 원래 스코프, React 19 와 Reanimated/Skia 사이 peer-dep 충돌로 deferred. 그동안 프런트는 모바일 브라우저에서 PWA 로 작동.

---

## 프로젝트 구조

```
app/                                FastAPI 백엔드 (Python 3.11, async)
  api/v1/
    router.py                       aggregator
    endpoints/{auth,games,players,ranked,purchases,rooms,ws}.py
  core/
    auth/                           JWT (HS256) + guest auth
    game_engine/                    pure engine: types, outcome_matrix, engine
    ai_opponent/                    easy / medium / hard deterministic 전략
    game_store.py                   Redis 기반 PvP 세션 — WATCH/MULTI/EXEC
    room_store.py                   4-letter 코드 Tekken식 룸
    ws_manager/                     per-player pub/sub (DR-13)
    logging.py  observability.py    JSON logs + Prometheus + Sentry init
  modules/ki_clash/game_session.py  stateless PvP 세션 orchestration (DR-15)
  services/                         matchmaking, game, ranked, payment, player
  models/  schemas/                 SQLAlchemy + Pydantic
go-server/                          Go 1.23 — 풀 게임루프 런타임 (2 KLOC)
  main.go  handler.go  session.go  engine.go  store.go  pubsub.go  messages.go
  auth.go  types.go  observability.go
  engine_test.go                    engine + 헬퍼용 13개 단위 테스트
  test_e2e.py                       E2E smoke (Python rooms → Go WS)
  submit_action.lua                 atomic submit (deferred — Limitations 참조)
  Dockerfile                        multi-stage distroless 빌드 (~25 MB)
web/                                Next.js 16 (App Router) PWA
  src/app/{,/pvp,/tutorial,/shop,/invite,/history,/ranked}/page.tsx
  src/components/
    arena/{KiAuraArena,FighterSprite,CharacterAvatar}.tsx
    finale/{MatchFinale,CharacterFinishers}.tsx
    room/RoomScreen.tsx
    GameBoard.tsx  MatchHUD.tsx  TurnReveal.tsx  Countdown.tsx  …
  src/hooks/{useGame,usePvP,useActionAnimation,useSoundEffects,useAdTiming}.ts
  src/lib/{api,characters,actions,assets,sound}.ts
  public/fighters/<id>/{idle,windup,impact,hit,ko,victory}.png  ← 36개 PNG
docs/                               engineering-log · troubleshooting · spec · …
deploy/aws-ec2/                     QUICKSTART.md · README.md · .env.prod.example
docker-compose.yml                  dev: db + redis + api
docker-compose.prod.yml             prod: + game (Go) + caddy
Caddyfile                           reverse proxy + automatic Let's Encrypt SSL
tests/                              8 파일에 Python test function 112개
CLAUDE.md                           AI 보조 편집용 프로젝트 컨벤션
```

---

<div align="center">

**[Ki Clash · 기싸움](https://kiclash.daeseon.ai)** — 상대의 수를 읽고, 기를 모으고, 결정타를 쳐라.

<sub>Repo: [Daeseon-AI-Factory/ki-clash](https://github.com/Daeseon-AI-Factory/ki-clash) · 라이브 프런트: [kiclash.daeseon.ai](https://kiclash.daeseon.ai) · [English README](./README.md)</sub>

</div>
