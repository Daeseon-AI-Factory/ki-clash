#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function fail(message) {
  failures.push(message);
}

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function requireRegex(source, pattern, label) {
  if (!pattern.test(source)) {
    fail(`${label}: missing ${pattern}`);
  }
}

function requireExportedFunctions(source, functions, label) {
  for (const fn of functions) {
    requireRegex(source, new RegExp(`export\\s+async\\s+function\\s+${fn}\\b`), label);
  }
}

const webApi = read("web/src/lib/api.ts");
const mobileApi = read("mobile/src/lib/api.ts");
const webPvpHook = read("web/src/hooks/usePvP.ts");
const mobilePvpHook = read("mobile/src/hooks/usePvP.ts");
const webPvpPage = read("web/src/app/pvp/page.tsx");
const mobilePvpPage = read("mobile/app/pvp.tsx");
const webRoom = read("web/src/components/room/RoomScreen.tsx");
const mobileRoom = read("mobile/src/components/RoomLobby.tsx");
const mobileAnalytics = read("mobile/src/lib/analytics.ts");

const roomApiFunctions = [
  "createRoom",
  "getRoom",
  "joinRoom",
  "setRoomCharacter",
  "setRoomReady",
  "startRoomGame",
  "leaveRoom",
];

requireExportedFunctions(webApi, roomApiFunctions, "web api room parity");
requireExportedFunctions(mobileApi, roomApiFunctions, "mobile api room parity");

for (const [label, source] of [
  ["web pvp hook", webPvpHook],
  ["mobile pvp hook", mobilePvpHook],
]) {
  requireIncludes(source, "joinGame", label);
  requireIncludes(source, "/api/v1/ws/game/", label);
  requireIncludes(source, "/api/v1/ws/matchmaking", label);
  requireIncludes(source, "API_BASE.replace", label);
  requireIncludes(source, "action_submitted", label);
  requireIncludes(source, "match_finish", label);
}

for (const [label, source] of [
  ["web pvp page", webPvpPage],
  ["mobile pvp page", mobilePvpPage],
]) {
  requireIncludes(source, "Quick Match", label);
  requireIncludes(source, "Create Room", label);
  requireIncludes(source, "Join Room", label);
  requireIncludes(source, "joinGame", label);
}

for (const [label, source] of [
  ["web room flow", webRoom],
  ["mobile room flow", mobileRoom],
]) {
  requireIncludes(source, "POLL_INTERVAL_MS", label);
  requireIncludes(source, "startCalledRef", label);
  requireIncludes(source, "gameHandedOffRef", label);
  requireIncludes(source, "createRoom", label);
  requireIncludes(source, "joinRoom", label);
  requireIncludes(source, "setRoomCharacter", label);
  requireIncludes(source, "setRoomReady", label);
  requireIncludes(source, "startRoomGame", label);
  requireIncludes(source, "leaveRoom", label);
  requireIncludes(source, "pvp_room_created", label);
  requireIncludes(source, "pvp_room_joined", label);
  requireIncludes(source, "invite_copied", label);
}

for (const eventName of [
  "pvp_room_created",
  "pvp_room_joined",
  "pvp_match_started",
  "invite_copied",
  "action_submitted",
  "match_finish",
]) {
  requireIncludes(webPvpHook + webRoom, eventName, `web analytics event ${eventName}`);
  requireIncludes(mobilePvpHook + mobileRoom, eventName, `mobile analytics event ${eventName}`);
}

for (const eventName of [
  "mobile_room_error",
  "mobile_ws_game_error",
  "mobile_ws_matchmaking_error",
  "mobile_matchmaking_timeout",
]) {
  requireIncludes(mobilePvpHook + mobileRoom, eventName, `mobile diagnostics event ${eventName}`);
}

requireIncludes(mobileAnalytics, "/api/analytics/events", "mobile analytics transport");
requireIncludes(mobileAnalytics, "client: \"mobile\"", "mobile analytics client tag");

if (failures.length > 0) {
  console.error("Online parity check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Online parity check passed.");
