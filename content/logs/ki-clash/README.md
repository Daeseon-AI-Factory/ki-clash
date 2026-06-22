# Ki Clash — Project Log Timeline

A date-indexed log of every milestone and decision, reconstructed from git
history and `docs/engineering-log.md`. Every commit hash, date, and file
reference in these entries was verified against git (`git cat-file`,
`git show`) — no fabricated hashes, dates, or metrics.

The history splits into four eras (the git timezone offset, shown below,
shifts with each):

## Era 1 — Korea prototype (TZ `+09:00`)

| Date | Kind | Vis | Entry |
|---|---|---|---|
| 2026-02-12 | update | public | [Genesis — repo init + founding philosophy](2026-02-12-genesis.mdx) |
| 2026-02-22 | update | public | [Core game in a day — engine, backend API, web](2026-02-22-core-game-engine-web.mdx) |
| 2026-02-22 | update | public | [PvP realtime backend — WS, Redis matchmaking, session](2026-02-22-pvp-websocket-backend.mdx) |
| 2026-02-22 | update | public | [React Native (Expo) mobile app + game flow](2026-02-22-react-native-mobile.mdx) |
| 2026-02-22 | ux-retro | public | [Game feel — SFX, card-flip reveal, screen shake](2026-02-22-game-feel-juice.mdx) |
| 2026-02-22 | ux-retro | public | [6 Korean fighters, character select, AI trash talk + tutorial](2026-02-22-characters-trash-talk.mdx) |
| 2026-02-22 | ux-retro | public | [Pixel-art fighter system (web + mobile)](2026-02-22-pixel-art-system.mdx) |
| 2026-02-22 | monetization | **private** | [Monetization v1 + social — ads, Stripe, ELO, leaderboard](2026-02-22-monetization-and-social-v1.mdx) |
| 2026-02-23 | troubleshoot | public | [First deploy night — Railway, dynamic PORT, Dockerfile fixes](2026-02-23-first-deploy-railway.mdx) |

> **~3-month gap (2026-02-23 → 2026-05-25): no commits.** The engineering log
> does not cover this window, so nothing is asserted about it.

## Era 2 — Toronto rebuild (TZ `-04:00`)

| Date | Kind | Vis | Entry |
|---|---|---|---|
| 2026-05-24 | tech-retro | public | [Rebuild kickoff — spec re-grounded, 2-tier strategy, anime pivot](2026-05-24-rebuild-genesis-strategy.mdx) |
| 2026-05-25 | tech-retro | public | [Asset pipeline + fallback components; pixel-art deprecated](2026-05-25-asset-pipeline-deprecate-pixelart.mdx) |
| 2026-05-26 | tech-retro | public | [Multiplayer networking reference (vs LoL / Valorant)](2026-05-26-networking-reference.mdx) |
| 2026-05-26 | troubleshoot | public | [PvP simulator surfaces 4 concurrency bugs (xfail)](2026-05-26-pvp-bugs-discovered.mdx) |
| 2026-05-26 | tech-retro | public | [Phase 2 — tests + observability (JWT, JSON logs, Sentry, Prometheus)](2026-05-26-phase2-tests-observability.mdx) |
| 2026-05-26 | troubleshoot | public | [Phase 3 — fixed the 4 PvP concurrency bugs](2026-05-26-phase3-pvp-concurrency-fixes.mdx) |
| 2026-05-26 | tech-retro | public | [Wrote the Engineering Decision Reference (DR-1..11)](2026-05-26-decision-reference-doc.mdx) |
| 2026-05-26 | tech-retro | public | [Phase 4 — Redis-backed stateless PvP (149 tests)](2026-05-26-phase4-redis-stateless.mdx) |
| 2026-05-27 | update | public | [Phase 6 — production stack scaffold (AWS EC2 + Vercel)](2026-05-27-prod-stack-scaffold.mdx) |
| 2026-05-28 | update | public | [RESUME-HERE checkpoint added to the engineering log](2026-05-28-resume-checkpoint.mdx) |

## Era 3 — Deploy night (TZ `-04:00`)

| Date | Kind | Vis | Entry |
|---|---|---|---|
| 2026-06-01 | ux-retro | public | [Phase 7 — cinematic match-end finale + anime ki-aura arena](2026-06-01-phase7-anime-finale.mdx) |
| 2026-06-01 | ux-retro | public | [Phases 7D-F — fighter sprites + 6 AI idle sprites](2026-06-01-fighter-sprites-and-art.mdx) |
| 2026-06-01 | update | public | [Phase 8 — Tekken-style room PvP](2026-06-01-room-pvp-tekken-style.mdx) |
| 2026-06-01 | tech-retro | public | [Phase 10 — standalone Go WebSocket game server](2026-06-01-go-game-server.mdx) |
| 2026-06-01 | update | public | [Deploy-night checkpoint — Phase 9 (live deploy) still pending](2026-06-01-deploy-night-state.mdx) |

## Era 4 — Hardening + live launch (TZ `-04:00`)

| Date | Kind | Vis | Entry |
|---|---|---|---|
| 2026-06-02 | ux-retro | public | [Phase 11 — in-house FX overhaul (Lottie-quality, no external assets)](2026-06-02-phase11-inhouse-fx.mdx) |
| 2026-06-02 | ux-retro | public | [Character-specific ultimate finishers + real fighter PNGs on select](2026-06-02-finishers-real-pngs.mdx) |
| 2026-06-02 | update | public | [Rebrand to JJAN! · 짠 + recruiter-ready bilingual README](2026-06-02-brand-jjan-readme.mdx) |
| 2026-06-03 | troubleshoot | public | [Vercel monorepo routing + canonical-domain redirects](2026-06-03-vercel-monorepo-routing.mdx) |
| 2026-06-04 | tech-retro | public | [AWS infra as Terraform IaC — VPC + EC2 + separated EBS + EIP](2026-06-04-aws-terraform-iac.mdx) |
| 2026-06-04 | troubleshoot | public | [DR-16 — client-ready handshake + 8-dimension live verification](2026-06-04-pvp-handshake-dr16.mdx) |
| 2026-06-07 | troubleshoot | public | [Go-live night — real AWS deploy + the bugs only prod surfaced](2026-06-07-live-deploy-night.mdx) |
| 2026-06-07 | tech-retro | public | [PixiJS v8 WebGL effects (DR-17) and the additive-overlay lesson (DR-18)](2026-06-07-pixijs-webgl-dr17-dr18.mdx) |
| 2026-06-07 | ux-retro | public | [Viewport-locked single-screen mobile + installable PWA](2026-06-07-mobile-single-screen-pwa.mdx) |
| 2026-06-10 | tech-retro | public | [Load testing (k6) + CI pipeline (GitHub Actions)](2026-06-10-load-testing-ci.mdx) |
