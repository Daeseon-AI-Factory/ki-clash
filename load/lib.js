// Shared helpers for k6 load tests against the JJAN backend.
//
// BASE_URL defaults to the live backend; override for local:
//   k6 run -e BASE_URL=http://localhost:8000 load/smoke.js
import http from "k6/http";
import { check } from "k6";

export const BASE_URL = __ENV.BASE_URL || "https://api.jjan.daeseon.ai";
export const WS_URL = BASE_URL.replace(/^http/, "ws");

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Create a guest account → returns access token (or null on failure). */
export function guestToken() {
  const res = http.post(`${BASE_URL}/api/v1/auth/guest`, null, {
    tags: { name: "auth_guest" },
  });
  check(res, { "guest 200": (r) => r.status === 200 });
  try {
    return res.json("access_token");
  } catch (_) {
    return null;
  }
}

function authHeaders(token) {
  return { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
}

/**
 * Full Room-PvP flow: 2 guests → create → join → pick chars → ready → start.
 * Returns { gameId, t1, t2, code } or null if any step failed.
 */
export function spawnRoomGame() {
  const t1 = guestToken();
  const t2 = guestToken();
  if (!t1 || !t2) return null;

  const created = http.post(`${BASE_URL}/api/v1/rooms`, null, {
    headers: authHeaders(t1),
    tags: { name: "room_create" },
  });
  if (!check(created, { "room create 201": (r) => r.status === 201 })) return null;
  const code = created.json("code");

  const join = http.post(`${BASE_URL}/api/v1/rooms/${code}/join`, null, {
    headers: authHeaders(t2),
    tags: { name: "room_join" },
  });
  check(join, { "room join 200": (r) => r.status === 200 });

  http.put(`${BASE_URL}/api/v1/rooms/${code}/character`, JSON.stringify({ character_id: "haneul" }), {
    headers: authHeaders(t1), tags: { name: "room_character" },
  });
  http.put(`${BASE_URL}/api/v1/rooms/${code}/character`, JSON.stringify({ character_id: "taeyang" }), {
    headers: authHeaders(t2), tags: { name: "room_character" },
  });
  http.put(`${BASE_URL}/api/v1/rooms/${code}/ready`, JSON.stringify({ ready: true }), {
    headers: authHeaders(t1), tags: { name: "room_ready" },
  });
  http.put(`${BASE_URL}/api/v1/rooms/${code}/ready`, JSON.stringify({ ready: true }), {
    headers: authHeaders(t2), tags: { name: "room_ready" },
  });

  const start = http.post(`${BASE_URL}/api/v1/rooms/${code}/start`, null, {
    headers: authHeaders(t1), tags: { name: "room_start" },
  });
  if (!check(start, { "room start 200": (r) => r.status === 200 })) return null;
  const gameId = start.json("game_id");
  return gameId ? { gameId, t1, t2, code } : null;
}

/** Single-player vs-AI flow: create game → play one charge action. */
export function playAIGame() {
  const t = guestToken();
  if (!t) return false;
  const created = http.post(`${BASE_URL}/api/v1/games/ai`, JSON.stringify({ difficulty: "medium" }), {
    headers: authHeaders(t), tags: { name: "ai_create" },
  });
  if (!check(created, { "ai create 200": (r) => r.status === 200 })) return false;
  const gameId = created.json("game_id");

  http.get(`${BASE_URL}/api/v1/games/${gameId}`, {
    headers: authHeaders(t), tags: { name: "ai_get" },
  });
  const action = http.post(`${BASE_URL}/api/v1/games/${gameId}/action`, JSON.stringify({ action: "charge" }), {
    headers: authHeaders(t), tags: { name: "ai_action" },
  });
  return check(action, { "ai action 200": (r) => r.status === 200 });
}
