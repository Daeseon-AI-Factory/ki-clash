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
 * Energy ball — glowing orb that charges during windup before beam fires.
 * Only renders during energyWave windup phase.
 */
export function PixelEnergyBall({ action, phase, color, side = "left" }: EffectProps) {
  if (action !== "energyWave" || phase !== "windup") return null;

  const isLeft = side === "left";

  return (
    <div
      className="absolute"
      style={{
        left: isLeft ? "28%" : undefined,
        right: isLeft ? undefined : "28%",
        top: "38%",
        zIndex: 6,
        animation: "pixel-energy-ball 0.6s ease-in-out infinite",
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${W} 20%, ${color} 50%, transparent 70%)`,
          boxShadow: `0 0 12px 4px ${color}, 0 0 24px 8px ${color}40`,
        }}
      />
    </div>
  );
}

/**
 * Pixel-art energy beam — wide beam that fires across the arena.
 * Only renders during energyWave impact phase.
 */
export function PixelBeam({ action, phase, color, side = "left" }: EffectProps) {
  if (action !== "energyWave" || (phase !== "impact" && phase !== "recover")) return null;

  const isLeft = side === "left";

  return (
    <div
      className="absolute"
      style={{
        left: isLeft ? "20%" : undefined,
        right: isLeft ? undefined : "20%",
        top: "36%",
        width: "60%",
        zIndex: 5,
        animation: "pixel-beam-grow 0.6s cubic-bezier(0, 0, 0.2, 1) forwards",
        transform: isLeft ? undefined : "scaleX(-1)",
      }}
    >
      {/* Main beam body */}
      <div
        style={{
          height: 8,
          background: `linear-gradient(90deg, ${W}, ${color} 20%, ${color} 80%, ${W})`,
          boxShadow: `0 0 8px 2px ${color}, 0 0 20px 4px ${color}60`,
          borderRadius: 4,
        }}
      />
      {/* Core glow line */}
      <div
        style={{
          height: 3,
          marginTop: -5,
          marginLeft: "5%",
          marginRight: "5%",
          background: W,
          borderRadius: 2,
          opacity: 0.8,
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

/**
 * Victory sparkles — golden particles bursting around the winner.
 */
export function PixelVictoryBurst({ action, phase, color, side = "left" }: EffectProps) {
  if (action !== "victory" || phase === "idle") return null;

  const isLeft = side === "left";
  const gold = "#FFD700";

  return (
    <>
      {/* Burst particles */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: isLeft ? `${18 + i * 5}%` : undefined,
            right: isLeft ? undefined : `${18 + i * 5}%`,
            top: `${20 + (i % 3) * 12}%`,
            zIndex: 6,
            animation: `pixel-victory-sparkle 1s ease-out ${i * 0.1}s infinite`,
          }}
        >
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: i % 2 === 0 ? gold : color,
              boxShadow: `0 0 6px 2px ${i % 2 === 0 ? gold : color}`,
            }}
          />
        </div>
      ))}
    </>
  );
}

/**
 * Defeat impact — dark overlay and smoke around the loser.
 */
export function PixelDefeatSmoke({ action, phase, side = "left" }: {
  action: PixelAction | null;
  phase: PixelPhase;
  side?: "left" | "right";
}) {
  if (action !== "defeat" || phase === "idle" || phase === "windup") return null;

  const isLeft = side === "left";

  return (
    <div
      className="absolute"
      style={{
        left: isLeft ? "15%" : undefined,
        right: isLeft ? undefined : "15%",
        top: "40%",
        zIndex: 4,
        animation: "pixel-defeat-smoke 1.2s ease-out forwards",
      }}
    >
      <div
        style={{
          width: 40,
          height: 30,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(100,100,100,0.4) 30%, transparent 70%)",
        }}
      />
    </div>
  );
}
