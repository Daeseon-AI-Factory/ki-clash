"use client";

import { AnimationPanel } from "./AnimationPanel";
import type { AnimationAction, AnimationPhase } from "./types";

/**
 * Style 4: Emoji + Enhanced CSS
 *
 * Uses large emoji characters with layered CSS effects for battle animations.
 * Demonstrates that the existing emoji approach can look surprisingly good
 * with auras, particles, screen flashes, and motion effects.
 *
 * Zero external assets — pure CSS + emoji.
 */

// Character data inlined to keep this self-contained
const LEFT = { emoji: "🌀", name: "Haneul", color: "#60A5FA" };
const RIGHT = { emoji: "🔮", name: "Bora", color: "#C084FC" };

// Precompute particle positions to avoid hydration mismatch
// (Math.cos/sin can produce different float precision on server vs client)
const PARTICLE_KEYFRAMES = Array.from({ length: 6 }, (_, i) => {
  const angle = (i * 60 * Math.PI) / 180;
  const x = Math.round(Math.cos(angle) * 40);
  const y = Math.round(Math.sin(angle) * 40);
  return `@keyframes particle-fly-${i} {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(${x}px, ${y}px) scale(0); opacity: 0; }
  }`;
}).join("\n");

function Fighter({
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

  // Build dynamic style based on current action + phase
  const style: React.CSSProperties = {
    transition: "all 0.15s ease-out",
    position: "relative",
    display: "inline-block",
  };

  let auraStyle: React.CSSProperties = {};
  let particles: React.ReactNode = null;
  let effectOverlay: React.ReactNode = null;

  if (action && phase !== "idle") {
    // ---- CHARGE ----
    if (action === "charge" && isAttacker) {
      if (phase === "windup" || phase === "impact") {
        auraStyle = {
          boxShadow: `0 0 30px 15px ${char.color}66, 0 0 60px 30px ${char.color}33`,
          borderRadius: "50%",
        };
        style.transform = "scale(1.15)";
        style.filter = "brightness(1.3)";
        // Particle sparks
        particles = (
          <>
            {[...Array(6)].map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  backgroundColor: char.color,
                  top: "50%",
                  left: "50%",
                  animation: `particle-fly-${i} 0.5s ease-out forwards`,
                }}
              />
            ))}
          </>
        );
      }
      if (phase === "recover") {
        auraStyle = {
          boxShadow: `0 0 15px 8px ${char.color}33`,
          borderRadius: "50%",
        };
        style.transform = "scale(1.05)";
      }
    }

    // ---- BLOCK ----
    if (action === "block" && !isAttacker) {
      if (phase === "windup" || phase === "impact") {
        effectOverlay = (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 10 }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                border: `3px solid ${char.color}`,
                borderRadius: "50%",
                boxShadow: `0 0 20px ${char.color}88, inset 0 0 20px ${char.color}44`,
                animation: "shield-pulse 0.3s ease-in-out infinite alternate",
              }}
            />
          </div>
        );
        style.transform = "scale(0.95)";
      }
    }

    // ---- ATTACK ----
    if (action === "attack" && isAttacker) {
      if (phase === "windup") {
        style.transform = "translateX(-15px) scale(1.05)";
      }
      if (phase === "impact") {
        style.transform = `translateX(${side === "left" ? "60px" : "-60px"})`;
        style.filter = "brightness(1.2)";
      }
      if (phase === "recover") {
        style.transform = "translateX(0)";
      }
    }
    // Attack target gets hit
    if (action === "attack" && !isAttacker) {
      if (phase === "impact") {
        style.transform = "translateX(10px) rotate(5deg)";
        style.filter = "brightness(0.7)";
        effectOverlay = (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl" style={{ animation: "starburst 0.3s ease-out" }}>
              💥
            </span>
          </div>
        );
      }
      if (phase === "recover") {
        style.transform = "translateX(3px)";
      }
    }

    // ---- ENERGY WAVE ----
    if (action === "energyWave" && isAttacker) {
      if (phase === "windup") {
        auraStyle = {
          boxShadow: `0 0 40px 20px ${char.color}88`,
          borderRadius: "50%",
        };
        style.transform = "scale(1.1)";
        style.filter = "brightness(1.4)";
      }
      if (phase === "impact") {
        style.transform = "scale(0.95)";
      }
    }

    // ---- TELEPORT ----
    if (action === "teleport" && isAttacker) {
      if (phase === "windup") {
        style.opacity = 0.4;
        style.filter = "blur(4px)";
        style.transform = "scale(0.9)";
      }
      if (phase === "impact") {
        style.opacity = 0;
        style.filter = "blur(8px)";
        style.transform = "translateY(-20px) scale(0.5)";
      }
      if (phase === "recover") {
        style.opacity = 1;
        style.filter = "blur(0)";
        style.transform = `translateX(${side === "left" ? "40px" : "-40px"})`;
      }
    }
    // Teleport ghost appears near the defender (always on right side)
    if (action === "teleport" && !isAttacker && phase === "recover") {
      effectOverlay = (
        <div
          className="absolute text-5xl"
          style={{
            left: -30,
            opacity: 0.4,
            filter: "blur(2px)",
            animation: "fade-ghost 0.3s ease-out forwards",
          }}
        >
          {LEFT.emoji}
        </div>
      );
    }
  }

  return (
    <div className="relative flex flex-col items-center gap-1">
      {/* Aura glow layer */}
      <div className="relative" style={auraStyle}>
        <span className="text-5xl relative z-10" style={style}>
          {char.emoji}
        </span>
        {particles}
        {effectOverlay}
      </div>
      <span className="text-xs text-gray-400 mt-1">{char.name}</span>
    </div>
  );
}

