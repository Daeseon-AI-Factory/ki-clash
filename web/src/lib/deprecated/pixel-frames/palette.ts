/**
 * Shared color palette for all pixel art characters.
 *
 * Common colors are shared across all 6 fighters:
 * - Transparent (_), body (B), skin (S), eye (E), white (W)
 *
 * Character-specific colors match their theme colors from characters.ts.
 * Each character file imports these plus their own accent color.
 */

// Common palette
export const _ = null;           // transparent
export const B = "#1a1a2e";      // dark body / pants
export const S = "#e2e8f0";      // skin tone
export const E = "#0f172a";      // eyes
export const W = "#ffffff";      // white highlights

// Character accent colors (match characters.ts color field)
export const HANEUL_COLOR = "#60A5FA";  // blue-400
export const BORA_COLOR = "#C084FC";    // purple-400
export const TAEYANG_COLOR = "#FACC15"; // yellow-400
export const DANBI_COLOR = "#22D3EE";   // cyan-400
export const SEOKJIN_COLOR = "#FB923C"; // orange-400
export const YURI_COLOR = "#F472B6";    // pink-400
