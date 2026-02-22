"use client";

import { useMemo } from "react";
import { getFrame } from "@/lib/pixel-frames";
import PixelSprite from "./PixelSprite";

interface PixelPortraitProps {
  /** Character ID (e.g., "haneul", "bora") */
  characterId: string;
  /** Display size preset */
  size?: "sm" | "md" | "lg";
  /** Additional CSS class */
  className?: string;
}

/** Pixel size multiplier for each size preset */
const SIZE_PX: Record<string, number> = {
  sm: 2,
  md: 3,
  lg: 4,
};

/**
 * Static pixel art portrait for a character.
 *
 * Looks up the idle frame by character ID and renders it at the given size.
 * Use this anywhere you'd show a character avatar — select screen, HUD, trash talk.
 */
export default function PixelPortrait({
  characterId,
  size = "md",
  className,
}: PixelPortraitProps) {
  const frame = useMemo(() => getFrame(characterId), [characterId]);
  const px = SIZE_PX[size] ?? SIZE_PX.md;

  if (!frame) return null;

  return (
    <PixelSprite
      frame={frame}
      px={px}
      className={className}
    />
  );
}
