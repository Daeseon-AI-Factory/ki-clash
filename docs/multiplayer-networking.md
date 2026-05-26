# 멀티플레이어 네트워킹 핵심 개념 (Ki Clash & 그 너머)

> 이 문서는 Ki Clash의 PvP 아키텍처를 이해하고, **나아가 LoL·Valorant 같은 실시간
> 액션 게임이 어떻게 작동하는지** 머리에 그림을 그리기 위한 학습 레퍼런스다.
> 토론토 게임/시스템 면접 대비용으로도 직접 활용 가능.
>
> Last updated: 2026-05-26

---

## 핵심 한 줄

> **게임 장르의 "latency budget"이 네트워킹 아키텍처를 결정한다.**

| 게임 | Latency Budget | 의미 |
|---|---|---|
| Ki Clash (턴제) | **5,000ms** | 5초 결정시간. 단순 server-authoritative로 충분 |
| LoL (MOBA) | ~33ms | 클라 예측 + 서버 화해 필수 |
| Overwatch (FPS) | ~16ms | 위와 동일, 더 정교 |
| Valorant (택티컬 FPS) | **~8ms** | 128Hz 틱 + lag compensation 필수 |

Latency budget이 작아질수록 **클라이언트는 거짓말을 더 많이** 해야 한다. 그 거짓말이
들키지 않게 만드는 모든 기법의 총합이 "실시간 멀티플레이어 네트워킹"이다.

---

## 1. 두 아키텍처: 단순 vs 실시간

### 1.1 Ki Clash 패턴 (단순 server-authoritative)

```
[Player A]                [Server]                [Player B]
     │                       │                        │
     │── submit("attack") ──▶│                        │
     │                       │ ── store p1_action     │
     │                       │   (봉투 A 채워짐)        │
     │◀── action_confirmed ──│                        │
     │                       │                        │
     │                       │◀──── submit("charge")──│
     │                       │ ── store p2_action     │
     │                       │   (봉투 B 채워짐)        │
     │                       │ ★ both pending!         │
     │                       │ ── engine.resolve()    │
     │                       │                        │
     │◀───── turn_result ────│───── turn_result ─────▶│
     │       (your view)     │       (your view)      │
```

**특징:**
- 서버가 진실의 단일 출처 (Single Source of Truth)
- 양쪽 입력을 받을 때까지 대기
- 결과를 두 관점으로 동시에 push (WebSocket)
- 클라이언트는 그냥 받은 거 그리는 "TV"

**언제 충분한가:**
- 5초+ 결정시간이 허용되는 턴제
- 카드게임, 보드게임, 비주얼 노벨
- Words With Friends, Ki Clash, Among Us (투표 단계)

### 1.2 LoL/Valorant 패턴 (실시간 + latency hiding)

```
[Player A 클릭]               [Server]               
     │                           │                   
     │ ★ 클라가 즉시 예측 실행      │                   
     │   (= "거짓말, 일단 움직임")  │                   
     │                           │                   
     │── input ─────────────────▶│                   
     │   (50ms 후 도착)           │                   
     │                           │ ── 진짜 시뮬레이션      
     │                           │                   
     │◀── authoritative state ───│                   
     │     (또 50ms 후)           │                   
     │                           │                   
     │ ★ 예측과 진실 비교            │                   
     │   ├ 같음 → 그대로 진행      │                   
     │   └ 다름 → 부드럽게 보정     │                   
```

**특징:**
- 클라이언트가 입력 즉시 **자체 시뮬레이션**
- 서버 응답 도착 시 비교 + 보정
- 사용자는 0ms 반응처럼 느낌
- 보정이 거칠면 "러버밴딩" 발생

---

## 2. 실시간 게임의 5단 비법

### 2.1 Client-Side Prediction (클라이언트 예측)

**개념:** 클라가 입력을 받자마자 결과를 즉시 시뮬레이션해서 화면에 표시.