/** Energy wave beam that flies across the arena */
function EnergyBeam({
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
      className="absolute left-1/4 top-1/2 -translate-y-1/2 h-6 rounded-full"
      style={{
        background: `linear-gradient(90deg, ${color}, white, ${color})`,
        boxShadow: `0 0 20px ${color}, 0 0 40px ${color}66`,
        animation: "beam-grow 0.3s ease-out forwards",
        transformOrigin: "left center",
      }}
    />
  );
}

/** Screen flash on big impacts */
function ScreenFlash({
  action,
  phase,
}: {
  action: AnimationAction | null;
  phase: AnimationPhase;
}) {
  if (phase !== "impact") return null;
  if (action !== "attack" && action !== "energyWave") return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundColor: "rgba(255,255,255,0.3)",
        animation: "flash-fade 0.2s ease-out forwards",
      }}
    />
  );
}

export function EmojiEnhancedPanel() {
  return (
    <AnimationPanel title="4. Emoji + Enhanced CSS" borderColor="#F472B6">
      {({ action, phase }) => (
        <>
          {/* Inline keyframes for this panel */}
          <style>{`
            @keyframes shield-pulse {
              from { transform: scale(1); opacity: 0.8; }
              to { transform: scale(1.1); opacity: 1; }
            }
            @keyframes starburst {
              0% { transform: scale(0) rotate(0deg); opacity: 1; }
              100% { transform: scale(1.5) rotate(45deg); opacity: 0; }
            }
            @keyframes beam-grow {
              0% { width: 0; opacity: 0.8; }
              100% { width: 50%; opacity: 1; }
            }
            @keyframes flash-fade {
              0% { opacity: 1; }
              100% { opacity: 0; }
            }
            @keyframes fade-ghost {
              0% { opacity: 0.6; transform: scale(1); }
              100% { opacity: 0; transform: scale(0.8); }
            }
            ${PARTICLE_KEYFRAMES}
          `}</style>

          <ScreenFlash action={action} phase={phase} />
          <EnergyBeam action={action} phase={phase} color={LEFT.color} />

          <div className="flex items-center justify-around w-full px-8">
            <Fighter
              char={LEFT}
              side="left"
              action={action}
              phase={phase}
            />

            {/* VS divider */}
            <span className="text-gray-600 text-sm font-bold">VS</span>

            <Fighter
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
