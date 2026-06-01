/**
 * Asset path conventions for Ki Clash (web).
 *
 * This file IS the asset pipeline documentation. Convention enforced by types.
 *
 * Drop files into `web/public/` following the structure below and components
 * automatically pick them up via the path helpers exported here. When a file
 * is missing, components fall back to inline defaults (emoji, solid color)
 * so the game never breaks during development.
 *
 *   web/public/
 *   ├── characters/<characterId>/<expression>.png   (transparent PNG, 512px+)
 *   ├── cards/<action>-icon.svg                     (vector, ~64px viewBox)
 *   ├── cards/<action>-frame.svg                    (optional card frame)
 *   ├── effects/<effectId>.png                      (transparent PNG or sprite)
 *   ├── backgrounds/<name>.jpg                      (1920x1080, < 300KB)
 *   └── sounds/<soundId>.mp3                        (mono, < 100KB ideal)
 *
 * # CORE_CANDIDATE — asset path helpers are reusable across products.
 */

import type { Action } from "./api";

// ────────────────────────────────────────────────────────────────────────────
// Character assets
// ────────────────────────────────────────────────────────────────────────────

/** Roster character IDs. Keep in sync with `characters.ts` CHARACTERS list. */
export type CharacterId =
  | "haneul"
  | "bora"
  | "taeyang"
  | "danbi"
  | "seokjin"
  | "yuri";

/** Visual states a character can render in during a match. */
export type CharacterExpression =
  | "portrait" // menu / character select (full pose)
  | "idle" // default in-game state
  | "charge" // charging ki
  | "hit" // taking damage
  | "win"; // round/match victory

export const characterAsset = (
  id: CharacterId,
  expression: CharacterExpression = "portrait",
): string => `/characters/${id}/${expression}.png`;

// ────────────────────────────────────────────────────────────────────────────
// Fighter assets — in-arena combatant sprites (separate from menu portraits).
// ────────────────────────────────────────────────────────────────────────────

/**
 * Path to a fighter's pose-specific sprite PNG.
 *
 * Convention: drop a transparent PNG at this path and FighterSprite renders
 * it instead of the SVG fallback. Recommended size: ≥512px wide, transparent
 * background, full-body kung-fu stance facing right.
 *
 *   web/public/fighters/<id>/idle.png    (required to enable images)
 *   web/public/fighters/<id>/windup.png  (optional)
 *   web/public/fighters/<id>/impact.png  (optional)
 *   web/public/fighters/<id>/hit.png     (optional)
 *   web/public/fighters/<id>/ko.png      (optional)
 *   web/public/fighters/<id>/victory.png (optional)
 *
 * The component currently uses idle.png for ALL poses and applies CSS
 * transforms for pose variation. Pose-specific files take precedence once
 * provided.
 */
export const fighterAsset = (
  id: CharacterId,
  pose: "idle" | "windup" | "impact" | "hit" | "ko" | "victory" = "idle",
): string => `/fighters/${id}/${pose}.png`;

// ────────────────────────────────────────────────────────────────────────────
// Card assets
// ────────────────────────────────────────────────────────────────────────────

/** Path to the SVG icon for an action card (overrides emoji fallback). */
export const cardIconAsset = (action: Action): string =>
  `/cards/${actionSlug(action)}-icon.svg`;

/** Path to the SVG frame for an action card (optional decorative frame). */
export const cardFrameAsset = (action: Action): string =>
  `/cards/${actionSlug(action)}-frame.svg`;

const actionSlug = (action: Action): string => action.replace(/_/g, "-");

// ────────────────────────────────────────────────────────────────────────────
// Effect assets
// ────────────────────────────────────────────────────────────────────────────

export type EffectId =
  | "energy-wave" // beam particle / sprite
  | "aura-charge" // charging aura
  | "block-shield" // block shield visual
  | "teleport-flash" // teleport vanish
  | "clash-explosion" // both attacks colliding
  | "impact-burst"; // generic hit flash

export const effectAsset = (id: EffectId): string => `/effects/${id}.png`;

// ────────────────────────────────────────────────────────────────────────────
// Backgrounds
// ────────────────────────────────────────────────────────────────────────────

export type BackgroundId =
  | "dojo"
  | "arena"
  | "mountain"
  | "void"
  | "city";

export const backgroundAsset = (id: BackgroundId): string =>
  `/backgrounds/${id}.jpg`;

// ────────────────────────────────────────────────────────────────────────────
// Sounds
// ────────────────────────────────────────────────────────────────────────────

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

export const soundAsset = (id: SoundId): string => `/sounds/${id}.mp3`;

// ────────────────────────────────────────────────────────────────────────────
// Asset availability helper
// ────────────────────────────────────────────────────────────────────────────

/**
 * Probe whether an asset URL is actually fetchable. Used by components to
 * decide between the real asset and the emoji/fallback render.
 *
 * Cache results per URL — a missing asset never becomes present mid-session.
 */
const _availability: Map<string, Promise<boolean>> = new Map();

export function assetExists(url: string): Promise<boolean> {
  const cached = _availability.get(url);
  if (cached) return cached;

  const probe = fetch(url, { method: "HEAD" })
    .then((r) => r.ok)
    .catch(() => false);

  _availability.set(url, probe);
  return probe;
}
