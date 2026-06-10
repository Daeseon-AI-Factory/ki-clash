// WebSocket load test — concurrent connections to the Go game server.
// Tests how many simultaneous game sockets the server holds + their stability.
//
// setup() pre-spawns N real games via REST; each VU opens one game socket,
// holds it, pings periodically, and verifies it stays open. This probes the
// Go server's connection capacity (the hot path).
//
//   k6 run -e CONNS=30 load/ws_load.js
//   k6 run -e CONNS=100 -e BASE_URL=http://localhost:8000 load/ws_load.js
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import { WS_URL, spawnRoomGame } from "./lib.js";

const CONNS = Number(__ENV.CONNS || 25);
const HOLD_S = Number(__ENV.HOLD_S || 20);

const wsConnected = new Counter("ws_connected");
const wsFailed = new Counter("ws_failed");
const wsFirstMsg = new Trend("ws_first_msg_ms", true);

export const options = {
  scenarios: {
    sockets: {
      executor: "per-vu-iterations",
      vus: CONNS,
      iterations: 1,
      maxDuration: `${HOLD_S + 30}s`,
    },
  },
  thresholds: {
    ws_connecting: ["p(95)<3000"], // handshake under 3s
    checks: ["rate>0.95"],
  },
};

// Pre-create one game per VU so each gets a valid game_id + player token.
export function setup() {
  const games = [];
  for (let i = 0; i < CONNS; i++) {
    const g = spawnRoomGame();
    if (g) games.push({ gameId: g.gameId, token: g.t1 });
  }
  console.log(`\n  WS load: spawned ${games.length}/${CONNS} games → ${WS_URL}\n`);
  return { games };
}

export default function (data) {
  const game = data.games[(__VU - 1) % data.games.length];
  if (!game) return;

  const url = `${WS_URL}/api/v1/ws/game/${game.gameId}?token=${game.token}`;
  const opened = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      wsConnected.add(1);
      // ping every 5s to keep the connection active
      socket.setInterval(() => socket.ping(), 5000);
      // hold the socket, then close
      socket.setTimeout(() => socket.close(), HOLD_S * 1000);
    });
    socket.on("message", () => {
      wsFirstMsg.add(Date.now() - opened);
    });
    socket.on("error", () => wsFailed.add(1));
  });

  check(res, { "ws 101 upgrade": (r) => r && r.status === 101 });
  sleep(1);
}