**예시 (LoL):**
- 유저가 (x=300, y=200)으로 우클릭
- 클라이언트가 즉시 캐릭터 이동 시작
- 동시에 입력을 서버로 송신
- 서버 응답 오기 전에 이미 캐릭터는 절반쯤 이동 중

**Pseudo-code:**
```python
def on_click(target):
    # 1. 서버에 입력 전송
    send_to_server({"type": "move", "target": target})
    
    # 2. 동시에 클라가 자체 시뮬레이션 (예측)
    local_state.character.start_moving_to(target)
    render(local_state)  # 사용자는 즉각 반응 봄
```

### 2.2 Server Reconciliation (서버 화해)

**개념:** 서버 결과 도착 시, 클라 예측과 비교해서 차이 있으면 보정.

```python
def on_server_update(authoritative_state):
    if predict_matches(local_state, authoritative_state):
        # 예측 정확 → 그대로 진행
        pass
    else:
        # 예측 빗나감 → 보정
        # 거친 보정: snap (러버밴딩)
        # 부드러운 보정: interpolate over 100ms
        smooth_correct_to(authoritative_state, duration=100)
```

**왜 빗나가나:**
- 다른 플레이어가 동시에 행동해서 영향 받음
- 서버 측 룰이 클라이언트 예측과 미세하게 다름
- 패킷 손실로 일부 정보 빠짐

### 2.3 Lag Compensation (랙 보상)

**개념:** 서버가 게임 상태 히스토리를 보관하다가, 클라이언트의 행동 시점으로
**시간을 되돌려** 판정.

**예시 (Valorant 헤드샷):**
```
Player A의 ping = 80ms
Player A가 화면에서 "지금" 보는 적의 위치 = 80ms 전의 위치

A가 헤드샷 발사 시각: T = 1000ms
서버가 A의 발사 패킷 받는 시각: T = 1080ms (네트워크 지연 80ms)

서버 처리:
1. "A는 T=1000ms 시점의 화면을 기준으로 쐈음" 인식
2. 서버 메모리에서 T=1000ms의 적 위치 조회
3. A가 본 위치 기준으로 명중 판정
4. 명중이면 적에게 데미지 적용

결과: A 화면 기준 명중 → 데미지 들어감
      적 화면 기준 = "벽 뒤에서 죽음" (적은 이미 이동했으니까)
```

이게 CS:GO/CS2, Valorant, Apex Legends, Overwatch 다 사용. **"시간을 되돌리는
서버"**.

**구현 비용:** 서버가 매 tick의 게임 상태를 ~1초 분량 메모리에 보관. 메모리 +
CPU 비용 큼.

### 2.4 High Tick Rate (높은 틱 속도)

**틱 (tick) = 서버가 게임 상태를 시뮬레이션하는 단위 시간.**

| 게임 | 틱 속도 | 1틱 당 시간 | 특이사항 |
|---|---|---|---|
| Ki Clash | 이벤트 기반 | — | 턴제라 틱 개념 없음 |
| LoL | 30Hz | 33.3ms | MOBA 표준 |
| Overwatch 2 | 63Hz | 15.9ms | 블리자드 표준 |
| CS2 | 64Hz + sub-tick | ~15ms | sub-tick interpolation으로 체감 더 빠름 |
| Valorant | **128Hz** | 7.8ms | FPS 최상위, Riot 자체 서버 운영 |
| Quake 3 | 1000Hz (이론) | 1ms | 옛날 vsync 없는 시절 |

**틱 높을수록 좋은가?**
- ✅ 더 정확한 hit detection
- ✅ 더 매끄러운 움직임 동기화
- ❌ 서버 CPU 비용 2배
- ❌ 양방향 패킷 대역폭 2배
- ❌ 클라 처리 비용 증가

