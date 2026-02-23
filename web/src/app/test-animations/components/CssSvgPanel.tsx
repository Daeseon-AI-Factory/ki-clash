"use client";

import { AnimationPanel } from "./AnimationPanel";
import type { AnimationAction, AnimationPhase } from "./types";

/**
 * Style 1: CSS/SVG Art
 *
 * Fighters built as inline SVG — circle head, rect body, rect arms/legs.
 * Radial gradient aura behind each fighter using character color.
 * All animations use CSS transforms applied via inline styles.
 *
 * Zero external assets — pure inline SVG + CSS.
 */

const LEFT = { name: "Haneul", color: "#60A5FA", accent: "#3B82F6" };
const RIGHT = { name: "Bora", color: "#C084FC", accent: "#A855F7" };

/** Stick-figure fighter as inline SVG */
function SvgFighter({
  color,
  accent,
  flip,
}: {
  color: string;
  accent: string;
  flip?: boolean;
}) {
  return (
    <svg
      width="60"
      height="80"
      viewBox="0 0 60 80"
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
    >
      {/* Head */}
      <circle cx="30" cy="14" r="10" fill={color} />
      {/* Eye */}
      <circle cx={flip ? 26 : 34} cy="12" r="2" fill="white" />
      {/* Body */}
      <rect x="24" y="24" width="12" height="24" rx="4" fill={accent} />
      {/* Left arm */}
      <rect
        x="10"
        y="26"
        width="14"
        height="6"
        rx="3"
        fill={color}
        className="svg-left-arm"
      />
      {/* Right arm */}
      <rect
        x="36"
        y="26"
        width="14"
        height="6"
        rx="3"
        fill={color}
        className="svg-right-arm"
      />
      {/* Left leg */}
      <rect x="22" y="48" width="7" height="20" rx="3" fill={accent} />
      {/* Right leg */}
      <rect x="31" y="48" width="7" height="20" rx="3" fill={accent} />
    </svg>
  );
}

