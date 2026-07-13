"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
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
  /** Fill the parent's height (h-full) instead of a fixed h-44/sm:h-64 box —
      used by the viewport-locked gameplay layout so the arena flexes to any
      phone with no page scroll. */
  fill?: boolean;
}

export default function KiAuraArena({
  playerCharacterId,
  aiCharacterId,
  playerAction = null,
  aiAction = null,
  phase = "idle",
  outcome = null,
  fill = false,
}: KiAuraArenaProps) {
  const player = useMemo(() => getCharacter(playerCharacterId), [playerCharacterId]);
  const ai = useMemo(() => getCharacter(aiCharacterId), [aiCharacterId]);

  if (!player || !ai) return null;

  return (
    <div
      className={`relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden border border-gray-700/60 shadow-2xl ${
        fill ? "h-full" : "h-44 sm:h-64"
      }`}
    >
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
            fx
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
  // Rising particle columns + concentric pulse rings + ground glow pillar.
  // Far richer than the original 6-dot converge — gives "powering up" weight.
  const columns = [-32, -16, 0, 16, 32];
  const motes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <AnimatePresence>
      {(phase === "windup" || phase === "impact") && (
        <motion.div
          key="charge"
          className="absolute inset-0 pointer-events-none"
          exit={{ opacity: 0 }}
        >
          {/* Light pillar from the ground */}
          <motion.div
            className="absolute left-1/2 bottom-0 -translate-x-1/2 rounded-t-full origin-bottom"
            style={{
              width: 70,
              height: "100%",
              background: `linear-gradient(to top, ${color}aa, ${color}55, transparent)`,
              filter: "blur(8px)",
            }}
            initial={{ opacity: 0, scaleY: 0.3 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.4 }}
          />

          {/* Three concentric pulsing rings */}
          {[0, 0.2, 0.4].map((delay, i) => (
            <motion.div
              key={`ring-${i}`}
              className="absolute left-1/2 top-1/2 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                width: 110,
                height: 110,
                border: `2px solid ${color}`,
                filter: `drop-shadow(0 0 12px ${color})`,
              }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.5], opacity: [0.8, 0] }}
              transition={{
                duration: 1.2,
                delay,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}

          {/* Rising particle columns */}
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 flex gap-3">
            {columns.map((offset, ci) => (
              <div key={ci} className="relative" style={{ left: offset }}>
                {[0, 0.15, 0.3, 0.45, 0.6, 0.75].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      bottom: 0,
                      width: 6,
                      height: 6,
                      background: color,
                      filter: `drop-shadow(0 0 6px ${color}) blur(0.5px)`,
                    }}
                    initial={{ y: 0, opacity: 0, scale: 0.5 }}
                    animate={{
                      y: -180,
                      opacity: [0, 1, 1, 0],
                      scale: [0.5, 1.2, 1, 0],
                    }}
                    transition={{
                      duration: 1.2,
                      delay: delay + ci * 0.07,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Orbiting motes — the original ring, but more of them and brighter */}
          {motes.map((deg, i) => (
            <motion.div
              key={`mote-${i}`}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: 8,
                height: 8,
                marginLeft: -4,
                marginTop: -4,
                background: `radial-gradient(circle, white 0%, ${color} 50%, transparent 70%)`,
                filter: `drop-shadow(0 0 8px ${color})`,
              }}
              initial={{
                x: Math.cos((deg * Math.PI) / 180) * 85,
                y: Math.sin((deg * Math.PI) / 180) * 85,
                opacity: 0,
                scale: 0.5,
              }}
              animate={{ x: 0, y: 0, opacity: 1, scale: 1.4 }}
              transition={{ duration: 0.55, delay: i * 0.04, ease: "easeIn" }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BlockFX({ phase }: { phase: ActionPhase }) {
  // Multi-layer hex shield — outer glow halo, primary shield, inner shimmer,
  // and three expanding shockwave rings on impact.
  return (
    <AnimatePresence>
      {(phase === "impact" || phase === "recover") && (
        <motion.div
          key="block"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.3 }}
        >
          {/* Outer aura halo */}
          <div
            className="absolute rounded-full"
            style={{
              width: 180,
              height: 180,
              background:
                "radial-gradient(circle, #60A5FA88 0%, #3B82F644 40%, transparent 70%)",
              filter: "blur(16px)",
            }}
          />

          {/* Three expanding shockwave rings — staggered */}
          {[0, 0.15, 0.3].map((delay, i) => (
            <motion.div
              key={`shock-${i}`}
              className="absolute rounded-full"
              style={{
                width: 150,
                height: 150,
                border: "3px solid #93C5FD",
                filter: "drop-shadow(0 0 12px #60A5FA)",
              }}
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.8, delay, ease: "easeOut" }}
            />
          ))}

          {/* Primary hexagonal shield */}
          <svg width="140" height="160" viewBox="0 0 140 160" className="relative">
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.9" />
                <stop offset="30%" stopColor="#60A5FA" stopOpacity="0.8" />
                <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.3" />
              </linearGradient>
              <radialGradient id="shieldShine" cx="50%" cy="30%" r="50%">
                <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            <polygon
              points="70,15 125,48 125,112 70,145 15,112 15,48"
              fill="url(#shieldGrad)"
              stroke="#93C5FD"
              strokeWidth="2.5"
              style={{ filter: "drop-shadow(0 0 16px #60A5FA)" }}
            />
            {/* Inner shimmer highlight */}
            <polygon
              points="70,15 125,48 125,112 70,145 15,112 15,48"
              fill="url(#shieldShine)"
            />
            {/* Inner border */}
            <polygon
              points="70,25 115,53 115,107 70,135 25,107 25,53"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              opacity="0.7"
            />
            {/* Center cross */}
            <line x1="70" y1="60" x2="70" y2="100" stroke="white" strokeWidth="1.5" opacity="0.5" />
            <line x1="50" y1="80" x2="90" y2="80" stroke="white" strokeWidth="1.5" opacity="0.5" />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AttackFX({ phase, side }: { phase: ActionPhase; side: "left" | "right" }) {
  // Physical PUNCH — fast, hard, red/black. Visually opposite to Ki Burst
  // (which is wide/glowing/yellow). One sharp flash, debris particles, knock-
  // back lines. No glowing energy palette — keep it visceral.
  return (
    <AnimatePresence>
      {phase === "impact" && (
        <motion.div
          key="attack"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Single hard impact flash — pure white burst, fast */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 80,
              height: 80,
              background: "radial-gradient(circle, white 0%, #FCA5A5 40%, transparent 70%)",
              filter: "blur(1px)",
              mixBlendMode: "screen",
            }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />

          {/* Crimson shock-burst behind the flash — gives weight */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 140,
              height: 140,
              background: "radial-gradient(circle, #DC2626 0%, #7F1D1D 40%, transparent 70%)",
              filter: "blur(8px)",
              mixBlendMode: "multiply",
            }}
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          />

          {/* Pow-style starburst — angular jagged hit mark (Roy Lichtenstein POW) */}
          <motion.svg
            width="220"
            height="220"
            viewBox="-110 -110 220 220"
            className="absolute"
            initial={{ scale: 0, rotate: side === "left" ? -20 : 20, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], rotate: 0, opacity: [0, 1, 0] }}
            transition={{ duration: 0.35 }}
          >
            <polygon
              points="0,-100 18,-32 80,-58 30,-12 100,0 30,12 80,58 18,32 0,100 -18,32 -80,58 -30,12 -100,0 -30,-12 -80,-58 -18,-32"
              fill="#FCA5A5"
              stroke="#DC2626"
              strokeWidth="4"
              style={{ filter: "drop-shadow(0 0 12px #EF4444)" }}
            />
            <polygon
              points="0,-60 12,-22 50,-38 18,-10 60,0 18,10 50,38 12,22 0,60 -12,22 -50,38 -18,10 -60,0 -18,-10 -50,-38 -12,-22"
              fill="white"
            />
          </motion.svg>

          {/* Two crossing slash lines — sharper, no gradient glow (sharp = physical) */}
          {[
            { angle: side === "left" ? -35 : 35 },
            { angle: side === "left" ? 35 : -35 },
          ].map((s, i) => (
            <motion.div
              key={`slash-${i}`}
              className="absolute"
              style={{
                width: 220,
                height: 4,
                background:
                  "linear-gradient(90deg, transparent 0%, white 40%, white 60%, transparent 100%)",
                transform: `rotate(${s.angle}deg)`,
                filter: "drop-shadow(0 0 2px black)",
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: [0, 1, 0.8], opacity: [0, 1, 0] }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            />
          ))}

          {/* Debris — small dark chunks fly outward + downward gravity */}
          {Array.from({ length: 14 }).map((_, i) => {
            const angle = (i * 360) / 14 + (i % 2) * 12;
            const dist = 70 + (i % 4) * 15;
            return (
              <motion.div
                key={`debris-${i}`}
                className="absolute"
                style={{
                  width: 4 + (i % 3),
                  height: 4 + (i % 3),
                  background: i % 3 === 0 ? "#7F1D1D" : "#1F2937",
                  borderRadius: i % 2 ? "50%" : "1px",
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos((angle * Math.PI) / 180) * dist,
                  y: Math.sin((angle * Math.PI) / 180) * dist * 0.6 + 40,
                  opacity: 0,
                  scale: 0.4,
                  rotate: 360,
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            );
          })}

          {/* Sharp directional speed lines (kinetic motion) */}
          {[-15, -5, 5, 15].map((deg) => (
            <div
              key={`line-${deg}`}
              className="absolute"
              style={{
                width: 100,
                height: 3,
                background: "white",
                transform: `rotate(${deg}deg) translateX(${side === "left" ? -60 : 60}px)`,
                opacity: 0.8,
                filter: "drop-shadow(0 0 1px black)",
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TeleportFX({ phase }: { phase: ActionPhase }) {
  // Portal swirl — rotating conic gradient + chromatic split + afterimage trails.
  return (
    <AnimatePresence>
      {(phase === "impact" || phase === "recover") && (
        <motion.div
          key="teleport"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65 }}
        >
          {/* Outer chromatic ring — purple + cyan offset */}
          {[
            { color: "#A78BFA", dx: -4 },
            { color: "#22D3EE", dx: 4 },
          ].map((c, i) => (
            <motion.div
              key={`chrom-${i}`}
              className="absolute rounded-full"
              style={{
                width: 130,
                height: 130,
                border: `3px solid ${c.color}`,
                left: `calc(50% + ${c.dx}px)`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                mixBlendMode: "screen",
                filter: `drop-shadow(0 0 12px ${c.color})`,
              }}
              initial={{ scale: 0.6, opacity: 1 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          ))}

          {/* Rotating conic-gradient portal */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 120,
              height: 120,
              background:
                "conic-gradient(from 0deg, transparent, #A78BFA, white, #22D3EE, transparent, #A78BFA, transparent)",
              filter: "blur(6px)",
              mixBlendMode: "screen",
            }}
            initial={{ rotate: 0, scale: 0.3, opacity: 1 }}
            animate={{ rotate: 720, scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />

          {/* Bright center flash */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 80,
              height: 80,
              background:
                "radial-gradient(circle, white 0%, #C4B5FD 40%, transparent 70%)",
              filter: "blur(4px)",
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.6, 2.2] }}
            transition={{ duration: 0.4 }}
          />

          {/* Three vertical afterimage slits drifting up */}
          {[0, 0.1, 0.2].map((delay, i) => (
            <motion.div
              key={`after-${i}`}
              className="absolute"
              style={{
                width: 4,
                height: 60,
                left: `${48 + i * 2}%`,
                background:
                  "linear-gradient(to top, transparent, white, transparent)",
                filter: "drop-shadow(0 0 4px #A78BFA)",
              }}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: -40, opacity: [0, 0.8, 0] }}
              transition={{ duration: 0.5, delay }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EnergyChargeFX({ phase, color }: { phase: ActionPhase; color: string }) {
  // KAMEHAMEHA charge — massive plasma buildup with 12 electric arcs,
  // pulsing core that grows over the full windup, and rising plasma
  // streams. Visually opposite to Attack (which is fast/sharp/red).
  return (
    <AnimatePresence>
      {phase === "windup" && (
        <motion.div
          key="energy-charge"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.5 }}
        >
          {/* Far-out aura — yellow plasma glow that grows during charge */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 220,
              height: 220,
              background: `radial-gradient(circle, #FACC1588 0%, #F9731655 30%, ${color}33 60%, transparent 80%)`,
              filter: "blur(28px)",
              mixBlendMode: "screen",
            }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 1, 1.3], opacity: [0, 1, 1] }}
            transition={{ duration: 0.55 }}
          />

          {/* Mid plasma orb — pulsing, growing */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 110,
              height: 110,
              background: `radial-gradient(circle, white 0%, #FEF3C7 25%, ${color} 50%, #F97316 75%, transparent 100%)`,
              filter: `drop-shadow(0 0 36px ${color}) drop-shadow(0 0 72px #F97316)`,
            }}
            initial={{ scale: 0.2 }}
            animate={{ scale: [0.2, 1.3, 1] }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />

          {/* Bright white core — pulses fast for "charging" feel */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 40,
              height: 40,
              background:
                "radial-gradient(circle, white 0%, #FFF7ED 50%, transparent 100%)",
              filter: "blur(2px)",
            }}
            animate={{ scale: [0.8, 1.4, 0.8] }}
            transition={{ duration: 0.3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* 12 electric arcs converging from all directions — denser than Attack */}
          {Array.from({ length: 12 }).map((_, i) => {
            const deg = (i * 360) / 12;
            return (
              <motion.div
                key={`arc-${i}`}
                className="absolute origin-left"
                style={{
                  width: 120,
                  height: 2,
                  background: `linear-gradient(90deg, ${color}, white, transparent)`,
                  transform: `rotate(${deg}deg)`,
                  filter: `drop-shadow(0 0 4px ${color})`,
                  left: "50%",
                  top: "50%",
                }}
                initial={{ scaleX: 1.6, opacity: 0 }}
                animate={{ scaleX: 0.15, opacity: [0, 1, 0] }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.04,
                  repeat: Infinity,
                  ease: "easeIn",
                }}
              />
            );
          })}

          {/* Rising plasma streams — 5 columns of yellow-orange motes */}
          {[-30, -15, 0, 15, 30].map((offset, ci) => (
            <div key={`col-${ci}`} className="absolute" style={{ left: `calc(50% + ${offset}px)`, bottom: "-20%" }}>
              {[0, 0.15, 0.3].map((delay, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    bottom: 0,
                    width: 5,
                    height: 5,
                    background: "#FACC15",
                    filter: "drop-shadow(0 0 4px #FACC15) blur(0.5px)",
                  }}
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: -100, opacity: [0, 1, 0], scale: [0.5, 1, 0] }}
                  transition={{
                    duration: 0.9,
                    delay: delay + ci * 0.05,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ki Burst beam — wide multi-layer plasma with screen-wide shockwave at
// impact. Visually distinct from the punch (which is fast, red, debris-based).

function KiBurstBeam({ color, from }: { color: string; from: "left" | "right" }) {
  const isLeft = from === "left";
  const initialClip = isLeft ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)";
  const beamGradient = isLeft
    ? `linear-gradient(90deg, ${color}, #FACC15, white, #FACC15, #F97316)`
    : `linear-gradient(270deg, ${color}, #FACC15, white, #FACC15, #F97316)`;

  return (
    <>
      {/* Outer glow halo — soft yellow-orange across the full beam path */}
      <motion.div
        key="beam-glow"
        className="absolute left-[15%] right-[15%] top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          height: 140,
          background:
            "radial-gradient(ellipse at center, #FACC1588 0%, #F9731644 40%, transparent 70%)",
          filter: "blur(28px)",
          mixBlendMode: "screen",
        }}
        initial={{ clipPath: initialClip, opacity: 0 }}
        animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />

      {/* Main beam — wide plasma column */}
      <motion.div
        key="beam-main"
        className="absolute left-[15%] right-[15%] top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          height: 70,
          background: beamGradient,
          filter:
            "drop-shadow(0 0 24px #F97316) drop-shadow(0 0 48px #FACC15) blur(0.3px)",
          borderRadius: 40,
        }}
        initial={{ clipPath: initialClip, opacity: 0, scaleY: 0.4 }}
        animate={{ clipPath: "inset(0 0 0 0)", opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />

      {/* Inner white-hot core — narrower, brighter */}
      <motion.div
        key="beam-core"
        className="absolute left-[15%] right-[15%] top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          height: 24,
          background:
            "linear-gradient(90deg, transparent 0%, white 15%, #FEF3C7 50%, white 85%, transparent 100%)",
          filter: "drop-shadow(0 0 12px white) blur(0.5px)",
          borderRadius: 20,
        }}
        initial={{ clipPath: initialClip, opacity: 0 }}
        animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
      />

      {/* Electric arcs flickering along the beam length */}
      {[0.15, 0.35, 0.55, 0.75].map((leftPct, i) => (
        <motion.div
          key={`arc-${i}`}
          className="absolute pointer-events-none"
          style={{
            left: `${15 + leftPct * 70}%`,
            top: "50%",
            width: 40,
            height: 60,
            background: "linear-gradient(180deg, transparent, white, transparent)",
            transform: "translate(-50%, -50%) rotate(15deg)",
            filter: "drop-shadow(0 0 6px white) blur(0.5px)",
            mixBlendMode: "screen",
          }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: [0, 1, 0, 1, 0], scaleY: [0, 1, 0.8, 1, 0] }}
          transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }}
        />
      ))}

      {/* Impact explosion at the receiving fighter's location */}
      <motion.div
        key="beam-impact-glow"
        className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          [isLeft ? "right" : "left"]: "5%",
          width: 280,
          height: 280,
          background:
            "radial-gradient(circle, white 0%, #FEF3C7 15%, #FACC15 30%, #F97316 55%, transparent 80%)",
          filter: "blur(3px)",
          mixBlendMode: "screen",
        }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.4, 2.2], opacity: [0, 1, 0] }}
        transition={{ duration: 0.7, delay: 0.25 }}
      />

      {/* Screen-wide vignette flash — yellow tint pulsing once */}
      <motion.div
        key="beam-screen-flash"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, #FACC1533 0%, transparent 60%)",
          mixBlendMode: "screen",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 0.45, delay: 0.2 }}
      />

      {/* Lingering smoke wisps at impact (after beam fades) */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i * 360) / 6;
        const dist = 100;
        return (
          <motion.div
            key={`smoke-${i}`}
            className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              [isLeft ? "right" : "left"]: "10%",
              width: 30,
              height: 30,
              background: "radial-gradient(circle, #FCA5A555 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
            animate={{
              x: (isLeft ? 1 : -1) * Math.cos((angle * Math.PI) / 180) * dist,
              y: Math.sin((angle * Math.PI) / 180) * dist * 0.6 - 30,
              opacity: [0, 0.7, 0],
              scale: [0.5, 1.6, 2],
            }}
            transition={{ duration: 0.9, delay: 0.4 }}
          />
        );
      })}
    </>
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

  // Confetti spark burst when an attack lands. Cheap drama at the impact
  // point — gold sparks for punch, orange embers for Ki Burst.
  const confettiFiredRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${phase}|${playerAction}|${aiAction}`;
    if (confettiFiredRef.current === key) return;
    if (phase !== "impact") {
      confettiFiredRef.current = null;
      return;
    }
    if (playerPunch || aiPunch) {
      confettiFiredRef.current = key;
      const x = playerPunch ? 0.7 : 0.3;
      confetti({
        particleCount: 30,
        spread: 50,
        startVelocity: 22,
        origin: { x, y: 0.45 },
        colors: ["#FCD34D", "#FBBF24", "#FFFFFF", "#FCA5A5"],
        scalar: 0.8,
        ticks: 60,
      });
    } else if (playerBeam || aiBeam) {
      confettiFiredRef.current = key;
      const x = playerBeam ? 0.78 : 0.22;
      confetti({
        particleCount: 60,
        spread: 80,
        startVelocity: 28,
        origin: { x, y: 0.5 },
        colors: ["#F97316", "#FACC15", "#FFFFFF", playerBeam ? playerColor : aiColor],
        scalar: 1.1,
        ticks: 90,
      });
    }
  }, [phase, playerAction, aiAction, playerPunch, aiPunch, playerBeam, aiBeam, playerColor, aiColor]);

  return (
    <AnimatePresence>
      {playerBeam && <KiBurstBeam color={playerColor} from="left" />}
      {aiBeam && <KiBurstBeam color={aiColor} from="right" />}
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
