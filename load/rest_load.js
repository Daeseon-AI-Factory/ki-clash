// REST load test — ramping virtual users through the Room-PvP + vs-AI flows.
// Finds REST latency/error behavior under concurrency.
//
// Default is GENTLE (peaks at 15 VUs) because the live backend is a single
// t3.micro / 1 uvicorn worker. Scale with env vars, watching the server:
//   k6 run -e PEAK=50 -e BASE_URL=http://localhost:8000 load/rest_load.js
import { group, sleep } from "k6";
import { spawnRoomGame, playAIGame, BASE_URL } from "./lib.js";

const PEAK = Number(__ENV.PEAK || 15);

export const options = {
  scenarios: {
    rest: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: PEAK }, // ramp up
        { duration: "40s", target: PEAK }, // sustain
        { duration: "15s", target: 0 },    // ramp down
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],      // <2% errors
    http_req_duration: ["p(95)<1500"],   // p95 under 1.5s
    "http_req_duration{name:room_start}": ["p(95)<1500"],
    checks: ["rate>0.95"],
  },
};

export default function () {
  // ~70% play vs-AI (cheaper), ~30% spin up a full Room PvP game.
  if (Math.random() < 0.7) {
    group("vs-AI flow", () => {
      playAIGame();
    });
  } else {
    group("Room PvP flow", () => {
      spawnRoomGame();
    });
  }
  sleep(1 + Math.random()); // think-time between iterations
}

export function setup() {
  console.log(`\n  REST load → ${BASE_URL}  (peak ${PEAK} VUs)\n`);
}