**왜 Valorant는 128Hz로 가는가:**
- 헤드샷 한 발에 승부가 갈리는 게임
- 1px·1ms 차이가 결과를 바꿈
- 그래서 Riot이 글로벌 데이터센터 직접 운영 (라이엇 직접 ISP 계약)

### 2.5 UDP + 커스텀 신뢰성 레이어

**TCP의 문제 (Ki Clash가 쓰는 WebSocket):**
- 모든 패킷 보장 + 순서 보장
- 패킷 1개 손실 → 뒤 패킷 전부 대기 (head-of-line blocking)
- 1-2초 lag spike 발생 가능

**UDP의 장점:**
- 패킷 잃어도 그냥 다음 거 진행
- 최신 위치만 중요하니 옛 패킷은 쓸모없음 (자연스럽게 맞음)
- 지연 일관성 ↑

**실제 사례:**
- CS2: UDP + 자체 신뢰성 프로토콜
- LoL: ENet (UDP 기반 라이브러리)
- Valorant: Riot 자체 프로토콜
- 최신 트렌드: **QUIC** (UDP 기반, HTTP/3의 베이스, 신뢰성 옵션 내장)

**중요 이벤트는 신뢰성 강제:**
- 위치 동기화 → UDP, 잃어도 OK
- 킬 이벤트, 아이템 구매 → 별도 신뢰성 채널로 보장
- 채팅 → TCP/HTTP

---

## 3. 추가 기법

### 3.1 Interpolation & Extrapolation

```
서버에서 30Hz로 위치 스냅샷 전송:
T=0ms:   적 위치 = (100, 200)
T=33ms:  적 위치 = (105, 205)
T=66ms:  적 위치 = (110, 210)

클라이언트 화면은 60fps = 16.6ms 마다 그려야 함.
스냅샷 사이를 보간(interpolate)해서 부드럽게 표시:

T=0ms ~ 33ms 사이 → (100,200) → (105,205) 사이를 선형 보간
T=16.6ms 화면 = (102.5, 202.5)  ← 실제로는 받은 적 없는 좌표
```

패킷 손실 시 extrapolation(외삽)으로 예측 위치 계산. 너무 멀리 예측하면 부정확.

### 3.2 Delta Compression (델타 압축)

매 틱마다 전체 게임 상태 전송 ❌ → **바뀐 것만** 전송 ✅

```
Full snapshot:        ~5KB (불가능, 60Hz면 초당 2.4Mbps)
Delta from last:      ~200B (변한 유닛 좌표만)

LoL: 미니맵 정보·체력바·CC 상태만 보냄.
     캐릭터 모델·스킬 데이터는 클라가 이미 가짐.
```

### 3.3 Regional Servers (지역 서버)

광속이 한계. 서울 ↔ 미국 서버 = 최소 150ms ping.

| 지역 | 광속 한계 ping |
|---|---|
| 서울 ↔ 도쿄 | ~30ms |
| 서울 ↔ 싱가포르 | ~70ms |
| 서울 ↔ 시애틀 | ~130ms |
| 서울 ↔ 런던 | ~270ms |

그래서 게임마다 지역 서버 (KR, NA, EUW, JP, SEA...). 토론토 LoL 서버 따로 있음.

### 3.4 Spectator Delay (관전 지연)

LoL 관전 모드 = **3초 지연** 강제.

**이유:** 친구가 적팀 위치 보고 디스코드로 실시간 알려주면 안 됨. 3초 지연
넣으면 정보 가치 사라짐.

토너먼트는 더 길게 (5-10분 지연) 둠.

### 3.5 Lockstep (RTS 전용)

스타크래프트, AoE 시리즈, Civilization이 사용.

```
[일반 멀티 게임]
서버가 게임 상태 시뮬레이션 → 모든 클라에 결과 전송

[Lockstep 멀티 게임]
모든 클라가 같은 시뮬레이션 결정론적으로 실행
→ 입력(클릭)만 네트워크로 공유
→ 모두가 같은 입력 받고 똑같이 계산 → 결과 동일
```

