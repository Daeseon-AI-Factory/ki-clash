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

  const wrapperStyle: React.CSSProperties = {
    width: dims.width * px,
    height: dims.height * px,
    position: "relative",
  };

  // Build transform list — right-side fighters are mirrored
  const transforms: string[] = side === "right" ? ["scaleX(-1)"] : [];

  // Phase-based transition timing for dynamic feel
  if (phase === "windup") {
    wrapperStyle.transition = "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"; // overshoot
  } else if (phase === "impact") {
    wrapperStyle.transition = "all 0.15s cubic-bezier(0, 0, 0.2, 1)"; // snap fast
  } else if (phase === "recover") {
    wrapperStyle.transition = "all 0.6s cubic-bezier(0.22, 1, 0.36, 1)"; // ease out
  } else {
    wrapperStyle.transition = "all 0.4s ease-out";
  }

  // Each fighter animates their own action independently
  if (action && phase !== "idle") {
    switch (action) {
      case "charge":
        if (phase === "windup") {
          transforms.push("translateY(8px)", "scale(0.85)"); // crouch to gather energy
        }
        if (phase === "impact") {
          transforms.push("translateY(-12px)", "scale(1.4)"); // burst upward with power
        }
        if (phase === "recover") {
          transforms.push("translateY(-2px)", "scale(1.1)"); // float down, still powered
        }
        break;

      case "block":
        if (phase === "windup") {
          transforms.push("translateY(6px)", "translateX(-6px)", "scale(0.8)", "rotate(-5deg)"); // crouch & brace
        }
        if (phase === "impact") {
          transforms.push("translateY(4px)", "translateX(-10px)", "scale(0.75)", "rotate(-8deg)"); // absorb hit
        }
        if (phase === "recover") {
          transforms.push("translateY(2px)", "scale(0.95)"); // stand back up
        }
        break;

      case "attack":
        if (phase === "windup") {
          transforms.push("translateX(-20px)", "translateY(6px)", "rotate(-12deg)"); // big pullback, crouch
        }
        if (phase === "impact") {
          transforms.push("translateX(55px)", "translateY(-8px)", "rotate(6deg)"); // lunge forward, leap
        }
        if (phase === "recover") {
          transforms.push("translateX(12px)", "translateY(2px)", "rotate(2deg)"); // land & bounce back
        }
        break;

      case "energyWave":
        if (phase === "windup") {
          transforms.push("translateX(-10px)", "translateY(-6px)", "scale(1.3)", "rotate(-6deg)"); // lean back, power up
        }
        if (phase === "impact") {
          transforms.push("translateX(-14px)", "translateY(4px)", "scale(0.8)", "rotate(4deg)"); // recoil from blast
        }
        if (phase === "recover") {
          transforms.push("translateX(-4px)", "scale(1.05)"); // settle
        }
        break;

      case "teleport":
        if (phase === "windup") {
          wrapperStyle.opacity = 0.3;
          transforms.push("scale(0.6)", "translateY(-14px)", "rotate(15deg)"); // phase out, spin
        }
        if (phase === "impact") {
          wrapperStyle.opacity = 0;
          transforms.push("scale(0.3)", "translateY(-40px)", "rotate(30deg)"); // vanish upward
        }
        if (phase === "recover") {
          wrapperStyle.opacity = 1;
          transforms.push("translateX(40px)", "translateY(6px)", "scale(1.15)", "rotate(-5deg)"); // reappear behind, land
        }
        break;
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
            transition: "all 0.4s ease-out",
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
