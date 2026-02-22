"use client";

/**
 * CRT scanline overlay — adds a retro pixel-art feel.
 *
 * Purely cosmetic: repeating horizontal lines with slight opacity.
 * Applied as an overlay on top of the battle arena.
 */
export default function Scanlines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
        zIndex: 20,
      }}
    />
  );
}
