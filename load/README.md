# Load & performance tests (k6)

[k6](https://k6.io) load tests for the JJAN backend — REST flows and the Go
game-server WebSocket. Complements the functional suites (pytest, Go `go test`).

## Install

```bash
brew install k6          # macOS
```

## Scripts

| Script | What it exercises | Run |
|---|---|---|
| `smoke.js` | Whole stack, 1 VU — vs-AI + Room-PvP + 1 WS connect | `k6 run load/smoke.js` |
| `rest_load.js` | Ramping REST load (vs-AI 70% / Room-PvP 30%) | `k6 run load/rest_load.js` |
| `ws_load.js` | N concurrent game WebSockets (Go server capacity) | `k6 run load/ws_load.js` |

## Target

Defaults to the live backend `https://api.jjan.daeseon.ai`. Point at local:

```bash
k6 run -e BASE_URL=http://localhost:8000 load/smoke.js
```

## ⚠️ Safety — the live backend is a single t3.micro (1GB, 1 uvicorn worker)

Heavy load can degrade the live service. Defaults are intentionally gentle.
Scale up deliberately, watching the server (`docker compose ... logs`, CPU):

```bash
k6 run -e PEAK=50  load/rest_load.js     # 50 ramping REST VUs
k6 run -e CONNS=100 load/ws_load.js      # 100 concurrent sockets
```

Prefer running heavy tests against a LOCAL stack (`docker compose up -d`)
before pointing them at production.

## Reading results

- `http_req_failed` — error rate (threshold <2%).
- `http_req_duration p(95)` — 95th-percentile latency (threshold <1.5s).
- `ws_connecting` — WebSocket handshake time.
- `ws_connected` / `ws_failed` — socket success counters.
- Thresholds are encoded in each script; k6 exits non-zero if breached
  (so these double as CI gates).

## CI

These are point-in-time perf checks, run manually or on a schedule — not on
every PR (they hit a live/remote stack). A nightly GitHub Actions job could
run `smoke.js` against a throwaway stack as a regression gate.
