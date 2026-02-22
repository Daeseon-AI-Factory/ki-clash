/**
 * Utility functions for pixel art rendering.
 *
 * The core technique: each pixel in a frame becomes a CSS box-shadow offset
 * from a 1×1px element. This produces crisp, scalable pixel art with zero
 * external assets — pure CSS.
 */

import type { PixelFrame } from "./pixel-art-types";

/** Default pixel size multiplier (each logical pixel = PX×PX CSS pixels) */
export const DEFAULT_PX = 3;

/**
 * Convert a 2D color grid into a CSS box-shadow string.
 *
 * Each non-null cell becomes a box-shadow offset from the top-left origin.
 * The resulting string can be applied to a 1×1px div to render the full sprite.
 *
 * @param grid - 2D array of hex colors (null = transparent)
 * @param px - Pixel size multiplier (default: 3)
 * @returns CSS box-shadow value string
 */
export function frameToBoxShadow(grid: PixelFrame, px: number = DEFAULT_PX): string {
  const shadows: string[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const color = grid[y][x];
      if (color) {
        shadows.push(`${x * px}px ${y * px}px 0 ${color}`);
      }
    }
  }
  return shadows.join(", ");
}

/**
 * Get the pixel dimensions of a frame.
 *
 * @param grid - 2D pixel grid
 * @returns { width, height } in logical pixels (before PX multiplier)
 */
export function frameDimensions(grid: PixelFrame): { width: number; height: number } {
  const height = grid.length;
  const width = grid.length > 0 ? grid[0].length : 0;
  return { width, height };
}
