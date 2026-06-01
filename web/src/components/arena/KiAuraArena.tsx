"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ActionKind, ActionPhase } from "@/lib/actions";
import { getCharacter, type Character } from "@/lib/characters";

/**
 * Anime ki-aura battle arena — the visual centerpiece during play/reveal.
 *
 * Replaces the deprecated pixel-art BattleArena. No external sprite assets:
 * characters render as their roster emoji wrapped in a layered animated
 * aura (radial blur + rotating conic gradient + idle pulse). The action
 * FX layer paints the move-specific effect on top during the windup →
 * impact → recover lifecycle driven by `useActionAnimation`.
 *
 * Aesthetic target: commercial-grade anime / Dragon Ball ki-blast vibe,
 * achievable without artwork.
 *
 * # CORE_CANDIDATE — generic "two-fighter arena" template. Swap the
 *   character props + action set and it works for any 1v1 game.
 */

interface KiAuraArenaProps {
  playerCharacterId: string;
  aiCharacterId: string;
  playerAction?: ActionKind | null;
  aiAction?: ActionKind | null;
  phase?: ActionPhase;
}

export default function KiAuraArena({
  playerCharacterId,
  aiCharacterId,
  playerAction = null,
  aiAction = null,
  phase = "idle",
}: KiAuraArenaProps) {
  const player = useMemo(() => getCharacter(playerCharacterId), [playerCharacterId]);
  const ai = useMemo(() => getCharacter(aiCharacterId), [aiCharacterId]);

  if (!player || !ai) return null;

  return (
    <div className="relative w-full max-w-2xl mx-auto h-56 sm:h-64 rounded-2xl overflow-hidden border border-gray-700/60 shadow-2xl">
      {/* Background — animated gradient sky + parallax stars + ground glow */}
      <ArenaBackground />

      {/* Fighters — silhouettes with auras */}
      <div className="absolute inset-0 flex items-end justify-between px-6 sm:px-10 pb-8">
        <FighterSilhouette
          character={player}
          action={playerAction}
          phase={phase}
          side="left"
        />
        <FighterSilhouette
          character={ai}
          action={aiAction}
          phase={phase}
          side="right"
          flip
        />
      </div>

      {/* Cross-screen FX layer (energy wave beam) */}
      <CrossScreenFX
        playerAction={playerAction}
        aiAction={aiAction}
        phase={phase}
        playerColor={player.color}
        aiColor={ai.color}
      />

      {/* Top + bottom vignette for depth */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/30" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated background — gradient sky + drifting particles + glow ground.

function ArenaBackground() {
  return (
    <>
      {/* Gradient sky — slowly shifts hue using CSS background animation */}
      <div className="absolute inset-0 animate-sky-shift" />

      {/* Star/dust particles — fixed positions, varying twinkle */}
      <div className="absolute inset-0 pointer-events-none">
        {STAR_POSITIONS.map((pos, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-twinkle"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: pos.size,
              height: pos.size,
              opacity: pos.opacity,
              animationDelay: `${pos.delay}s`,
              animationDuration: `${pos.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Ground glow strip */}
      <div className="absolute left-0 right-0 bottom-0 h-16 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(251,146,60,0.25), transparent)",
        }}
      />

      {/* Horizon line */}
      <div className="absolute left-0 right-0 bottom-16 h-px bg-orange-400/40 pointer-events-none" />
    </>
  );
}

// Pre-computed star field — fixed array so SSR + CSR match without random seeds.
const STAR_POSITIONS = [
  { x: 8, y: 15, size: 2, opacity: 0.7, delay: 0, duration: 3 },
  { x: 22, y: 8, size: 1, opacity: 0.5, delay: 0.5, duration: 4 },
  { x: 35, y: 22, size: 3, opacity: 0.8, delay: 1, duration: 3.5 },
  { x: 48, y: 12, size: 1, opacity: 0.4, delay: 1.5, duration: 5 },
  { x: 62, y: 18, size: 2, opacity: 0.6, delay: 2, duration: 4 },
  { x: 78, y: 6, size: 1, opacity: 0.5, delay: 0.3, duration: 3.2 },
  { x: 88, y: 24, size: 2, opacity: 0.7, delay: 1.8, duration: 4.5 },
  { x: 15, y: 32, size: 1, opacity: 0.4, delay: 0.8, duration: 3.8 },
  { x: 55, y: 28, size: 2, opacity: 0.6, delay: 2.5, duration: 4.2 },
  { x: 70, y: 35, size: 1, opacity: 0.5, delay: 1.2, duration: 3.6 },
  { x: 92, y: 40, size: 2, opacity: 0.6, delay: 0.6, duration: 4.8 },
  { x: 5, y: 45, size: 1, opacity: 0.4, delay: 2.2, duration: 3.4 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Fighter silhouette — character emoji + layered ki aura + per-action FX.

interface FighterSilhouetteProps {
  character: Character;
  action: ActionKind | null;
  phase: ActionPhase;
  side: "left" | "right";
  flip?: boolean;
}

function FighterSilhouette({
  character,
  action,
  phase,
  side,
  flip = false,
}: FighterSilhouetteProps) {
  const isAnimating = phase !== "idle";

  // Translate the fighter forward on attack impact / back on teleport windup.
  const offsetX = (() => {
    if (action === "attack" && phase === "impact") {
      return side === "left" ? 40 : -40;
    }
    if (action === "teleport" && phase === "impact") {
      return side === "left" ? -20 : 20;
    }
    return 0;
  })();

  const scale = (() => {
    if (phase === "windup") return 0.96;
    if (phase === "impact") return 1.08;
    if (phase === "recover") return 1.02;
    return 1;
  })();

  // Teleport hides the fighter briefly on impact.
  const opacity = action === "teleport" && phase === "impact" ? 0.15 : 1;

  return (
    <div className="relative flex flex-col items-center gap-1">
      <motion.div
        className="relative flex items-center justify-center"
        animate={{ x: offsetX, scale, opacity }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Outer aura halo — character-colored */}
        <div
          className={`absolute rounded-full ${isAnimating ? "animate-aura-pulse-fast" : "animate-aura-pulse"}`}
          style={{
            width: 140,
            height: 140,
            background: `radial-gradient(circle, ${character.color}cc 0%, ${character.color}55 40%, transparent 70%)`,
            filter: "blur(14px)",
          }}
        />
        {/* Rotating inner aura ring */}
        <div
          className="absolute rounded-full animate-aura-rotate"
          style={{
            width: 110,
            height: 110,
            background: `conic-gradient(from 0deg, transparent, ${character.color}aa, transparent, ${character.color}88, transparent)`,
            filter: "blur(4px)",
          }}
        />
        {/* Character emoji — mirrored on right side */}
        <span
          className="relative select-none idle-bob"
          style={{
            fontSize: 80,
            transform: flip ? "scaleX(-1)" : undefined,
            filter: `drop-shadow(0 0 12px ${character.color}) drop-shadow(0 6px 8px rgba(0,0,0,0.5))`,
            lineHeight: 1,
          }}
        >
          {character.emoji}
        </span>
      </motion.div>

      {/* Per-action FX overlay */}
      <ActionFXOverlay
        action={action}
        phase={phase}
        color={character.color}
        side={side}
      />

      <span
        className="relative text-xs font-medium text-white/80 mt-1 select-none"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
      >
        {character.name}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-action local FX (charge sparks, attack lines, teleport flash, block shield).
// The energy-wave beam crosses the screen — handled by <CrossScreenFX> instead.

interface ActionFXProps {
  action: ActionKind | null;
  phase: ActionPhase;
  color: string;
  side: "left" | "right";
}

function ActionFXOverlay({ action, phase, color, side }: ActionFXProps) {
  if (!action || phase === "idle") return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {action === "charge" && <ChargeFX phase={phase} color={color} />}
      {action === "block" && <BlockFX phase={phase} />}
      {action === "attack" && <AttackFX phase={phase} side={side} />}
      {action === "teleport" && <TeleportFX phase={phase} />}
      {action === "energyWave" && <EnergyChargeFX phase={phase} color={color} />}
    </div>
  );
}

function ChargeFX({ phase, color }: { phase: ActionPhase; color: string }) {
  // 6 motes converging from a circle around the fighter toward center.
  const motes = [0, 60, 120, 180, 240, 300];
  return (
    <AnimatePresence>
      {(phase === "windup" || phase === "impact") && (
        <motion.div
          key="charge"
          className="absolute inset-0 flex items-center justify-center"
          exit={{ opacity: 0 }}
        >
          {motes.map((deg, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 12,
                height: 12,
                background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                filter: `drop-shadow(0 0 8px ${color})`,
              }}
              initial={{
                x: Math.cos((deg * Math.PI) / 180) * 90,
                y: Math.sin((deg * Math.PI) / 180) * 90,
                opacity: 0,
                scale: 0.5,
              }}
              animate={{ x: 0, y: 0, opacity: 1, scale: 1.4 }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: "easeIn" }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BlockFX({ phase }: { phase: ActionPhase }) {
  // Hexagonal shield that scales in and pulses.
  return (
    <AnimatePresence>
      {(phase === "impact" || phase === "recover") && (
        <motion.div
          key="block"
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.9, scale: 1 }}
          exit={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.3 }}
        >
          <svg width="120" height="120" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            <polygon
              points="60,5 110,32 110,88 60,115 10,88 10,32"
              fill="url(#shieldGrad)"
              stroke="#93C5FD"
              strokeWidth="2"
              style={{ filter: "drop-shadow(0 0 12px #60A5FA)" }}
            />
            <polygon
              points="60,5 110,32 110,88 60,115 10,88 10,32"
              fill="none"
              stroke="white"
              strokeWidth="1"
              opacity="0.6"
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AttackFX({ phase, side }: { phase: ActionPhase; side: "left" | "right" }) {
  // Red speed lines + impact slash.
  return (
    <AnimatePresence>
      {phase === "impact" && (
        <motion.div
          key="attack"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Diagonal slash mark */}
          <div
            className="absolute"
            style={{
              width: 160,
              height: 8,
              background: "linear-gradient(90deg, transparent, #FCA5A5, #DC2626, #FCA5A5, transparent)",
              transform: `rotate(${side === "left" ? -15 : 15}deg)`,
              filter: "drop-shadow(0 0 8px #EF4444) blur(0.5px)",
            }}
          />
          {/* Speed lines radiating */}
          {[-30, -15, 0, 15, 30].map((deg) => (
            <div
              key={deg}
              className="absolute"
              style={{
                width: 80,
                height: 2,
                background: "linear-gradient(90deg, transparent, white, transparent)",
                transform: `rotate(${deg}deg) translateX(${side === "left" ? 30 : -30}px)`,
                opacity: 0.7,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TeleportFX({ phase }: { phase: ActionPhase }) {
  return (
    <AnimatePresence>
      {(phase === "impact" || phase === "recover") && (
        <motion.div
          key="teleport"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 1, scale: 0.8 }}
          animate={{ opacity: 0, scale: 1.5 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="rounded-full"
            style={{
              width: 100,
              height: 100,
              background: "radial-gradient(circle, white 0%, #A78BFA 30%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EnergyChargeFX({ phase, color }: { phase: ActionPhase; color: string }) {
  // Energy ball forming during windup — the beam itself is rendered by CrossScreenFX.
  return (
    <AnimatePresence>
      {phase === "windup" && (
        <motion.div
          key="energy-charge"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="rounded-full animate-energy-ball"
            style={{
              width: 60,
              height: 60,
              background: `radial-gradient(circle, white 0%, ${color} 40%, #F97316 70%, transparent 100%)`,
              filter: `drop-shadow(0 0 24px ${color}) drop-shadow(0 0 48px #F97316)`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-screen energy beam — fires from one fighter to the other on impact.

function CrossScreenFX({
  playerAction,
  aiAction,
  phase,
  playerColor,
  aiColor,
}: {
  playerAction: ActionKind | null;
  aiAction: ActionKind | null;
  phase: ActionPhase;
  playerColor: string;
  aiColor: string;
}) {
  const playerBeam = playerAction === "energyWave" && phase === "impact";
  const aiBeam = aiAction === "energyWave" && phase === "impact";

  return (
    <AnimatePresence>
      {playerBeam && (
        <motion.div
          key="player-beam"
          className="absolute left-[18%] right-[18%] top-1/2 -translate-y-1/2 h-12 pointer-events-none"
          initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
          animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{
            background: `linear-gradient(90deg, ${playerColor}, #F97316, white, #F97316, ${playerColor})`,
            filter: "drop-shadow(0 0 16px #F97316) drop-shadow(0 0 32px #FACC15) blur(0.5px)",
            borderRadius: 24,
          }}
        />
      )}
      {aiBeam && (
        <motion.div
          key="ai-beam"
          className="absolute left-[18%] right-[18%] top-1/2 -translate-y-1/2 h-12 pointer-events-none"
          initial={{ clipPath: "inset(0 0 0 100%)", opacity: 0 }}
          animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{
            background: `linear-gradient(270deg, ${aiColor}, #F97316, white, #F97316, ${aiColor})`,
            filter: "drop-shadow(0 0 16px #F97316) drop-shadow(0 0 32px #FACC15) blur(0.5px)",
            borderRadius: 24,
          }}
        />
      )}
    </AnimatePresence>
  );
}
