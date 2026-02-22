"use client";

import type { PixelAction, PixelPhase } from "@/lib/pixel-art-types";
import { DEFAULT_PX } from "@/lib/pixel-art-utils";

const W = "#ffffff";

interface EffectProps {
  action: PixelAction | null;
  phase: PixelPhase;
  color: string;
}

/**
 * Pixel-art energy beam — a growing block of bright pixels.
 * Only renders during energyWave impact phase.
 */
export function PixelBeam({ action, phase, color }: EffectProps) {
  if (action !== "energyWave" || phase !== "impact") return null;

  const PX = DEFAULT_PX;
  const beamPixels: string[] = [];
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 3; j++) {
      beamPixels.push(`${i * PX}px ${j * PX}px 0 ${i % 2 === 0 ? color : W}`);
    }
  }

  return (
    <div
      className="absolute"
      style={{
        left: "30%",
        top: "46%",
        zIndex: 5,
        animation: "pixel-beam-grow 0.3s steps(4) forwards",
      }}
    >
      <div
        style={{
          width: PX,
          height: PX,
          boxShadow: beamPixels.join(", "),
        }}
      />
    </div>
  );
}

/**
 * Pixel block shield — a column of colored pixels.
 * Only renders during block windup/impact phases.
 */
export function PixelShield({ action, phase, color }: EffectProps) {
  if (action !== "block" || (phase !== "windup" && phase !== "impact")) return null;

  const PX = DEFAULT_PX;
  const shieldPixels: string[] = [];
  for (let y = 0; y < 10; y++) {
    shieldPixels.push(`0px ${y * PX}px 0 ${color}`);
    shieldPixels.push(`${PX}px ${y * PX}px 0 ${y % 2 === 0 ? W : color}`);
  }

  return (
    <div
      className="absolute"
      style={{
        right: "25%",
        top: "30%",
        zIndex: 5,
        animation: "pixel-shield-in 0.15s steps(2) forwards",
      }}
    >
      <div
        style={{
          width: PX,
          height: PX,
          boxShadow: shieldPixels.join(", "),
        }}
      />
    </div>
  );
}

/**
 * Full-screen flash on impact — white overlay that fades out.
 * Only renders during attack/energyWave impact phase.
 */
export function PixelFlash({
  action,
  phase,
}: {
  action: PixelAction | null;
  phase: PixelPhase;
}) {
  if (phase !== "impact" || (action !== "attack" && action !== "energyWave")) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundColor: "rgba(255,255,255,0.4)",
        animation: "pixel-flash 0.15s steps(2) forwards",
        zIndex: 15,
      }}
    />
  );
}
