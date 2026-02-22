"use client";

import { useMemo } from "react";
import type { PixelAction, PixelPhase } from "@/lib/pixel-art-types";
import { frameToBoxShadow, frameDimensions, DEFAULT_PX } from "@/lib/pixel-art-utils";
import { getFrame } from "@/lib/pixel-frames";

interface PixelFighterProps {
  /** Character ID */
  characterId: string;
  /** Which side of the arena ("left" = attacker, "right" = defender) */
  side: "left" | "right";
  /** Current action being animated */
  action: PixelAction | null;
  /** Current animation phase */
  phase: PixelPhase;
  /** Pixel size multiplier */
  px?: number;
  /** Character display name */
  name?: string;
}

/**
 * Animated pixel fighter — applies CSS transforms based on action/phase.
 *
 * This is the prototype's PixelFighter extracted into a reusable component.
 * The sprite itself stays the same (idle frame); animation comes from
 * transforms (translate, scale, opacity) applied per action+phase.
 */
export default function PixelFighter({
  characterId,
  side,
  action,
  phase,
  px = DEFAULT_PX,
  name,
}: PixelFighterProps) {
  const frame = useMemo(() => getFrame(characterId), [characterId]);
  const shadow = useMemo(
    () => (frame ? frameToBoxShadow(frame, px) : ""),
    [frame, px]
  );
  const dims = useMemo(
    () => (frame ? frameDimensions(frame) : { width: 12, height: 16 }),
    [frame]
  );

  if (!frame) return null;

  const isAttacker = side === "left";

  const wrapperStyle: React.CSSProperties = {
    width: dims.width * px,
    height: dims.height * px,
    position: "relative",
    transition: "all 0.15s ease-out",
  };

  // Build transform list — right-side fighters are mirrored
  const transforms: string[] = side === "right" ? ["scaleX(-1)"] : [];

  if (action && phase !== "idle") {
    if (action === "charge" && isAttacker) {
      if (phase === "windup" || phase === "impact") transforms.push("scale(1.3)");
      if (phase === "recover") transforms.push("scale(1.1)");
    }

    if (action === "block" && !isAttacker) {
      if (phase === "windup" || phase === "impact") transforms.push("scale(0.9)");
    }

    if (action === "attack") {
      if (isAttacker) {
        if (phase === "windup") transforms.push("translateX(-8px)");
        if (phase === "impact") transforms.push("translateX(40px)");
        if (phase === "recover") transforms.push("translateX(0)");
      } else {
        if (phase === "impact") transforms.push("translateX(6px)");
      }
    }

    if (action === "energyWave" && isAttacker) {
      if (phase === "windup") transforms.push("scale(1.2)");
      if (phase === "impact") transforms.push("scale(0.9)");
    }

    if (action === "teleport" && isAttacker) {
      if (phase === "windup") wrapperStyle.opacity = 0.4;
      if (phase === "impact") {
        wrapperStyle.opacity = 0;
        transforms.push("translateY(-20px)");
      }
      if (phase === "recover") {
        wrapperStyle.opacity = 1;
        transforms.push("translateX(30px)");
      }
    }
  }

  wrapperStyle.transform = transforms.join(" ") || undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={wrapperStyle}>
        <div
          style={{
            width: px,
            height: px,
            boxShadow: shadow,
            transition: "all 0.15s ease-out",
          }}
        />
      </div>
      {name && (
        <span
          className="text-xs text-gray-400"
          style={{ fontFamily: "monospace" }}
        >
          {name}
        </span>
      )}
    </div>
  );
}
