# JJAN! Launch Marketing Kit

## Goal

Validate whether the web-first game can pull players into PvP without an app
install. Do not optimize for brand polish first. Optimize for measurable
clicks, room creation, invite shares, and finished matches.

## Main Links

Use `/promo` in production to copy the live links:

```text
https://jjan.daeseon.ai/promo
```

Primary launch links:

```text
https://jjan.daeseon.ai/go/tiktok-pvp-01
https://jjan.daeseon.ai/go/reels-pvp-01
https://jjan.daeseon.ai/go/shorts-pvp-01
https://jjan.daeseon.ai/go/reddit-playmygame-01
https://jjan.daeseon.ai/go/discord-indie-01
https://jjan.daeseon.ai/go/korea-community-01
https://jjan.daeseon.ai/go/friend-share
```

Each `/go/<slug>` link logs `promo_link_opened`, then redirects to the
playable page with `promo`, `ref`, and UTM parameters.

## First 48 Hours

Target numbers:

| Metric | Target |
| --- | ---: |
| Short posts | 20 |
| Link clicks | 300 |
| PvP rooms created | 50 |
| Finished PvP matches | 25 |
| Friend-share copies | 40 |

If clicks are low, the hook is weak. If clicks are okay but rooms are low, the
landing/PvP entry is weak. If rooms are okay but matches are low, the lobby or
second-player join flow is weak.

## Posting Order

1. Record 6 raw clips from the live web app.
2. Cut 20 short variants from those clips.
3. Post 5 per day for 4 days across TikTok, Reels, Shorts, X, Threads, Reddit,
   Discord, and Korean game communities.
4. Use one link per channel so logs stay readable.
5. After every posting batch, check Vercel logs for `jjan_analytics_event`.

## Clip Shot List

- Create PvP room.
- Copy/share room link.
- Second player joins.
- Both players press ready.
- One player charges too much and gets punished.
- Final win/loss screen.
- Character swap and rematch.

## Short-Form Hooks

Use these as first-frame text or voiceover:

```text
설치 없이 친구랑 바로 붙는 기싸움 PvP
```

```text
10초 안에 성격 나오는 게임
```

```text
링크 하나 보내면 바로 대전 시작
```

```text
충전할지 때릴지 읽히면 바로 짐
```

```text
친구한테 보내고 한 판만 해봐
```

## Community Post

```text
웹에서 바로 되는 1v1 심리전 게임 테스트 중입니다.

설치 없이 링크로 PvP 방 만들고 친구랑 바로 붙는 구조예요.
한 판 해보고 어디서 이탈하는지, 캐릭터/전투가 어색한지 피드백 부탁드립니다.

https://jjan.daeseon.ai/go/korea-community-01
```

## Reddit / English Post

```text
I built a browser-first 1v1 mind-game duel.

No install. Create a PvP room, send the link, and play a short best-of-3 match.
I am testing whether the invite flow is clear enough for real players.

https://jjan.daeseon.ai/go/reddit-playmygame-01
```

## Creator DM

```text
짧은 PvP 웹게임 하나 만들었습니다.
설치 없이 링크 누르면 바로 방 만들고 대전하는 구조라 쇼츠 소재로 맞을 것 같아 보냅니다.

데모 링크:
https://jjan.daeseon.ai/go/creator-demo
```

## Paid Test

Only start paid spend after at least 10 organic posts are live.

Budget:

```text
10,000 KRW/day per creative
3 creatives max
2 days max before review
```

Variants:

- A: funny loss / overcharging punishment.
- B: friend invite / instant PvP.
- C: Korean character / visual style.

Stop any creative where clicks happen but `pvp_room_created` stays near zero.

## Log Queries

Vercel log line prefix:

```text
jjan_analytics_event
```

Events to watch:

```text
promo_link_opened
landing_view
play_start
pvp_room_created
invite_copied
pvp_room_joined
pvp_match_started
match_finish
return_next_day
```

High-signal ratios:

```text
pvp_room_created / promo_link_opened
pvp_match_started / pvp_room_created
match_finish / pvp_match_started
invite_copied / pvp_room_created
return_next_day / unique_sessions
```

## Decision Rules

- If `promo_link_opened` is under 100 after 20 posts, hooks are not working.
- If `pvp_room_created / promo_link_opened` is under 10%, change the first
  screen and CTA.
- If `pvp_match_started / pvp_room_created` is under 35%, simplify the room
  lobby and invite flow.
- If `match_finish / pvp_match_started` is under 60%, game pacing or online
  reliability is hurting the core loop.
- If next-day return is visible from cold traffic, then App Store/TestFlight
  becomes worth setting up.