**장점:**
- 1000개 유닛도 입력만 보내면 됨 (대역폭 최소)
- 치팅 방지 (모두가 같은 상태)

**단점:**
- 1명이 끊기면 **전체 일시정지**
- "Waiting for player..." 메시지 자주 보는 이유

---

## 4. Ki Clash가 이걸 다 안 해도 되는 이유

```
┌─────────────────────────────────────────────────────┐
│  Ki Clash budget = 5,000ms                          │
│  LoL budget      =    33ms                          │
│  Valorant budget =     8ms                          │
│                                                     │
│  → Ki Clash는 LoL보다 150배, Valorant보다 625배      │
│    여유로움.                                          │
└─────────────────────────────────────────────────────┘
```

5초 budget에서는:
- ❌ Client prediction 불필요 (사람 반응이 더 느림)
- ❌ Lag compensation 불필요 (시간 정보 무의미)
- ❌ 고틱 시뮬레이션 불필요 (이벤트 기반 충분)
- ❌ UDP 불필요 (WebSocket/TCP로 충분)
- ✅ "둘 다 기다린 후 결과 발표" 단순 패턴

**이게 Ki Clash를 Python + FastAPI + WebSocket으로 짤 수 있는 이유.**

만약 Ki Clash를 1v1 격투 게임(Street Fighter 류)으로 만들었다면 Python 불가능.
C++/Rust + UDP + 60fps 동기화 + rollback netcode 필수.

---

## 5. Ki Clash 코드와의 매핑

### 5.1 WSManager — 전화번호부

`app/core/ws_manager/manager.py`

```python
# 머릿속 모델:
{
  player_A_uuid: <WebSocket 객체 A>,
  player_B_uuid: <WebSocket 객체 B>,
}
```

서버가 "B한테 보내고 싶다" → `ws_manager.send_to_player(B_id, msg)`.

### 5.2 PvPGameSession — 봉투 보관소

`app/modules/ki_clash/game_session.py`

```python
# 봉투 2개
self._p1_action: Action | None = None
self._p2_action: Action | None = None

# 봉투 채우는 로직 (submit_action 메서드)
if player_id == self.p1_id:
    self._p1_action = action

# 둘 다 차면 동시 개봉
if self._p1_action is not None and self._p2_action is not None:
    await self._resolve_turn()
```

### 5.3 동시 발표 — 같은 사건, 두 관점

`_resolve_turn()` 내부:

```python
# A에게는 A 시점으로
await self._ws.send_to_player(
    self.p1_id,
    ws_msg.turn_result(
        your_action=turn_result.p1_action.value,
        opponent_action=turn_result.p2_action.value,
        outcome="you_win",  # ← p1이 이긴 경우
        ...
    ),
)

# B에게는 B 시점으로 (같은 사건, 뒤집힌 라벨)
await self._ws.send_to_player(
    self.p2_id,
    ws_msg.turn_result(
        your_action=turn_result.p2_action.value,
        opponent_action=turn_result.p1_action.value,
        outcome="you_lose",  # ← 같은 결과를 B 관점에서
        ...
    ),
)
```

`send_to_player` 두 번 사이 시차 = 마이크로초. 사실상 동시.

### 5.4 Disconnect 처리

```python
# 끊김 감지 (FastAPI가 자동으로 WebSocketDisconnect 예외 발생)
except WebSocketDisconnect:
    await session.handle_disconnect(player_id)

# handle_disconnect 내부:
# 1. 상대에게 즉시 알림 ("opponent_disconnected, 30초 남음")
# 2. 30초 forfeit 타이머 시작
# 3. 30초 내 재접속하면 cancel + 상대에게 "재연결됨" 알림
# 4. 30초 지나도 안 오면 → forfeit 처리, 상대 승리
```

---

## 6. 면접 치트시트

**"실시간 멀티플레이어 게임 어떻게 작동해요?"** 받을 때:

