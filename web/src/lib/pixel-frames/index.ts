/**
 * Pixel frame registry — central lookup for all character pixel art.
 *
 * Import this module to get frames by character ID. Avoids importing
 * individual character files throughout the codebase.
 */

import type { CharacterFrameSet, PixelFrame } from "../pixel-art-types";
import { haneulFrames } from "./haneul";
import { boraFrames } from "./bora";
import { taeyangFrames } from "./taeyang";
import { danbiFrames } from "./danbi";
import { seokjinFrames } from "./seokjin";
import { yuriFrames } from "./yuri";

const FRAME_REGISTRY: Record<string, CharacterFrameSet> = {
  haneul: haneulFrames,
  bora: boraFrames,
  taeyang: taeyangFrames,
  danbi: danbiFrames,
  seokjin: seokjinFrames,
  yuri: yuriFrames,
};

/** Get the full frame set for a character by ID */
export function getCharacterFrames(id: string): CharacterFrameSet | undefined {
  return FRAME_REGISTRY[id];
}

/** Get a specific frame for a character. Falls back to idle if action frame doesn't exist. */
export function getFrame(id: string, action?: string): PixelFrame | undefined {
  const frames = FRAME_REGISTRY[id];
  if (!frames) return undefined;

  // Try action-specific frame first, fall back to idle
  if (action && action in frames) {
    return frames[action as keyof CharacterFrameSet] as PixelFrame | undefined ?? frames.idle;
  }
  return frames.idle;
}

/** Get all registered character IDs */
export function getRegisteredCharacterIds(): string[] {
  return Object.keys(FRAME_REGISTRY);
}

// Re-export palette for convenience
export { HANEUL_COLOR, BORA_COLOR, TAEYANG_COLOR, DANBI_COLOR, SEOKJIN_COLOR, YURI_COLOR } from "./palette";
