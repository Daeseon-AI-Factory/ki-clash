"use client";

import type { PixelAction, PixelPhase } from "@/lib/pixel-art-types";
import { DEFAULT_PX } from "@/lib/pixel-art-utils";

const W = "#ffffff";

interface EffectProps {
  action: PixelAction | null;
  phase: PixelPhase;
  color: string;
  /** Which side of the arena this effect belongs to */
  side?: "left" | "right";
}

/**
 * Pixel-art energy beam — a growing block of bright pixels.
 * Only renders during energyWave impact phase.
 */
export function PixelBeam({ action, phase, color, side = "left" }: EffectProps) {
  if (action !== "energyWave" || phase !== "impact") return null;

  const PX = DEFAULT_PX;
  const beamPixels: string[] = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 4; j++) {
      const c = (i + j) % 3 === 0 ? W : color;
      beamPixels.push(`${i * PX}px ${j * PX}px 0 ${c}`);
    }
  }

  const isLeft = side === "left";

  return (
    <div
      className="absolute"
      style={{
        left: isLeft ? "25%" : undefined,
        right: isLeft ? undefined : "25%",
        top: "44%",
        zIndex: 5,
        animation: "pixel-beam-grow 0.4s steps(6) forwards",
        transform: isLeft ? undefined : "scaleX(-1)",
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
export function PixelShield({ action, phase, color, side = "right" }: EffectProps) {
  if (action !== "block" || (phase !== "windup" && phase !== "impact")) return null;

  const PX = DEFAULT_PX;
  const shieldPixels: string[] = [];
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 2; x++) {
      shieldPixels.push(`${x * PX}px ${y * PX}px 0 ${(x + y) % 2 === 0 ? W : color}`);
    }
  }

  const isLeft = side === "left";

  return (
    <div
      className="absolute"
      style={{
        left: isLeft ? "30%" : undefined,
        right: isLeft ? undefined : "30%",
        top: "25%",
        zIndex: 5,
        animation: "pixel-shield-in 0.25s steps(3) forwards",
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
 * Triggers on any attack/energyWave impact.
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
        backgroundColor:
          action === "energyWave"
            ? "rgba(255,255,255,0.5)"
            : "rgba(255,255,255,0.35)",
        animation: "pixel-flash 0.2s steps(3) forwards",
        zIndex: 15,
      }}
    />
  );
}

/**
 * Charge aura — pulsing particles around the charging fighter.
 * Only renders during charge windup/impact phases.
 */
export function PixelChargeAura({ action, phase, color, side = "left" }: EffectProps) {
  if (action !== "charge" || (phase !== "windup" && phase !== "impact")) return null;

  const PX = DEFAULT_PX;
  const particles: string[] = [];
  // Scattered energy particles around the fighter
  const offsets = [
    [-2, -3], [3, -4], [-3, 2], [4, 1], [0, -5], [-4, -1], [5, -2], [1, 3],
    [-1, -6], [4, -5], [-5, 0], [2, -7],
  ];
  for (const [x, y] of offsets) {
    particles.push(`${x * PX}px ${y * PX}px 0 ${Math.random() > 0.5 ? color : W}`);
  }

  const isLeft = side === "left";

  return (
    <div
      className="absolute"
      style={{
        left: isLeft ? "22%" : undefined,
        right: isLeft ? undefined : "22%",
        top: "35%",
        zIndex: 5,
        animation: "pixel-charge-pulse 0.5s steps(4) infinite",
      }}
    >
      <div
        style={{
          width: PX,
          height: PX,
          boxShadow: particles.join(", "),
        }}
      />
    </div>
  );
}

/**
 * Teleport afterimage — fading ghost sprite at original position.
 * Only renders during teleport impact phase.
 */
export function PixelTeleportTrail({ action, phase, side = "left" }: {
  action: PixelAction | null;
  phase: PixelPhase;
  side?: "left" | "right";
}) {
  if (action !== "teleport" || (phase !== "impact" && phase !== "recover")) return null;

  const isLeft = side === "left";

  return (
    <div
      className="absolute"
      style={{
        left: isLeft ? "22%" : undefined,
        right: isLeft ? undefined : "22%",
        top: "30%",
        zIndex: 4,
        animation: "pixel-teleport-ghost 0.4s ease-out forwards",
      }}
    >
      <div
        className="w-6 h-8 rounded-sm"
        style={{
          background: `linear-gradient(135deg, rgba(168,85,247,0.4), rgba(168,85,247,0))`,
        }}
      />
    </div>
  );
}
