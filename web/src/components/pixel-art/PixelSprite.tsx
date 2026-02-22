"use client";

import { useMemo } from "react";
import type { PixelFrame } from "@/lib/pixel-art-types";
import { frameToBoxShadow, frameDimensions, DEFAULT_PX } from "@/lib/pixel-art-utils";

interface PixelSpriteProps {
  /** 2D pixel grid to render */
  frame: PixelFrame;
  /** Pixel size multiplier (default: 3) */
  px?: number;
  /** Mirror horizontally (for right-side fighters) */
  flip?: boolean;
  /** Additional inline styles on the wrapper div */
  style?: React.CSSProperties;
  /** Additional CSS class on the wrapper div */
  className?: string;
}

/**
 * Atomic pixel art renderer.
 *
 * Renders a PixelFrame as a 1×1px div with CSS box-shadow.
 * This is the lowest-level building block — all other pixel art
 * components compose on top of this.
 */
export default function PixelSprite({
  frame,
  px = DEFAULT_PX,
  flip = false,
  style,
  className,
}: PixelSpriteProps) {
  // Memoize the box-shadow string (expensive to compute on every render)
  const shadow = useMemo(() => frameToBoxShadow(frame, px), [frame, px]);
  const dims = useMemo(() => frameDimensions(frame), [frame]);

  return (
    <div
      className={className}
      style={{
        width: dims.width * px,
        height: dims.height * px,
        position: "relative",
        transform: flip ? "scaleX(-1)" : undefined,
        ...style,
      }}
    >
      <div
        style={{
          width: px,
          height: px,
          boxShadow: shadow,
        }}
      />
    </div>
  );
}
