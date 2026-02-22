/**
 * Types for the pixel art rendering system.
 *
 * A PixelFrame is a 2D grid of colors (or null for transparent).
 * Characters can have frames for different actions and phases,
 * but MVP ships with idle frames only — animations come from CSS transforms.
 */

/** A single pixel art frame — 2D array of hex colors (null = transparent) */
export type PixelFrame = (string | null)[][];

/** Battle actions that can be animated */
export type PixelAction =
  | "charge"
  | "block"
  | "attack"
  | "energyWave"
  | "teleport";

/** Animation phase state machine: idle → windup → impact → recover → idle */
export type PixelPhase = "idle" | "windup" | "impact" | "recover";

/**
 * Full frame set for a character.
 * MVP: only `idle` is required. Other actions use CSS transforms on idle frame.
 * Future: per-action frames for richer animation (e.g., attack pose, block stance).
 */
export interface CharacterFrameSet {
  id: string;
  idle: PixelFrame;
  // Future action-specific frames (optional)
  charge?: PixelFrame;
  block?: PixelFrame;
  attack?: PixelFrame;
  energyWave?: PixelFrame;
  teleport?: PixelFrame;
}