> "장르의 latency budget이 아키텍처를 결정합니다.
>
> 턴제(5초+ budget)는 server-authoritative + WebSocket 양방향 push로 충분합니다.
> 두 플레이어 입력을 서버가 받아서 둘 다 들어왔을 때 동시에 결과를 broadcast하는
> 패턴이죠. 제 Ki Clash 프로젝트가 이 구조입니다.
>
> 액션 게임(33ms 이하 budget)은 그것만으론 부족합니다. 사람은 100ms 이상 지연을
> 느끼는데, 네트워크 왕복만 80ms 잡아먹으니까요. 그래서 클라이언트가 입력 즉시
> 자체 시뮬레이션해서 표시하고(client-side prediction), 서버 응답 도착 시 비교해서
> 보정합니다(server reconciliation). FPS는 추가로 lag compensation — 서버가 매
> 틱의 상태를 보관하다가 클라이언트 시점으로 시간을 되돌려 명중 판정하는 기법까지
> 사용합니다. Valorant가 128Hz 틱으로 이 모든 걸 가장 정교하게 구현한 사례죠.
>
> 네트워크 프로토콜도 다릅니다. 턴제는 TCP/WebSocket으로 충분하지만, 액션은 UDP에
> 커스텀 신뢰성 레이어 얹는 게 표준입니다. TCP는 head-of-line blocking 때문에
> 패킷 손실 시 lag spike가 발생하니까요."

**키워드:**
- `latency budget`, `server-authoritative`, `single source of truth`
- `client-side prediction`, `server reconciliation`, `rubber-banding`
- `lag compensation`, `rewind`, `tick rate`
- `interpolation`, `extrapolation`, `delta compression`
- `UDP`, `QUIC`, `head-of-line blocking`
- `lockstep`, `determinism`

---

## 7. 더 깊이 파고 싶을 때 (자료)

### 입문 (반드시 읽기)
1. **Gabriel Gambetta — "Fast-Paced Multiplayer"** 시리즈
   - https://www.gabrielgambetta.com/client-server-game-architecture.html
   - 4부작. 클라이언트 예측 입문 표준 자료. 무료.

### 중급
2. **Valve Source Engine Multiplayer Networking**
   - https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
   - CS:GO의 lag compensation 원본 문서.

3. **Glenn Fiedler — "Networked Physics" 시리즈**
   - https://gafferongames.com/
   - UDP/QUIC 기반 게임 네트워킹의 깊은 자료.

### 상급
4. **Riot Engineering Blog**
   - https://technology.riotgames.com/news
   - LoL/Valorant 내부 아키텍처 진솔하게 공개.
   - 특히 "Determinism in League of Legends", "Peeker's Advantage in
     Valorant" 같은 글 추천.

### 코드로 배우기
5. **Colyseus** (Node.js 멀티플레이어 프레임워크)
   - https://colyseus.io/
   - 오픈소스. 실제 구현 코드 직접 봄.

6. **Mirror** (Unity 멀티플레이어)
   - https://mirror-networking.gitbook.io/
   - 클라이언트 예측·동기화 패턴 학습 가능.

---

## 8. Ki Clash 다음 진화 단계

향후 Ki Clash가 실시간 게임으로 진화한다면 (예: 1v1 격투):

| 현재 (턴제) | 미래 (실시간) |
|---|---|
| WebSocket / TCP | UDP / QUIC |
| Python + FastAPI | Go / Rust (저지연) |
| 이벤트 기반 | 60Hz 틱 시뮬레이션 |
| 단순 송수신 | Client prediction + reconciliation |
| 단순 disconnect 처리 | Rollback netcode (격투 게임 표준) |

이게 Phase 5의 Go 게임 서버가 의미 있는 진짜 이유 — **언젠가 실시간으로 진화할
여지를 남기는 것.** Python에선 이런 미래로 못 감.