function FighterContainer({
  char,
  side,
  action,
  phase,
}: {
  char: typeof LEFT;
  side: "left" | "right";
  action: AnimationAction | null;
  phase: AnimationPhase;
}) {
  const isAttacker = side === "left";

  const containerStyle: React.CSSProperties = {
    transition: "all 0.15s ease-out",
    position: "relative",
  };

  let auraOpacity = 0.2;
  let auraScale = 1;

  if (action && phase !== "idle") {
    // ---- CHARGE ----
    if (action === "charge" && isAttacker) {
      if (phase === "windup" || phase === "impact") {
        auraOpacity = 0.8;
        auraScale = 1.4;
        containerStyle.transform = "scale(1.1)";
      }
      if (phase === "recover") {
        auraOpacity = 0.4;
        auraScale = 1.2;
      }
    }

    // ---- BLOCK ----
    if (action === "block" && !isAttacker) {
      if (phase === "windup" || phase === "impact") {
        containerStyle.transform = "scale(0.9)";
        auraOpacity = 0.6;
      }
    }

    // ---- ATTACK ----
    if (action === "attack") {
      if (isAttacker) {
        if (phase === "windup")
          containerStyle.transform = "translateX(-12px) rotate(-5deg)";
        if (phase === "impact")
          containerStyle.transform = `translateX(${side === "left" ? 50 : -50}px)`;
        if (phase === "recover") containerStyle.transform = "translateX(0)";
      } else {
        if (phase === "impact") {
          containerStyle.transform = "translateX(8px) rotate(3deg)";
          containerStyle.filter = "brightness(0.6)";
        }
      }
    }

    // ---- ENERGY WAVE ----
    if (action === "energyWave") {
      if (isAttacker) {
        if (phase === "windup") {
          containerStyle.transform = "scale(1.15)";
          auraOpacity = 0.9;
          auraScale = 1.5;
        }
        if (phase === "impact") {
          containerStyle.transform = "scale(0.9) translateX(-5px)";
        }
      } else {
        if (phase === "impact") {
          containerStyle.transform = "translateX(15px)";
          containerStyle.filter = "brightness(0.5)";
        }
      }
    }

    // ---- TELEPORT ----
    if (action === "teleport" && isAttacker) {
      if (phase === "windup") {
        containerStyle.opacity = 0.5;
        containerStyle.transform = "scale(0.8)";
      }
      if (phase === "impact") {
        containerStyle.opacity = 0;
        containerStyle.transform = "translateY(-30px) scale(0.3)";
      }
      if (phase === "recover") {
        containerStyle.opacity = 1;
        containerStyle.transform = "translateX(50px)";
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-1" style={containerStyle}>
      {/* Radial aura */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full -m-4"
          style={{
            background: `radial-gradient(circle, ${char.color}${Math.round(auraOpacity * 255)
              .toString(16)
              .padStart(2, "0")} 0%, transparent 70%)`,
            transform: `scale(${auraScale})`,
            transition: "all 0.2s ease-out",
          }}
        />
        <SvgFighter
          color={char.color}
          accent={char.accent}
          flip={side === "right"}
        />
      </div>
      <span className="text-xs text-gray-400">{char.name}</span>
    </div>
  );
}

/** SVG energy beam */
function SvgBeam({
  action,
  phase,
  color,
}: {
  action: AnimationAction | null;
  phase: AnimationPhase;
  color: string;
}) {
  if (action !== "energyWave" || phase !== "impact") return null;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2"
      style={{ left: "28%", zIndex: 5 }}
    >
      <svg width="200" height="24" style={{ animation: "svg-beam-grow 0.3s ease-out forwards" }}>
        <defs>
          <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="50%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <rect
          x="0"
          y="4"
          width="200"
          height="16"
          rx="8"
          fill="url(#beamGrad)"
        />
        {/* Core bright line */}
        <rect x="0" y="9" width="200" height="6" rx="3" fill="white" opacity="0.7" />
      </svg>
    </div>
  );
}

/** Block shield SVG overlay */
function SvgShield({
  action,
  phase,
  color,
}: {
  action: AnimationAction | null;
  phase: AnimationPhase;
  color: string;
}) {
  if (action !== "block" || (phase !== "windup" && phase !== "impact"))
    return null;

  return (
    <div
      className="absolute flex items-center justify-center"
      style={{ right: "18%", top: "25%", zIndex: 5 }}
    >
      <svg width="50" height="60" style={{ animation: "svg-shield-in 0.2s ease-out" }}>
        <ellipse
          cx="25"
          cy="30"
          rx="22"
          ry="28"
          fill="none"
          stroke={color}
          strokeWidth="3"
          opacity="0.8"
        />
        <ellipse
          cx="25"
          cy="30"
          rx="16"
          ry="20"
          fill={color}
          opacity="0.15"
        />
      </svg>
    </div>
  );
}

/** Impact flash */
function ImpactFlash({
  action,
  phase,
}: {
  action: AnimationAction | null;
  phase: AnimationPhase;
}) {
  if (phase !== "impact" || (action !== "attack" && action !== "energyWave"))
    return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundColor: "rgba(255,255,255,0.25)",
        animation: "svg-flash 0.15s ease-out forwards",
      }}
    />
  );
}

export function CssSvgPanel() {
  return (
    <AnimationPanel title="1. CSS / SVG Art" borderColor="#60A5FA">
      {({ action, phase }) => (
        <>
          <style>{`
            @keyframes svg-beam-grow {
              0% { transform: scaleX(0); opacity: 0; }
              100% { transform: scaleX(1); opacity: 1; }
            }
            @keyframes svg-shield-in {
              0% { transform: scale(0); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes svg-flash {
              0% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>

          <ImpactFlash action={action} phase={phase} />
          <SvgBeam action={action} phase={phase} color={LEFT.color} />
          <SvgShield action={action} phase={phase} color={RIGHT.color} />

          <div className="flex items-center justify-around w-full px-6">
            <FighterContainer
              char={LEFT}
              side="left"
              action={action}
              phase={phase}
            />
            <span className="text-gray-600 text-sm font-bold">VS</span>
            <FighterContainer
              char={RIGHT}
              side="right"
              action={action}
              phase={phase}
            />
          </div>
        </>
      )}
    </AnimationPanel>
  );
}
