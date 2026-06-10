// Smoke test — minimal load, validates the whole stack works end-to-end.
// Run before any heavier test:  k6 run load/smoke.js
import { check, sleep } from "k6";
import ws from "k6/ws";
import { BASE_URL, WS_URL, spawnRoomGame, playAIGame } from "./lib.js";

export const options = {
  vus: 1,
  iterations: 2,
  thresholds: {
    checks: ["rate>0.95"], // ≥95% of checks pass
    http_req_duration: ["p(95)<2000"],
  },
};

export default function () {
  // 1. Single-player vs-AI REST flow
  playAIGame();

  // 2. Room-PvP REST flow → real game_id
  const game = spawnRoomGame();
  check(game, { "room game spawned": (g) => g !== null });
  if (!game) return;

  // 3. Connect to the Go game WebSocket as player 1 and expect the server
  //    to accept the socket + (since only 1 of 2 connected) hold the turn.
  const url = `${WS_URL}/api/v1/ws/game/${game.gameId}?token=${game.t1}`;
  const res = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      check(true, { "ws connected": () => true });
    });
    socket.setTimeout(() => socket.close(), 2000); // hold 2s then close
  });
  check(res, { "ws handshake 101": (r) => r && r.status === 101 });

  sleep(1);
}

export function handleSummary(data) {
  console.log(`\n  target: ${BASE_URL}`);
  return { stdout: textSummary(data) };
}

// Minimal inline summary (avoids extra deps).
function textSummary(data) {
  const m = data.metrics;
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const checks = m.checks ? m.checks.values : {};
  return (
    `\n  checks passed: ${((checks.rate || 0) * 100).toFixed(1)}%` +
    `\n  http p95:      ${(dur["p(95)"] || 0).toFixed(0)} ms` +
    `\n  http avg:      ${(dur.avg || 0).toFixed(0)} ms\n`
  );
}
