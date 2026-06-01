"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ActionKind, ActionPhase } from "@/lib/actions";
import type { TurnOutcome } from "@/lib/api";
import { getCharacter, type Character } from "@/lib/characters";
import FighterSprite, { type FighterPose } from "./FighterSprite";

/**
 * Anime ki-aura battle arena — the visual centerpiece during play/reveal.
 *
 * Replaces the deprecated pixel-art BattleArena. Renders two SVG humanoid
 * fighters (FighterSprite) wrapped in animated ki auras over a parallax
 * gradient sky background, with per-action FX overlays driven by the
 * windup → impact → recover lifecycle.
 *
 * Hit reactions: when `outcome` is set and `phase === "impact"`, the
 * fighter who LOST that turn recoils (hit pose) — visible feedback for
 * "공격하고 뒤지는게 제대로 나와야지".
 *
 * # CORE_CANDIDATE — generic "two-fighter arena" template.
 */

interface KiAuraArenaProps {
  playerCharacterId: string;
  aiCharacterId: string;
  playerAction?: ActionKind | null;
  aiAction?: ActionKind | null;
  phase?: ActionPhase;
  /** When set during impact, the losing fighter recoils (hit pose). */
  outcome?: TurnOutcome | null;
}

export default function KiAuraArena({
  playerCharacterId,
  aiCharacterId,
  playerAction = null,
  aiAction = null,
  phase = "idle",
  outcome = null,
}: KiAuraArenaProps) {
  const player = useMemo(() => getCharacter(playerCharacterId), [playerCharacterId]);
  const ai = useMemo(() => getCharacter(aiCharacterId), [aiCharacterId]);

  if (!player || !ai) return null;

  return (
    <div className="relative w-full max-w-2xl mx-auto h-64 sm:h-72 rounded-2xl overflow-hidden border border-gray-700/60 shadow-2xl">
      <ArenaBackground />

      {/* Fighters — humanoid silhouettes with auras */}
      <div className="absolute inset-0 flex items-end justify-between px-6 sm:px-12 pb-4">
        <FighterWithAura
          character={player}
          action={playerAction}
          phase={phase}
          outcome={outcome}
          side="left"
        />
        <FighterWithAura
          character={ai}
          action={aiAction}
          phase={phase}
          outcome={outcome}
          side="right"
          flip
        />
      </div>

      {/* Cross-screen FX — energy beams, attack punch projectiles */}
      <CrossScreenFX
        playerAction={playerAction}
        aiAction={aiAction}
        phase={phase}
        playerColor={player.color}
        aiColor={ai.color}
      />

      {/* Vignette for depth */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/30" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated background — gradient sky + drifting particles + glow ground.

function ArenaBackground() {
  return (
    <>
      <div className="absolute inset-0 animate-sky-shift" />

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

      <div
        className="absolute left-0 right-0 bottom-0 h-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(251,146,60,0.28), transparent)",
        }}
      />
      <div className="absolute left-0 right-0 bottom-20 h-px bg-orange-400/40 pointer-events-none" />
    </>
  );
}

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
// Fighter with surrounding aura + per-action FX layer.

interface FighterWithAuraProps {
  character: Character;
  action: ActionKind | null;
  phase: ActionPhase;
  outcome: TurnOutcome | null;
  side: "left" | "right";
  flip?: boolean;
}

function FighterWithAura({
  character,
  action,
  phase,
  outcome,
  side,
  flip = false,
}: FighterWithAuraProps) {
  const isAnimating = phase !== "idle";

  // Decide which pose the fighter should be in this frame.
  // Hit reactions take priority during impact; otherwise follow the action phase.
  const pose: FighterPose = (() => {
    if (phase === "impact") {
      if (side === "left" && outcome === "p2_wins_round") return "hit";
      if (side === "right" && outcome === "p1_wins_round") return "hit";
      // Teleport during impact briefly vanishes — pose stays "impact" but
      // visibility is dimmed by the FighterSprite's filter? Skip — too subtle.
    }
    if (phase === "windup") return "windup";
    if (phase === "impact") return "impact";
    if (phase === "recover") return "recover";
    return "idle";
  })();

  // Hide the fighter momentarily on teleport impact (the FX flash covers it).
  const teleportHiding = action === "teleport" && phase === "impact";

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 110, height: 176 }}>
        {/* Outer aura halo */}
        <div
          className={`absolute inset-0 rounded-full ${isAnimating ? "animate-aura-pulse-fast" : "animate-aura-pulse"}`}
          style={{
            background: `radial-gradient(circle, ${character.color}cc 0%, ${character.color}55 40%, transparent 70%)`,
            filter: "blur(16px)",
          }}
        />
        {/* Rotating inner aura ring */}
        <div
          className="absolute inset-2 rounded-full animate-aura-rotate"
          style={{
            background: `conic-gradient(from 0deg, transparent, ${character.color}aa, transparent, ${character.color}88, transparent)`,
            filter: "blur(5px)",
          }}
        />
        {/* The fighter itself */}
        <div
          className="absolute inset-0 flex items-end justify-center"
          style={{
            opacity: teleportHiding ? 0.15 : 1,
            transition: "opacity 0.15s",
          }}
        >
          <FighterSprite
            character={character}
            pose={pose}
            flip={flip}
            width={92}
          />
        </div>

        {/* Per-action local FX */}
        <ActionFXOverlay
          action={action}
          phase={phase}
          color={character.color}
          side={side}
        />
      </div>

      <span
        className="relative text-xs font-medium text-white/85 select-none"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
      >
        {character.name}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-action local FX (charge motes, block shield, attack lines, teleport flash, energy ball)

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
                x: Math.cos((deg * Math.PI) / 180) * 80,
                y: Math.sin((deg * Math.PI) / 180) * 80,
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
          <svg width="120" height="140" viewBox="0 0 120 140">
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            <polygon
              points="60,15 110,42 110,98 60,125 10,98 10,42"
              fill="url(#shieldGrad)"
              stroke="#93C5FD"
              strokeWidth="2"
              style={{ filter: "drop-shadow(0 0 12px #60A5FA)" }}
            />
            <polygon
              points="60,15 110,42 110,98 60,125 10,98 10,42"
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
              background:
                "linear-gradient(90deg, transparent, #FCA5A5, #DC2626, #FCA5A5, transparent)",
              transform: `rotate(${side === "left" ? -15 : 15}deg)`,
              filter: "drop-shadow(0 0 8px #EF4444) blur(0.5px)",
            }}
          />
          {/* Radiating speed lines */}
          {[-30, -15, 0, 15, 30].map((deg) => (
            <div
              key={deg}
              className="absolute"
              style={{
                width: 80,
                height: 2,
                background:
                  "linear-gradient(90deg, transparent, white, transparent)",
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
              width: 110,
              height: 110,
              background:
                "radial-gradient(circle, white 0%, #A78BFA 30%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EnergyChargeFX({ phase, color }: { phase: ActionPhase; color: string }) {
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
// Cross-screen FX — energy beams crossing the full arena width,
// plus a flying-fist projectile during a basic attack.

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
  const playerPunch = playerAction === "attack" && phase === "impact";
  const aiPunch = aiAction === "attack" && phase === "impact";

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
            filter:
              "drop-shadow(0 0 16px #F97316) drop-shadow(0 0 32px #FACC15) blur(0.5px)",
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
            filter:
              "drop-shadow(0 0 16px #F97316) drop-shadow(0 0 32px #FACC15) blur(0.5px)",
            borderRadius: 24,
          }}
        />
      )}
      {/* Flying fist for basic Attack — projectile crossing from attacker toward target */}
      {playerPunch && (
        <motion.div
          key="player-punch"
          className="absolute top-1/2 -translate-y-4 pointer-events-none text-5xl select-none"
          initial={{ left: "18%", opacity: 0, scale: 0.8, rotate: -10 }}
          animate={{ left: "70%", opacity: 1, scale: 1.5, rotate: 0 }}
          exit={{ opacity: 0, scale: 2 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          style={{
            filter: "drop-shadow(0 0 12px #FCA5A5) drop-shadow(0 0 24px #EF4444)",
          }}
        >
          👊
        </motion.div>
      )}
      {aiPunch && (
        <motion.div
          key="ai-punch"
          className="absolute top-1/2 -translate-y-4 pointer-events-none text-5xl select-none"
          initial={{ right: "18%", opacity: 0, scale: 0.8, rotate: 10 }}
          animate={{ right: "70%", opacity: 1, scale: 1.5, rotate: 0 }}
          exit={{ opacity: 0, scale: 2 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          style={{
            filter: "drop-shadow(0 0 12px #FCA5A5) drop-shadow(0 0 24px #EF4444)",
            transform: "scaleX(-1)",
          }}
        >
          👊
        </motion.div>
      )}
    </AnimatePresence>
  );
}
