/**
 * Asset path conventions for Ki Clash (mobile / Expo).
 *
 * Mirrors `web/src/lib/assets.ts` IDs so character/effect/sound naming is
 * identical across platforms. Designers produce a single set of assets and
 * place them in `mobile/assets/` following the same folder structure:
 *
 *   mobile/assets/
 *   ├── characters/<characterId>/<expression>.png
 *   ├── cards/<action>-icon.svg          (rendered via react-native-svg)
 *   ├── effects/<effectId>.png
 *   ├── backgrounds/<name>.jpg
 *   └── sounds/<soundId>.mp3
 *
 * Bundled assets in React Native must be `require()`d statically — dynamic
 * string paths don't work the way they do on the web. So instead of path
 * strings, we expose `requireAsset(...)` helpers that resolve to the bundler
 * module reference. Each helper wraps a try/catch so a missing asset returns
 * null (caller falls back to emoji/default).
 *
 * # CORE_CANDIDATE — asset path helpers are reusable across products.
 */

import type { Action } from "./api";

// ────────────────────────────────────────────────────────────────────────────
// Type definitions (identical to web)
// ────────────────────────────────────────────────────────────────────────────

export type CharacterId =
  | "haneul"
  | "bora"
  | "taeyang"
  | "danbi"
  | "seokjin"
  | "yuri";

export type CharacterExpression =
  | "portrait"
  | "idle"
  | "charge"
  | "hit"
  | "win";

export type EffectId =
  | "energy-wave"
  | "aura-charge"
  | "block-shield"
  | "teleport-flash"
  | "clash-explosion"
  | "impact-burst";

export type BackgroundId = "dojo" | "arena" | "mountain" | "void" | "city";

export type SoundId =
  | "card-select"
  | "countdown-beat"
  | "countdown-reveal"
  | "charge"
  | "attack-impact"
  | "energy-wave-fire"
  | "block-clang"
  | "teleport-whoosh"
  | "clash"
  | "round-win"
  | "match-win"
  | "match-lose";

// ────────────────────────────────────────────────────────────────────────────
// Asset resolvers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns a `require()` module reference for a bundled asset, or null if the
 * file is not present. The Metro bundler resolves `require()` calls at build
 * time — if a path can't be resolved, the try/catch turns it into a null so
 * components can fall back gracefully.
 *
 * Note: dynamic `require(expression)` is discouraged in RN. For runtime-known
 * assets, prefer pre-declared static requires in a manifest below.
 */
export function characterAsset(
  id: CharacterId,
  expression: CharacterExpression = "portrait",
): number | null {
  return CHARACTER_MANIFEST[id]?.[expression] ?? null;
}

export function effectAsset(id: EffectId): number | null {
  return EFFECT_MANIFEST[id] ?? null;
}

export function backgroundAsset(id: BackgroundId): number | null {
  return BACKGROUND_MANIFEST[id] ?? null;
}

export function soundAsset(id: SoundId): number | null {
  return SOUND_MANIFEST[id] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// Static manifest — populate as real assets land in mobile/assets/.
//
// React Native's Metro bundler needs static `require()` calls. Add entries
// here only after the corresponding file exists in mobile/assets/, otherwise
// the bundler will fail at startup.
// ────────────────────────────────────────────────────────────────────────────

const CHARACTER_MANIFEST: Record<
  CharacterId,
  Partial<Record<CharacterExpression, number>>
> = {
  haneul: {},
  bora: {},
  taeyang: {},
  danbi: {},
  seokjin: {},
  yuri: {},
};

const EFFECT_MANIFEST: Partial<Record<EffectId, number>> = {};

const BACKGROUND_MANIFEST: Partial<Record<BackgroundId, number>> = {};

const SOUND_MANIFEST: Partial<Record<SoundId, number>> = {};

// Example of how an entry looks once an asset exists (uncomment when ready):
//
// const CHARACTER_MANIFEST: Record<...> = {
//   haneul: {
//     portrait: require("../../assets/characters/haneul/portrait.png"),
//     idle: require("../../assets/characters/haneul/idle.png"),
//   },
//   ...
// };

// Silence unused warnings — the `Action` import is kept for parity with web
// and will be used once card icon resolvers are added.
export type { Action };
