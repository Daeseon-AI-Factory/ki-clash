"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { Character } from "@/lib/characters";
import FighterSprite from "@/components/arena/FighterSprite";

/**
 * Cinematic match-end overlay. Plays a staged sequence on mount:
 *
 *   finalBlow (2.3s — winner charges, fires energy beam, loser is blown
 *              across the screen with rotation+fade) → vignette → zoom-in
 *              on winner → impact flash → screen shake + title slam +
 *              confetti → stats panel slide-up
 *
 * The finalBlow stage is skipped on draws (nobody loses).
 *
 * # CORE_CANDIDATE — generic "dramatic finale" pattern. The component is
 *   game-agnostic; pass `result` + score and it handles the rest.
 */

type Stage = "finalBlow" | "vignette" | "zoom" | "flash" | "shake" | "stats";
export type FinaleResult = "win" | "loss" | "draw";

interface MatchFinaleProps {
  result: FinaleResult;
  finalScore: { player: number; opponent: number };
  totalTurns: number;
  playerCharacter?: Character;
  opponentCharacter?: Character;
  opponentName?: string;
  onPlayAgain: () => void;
  playAgainLabel?: string;
}

const DURATIONS = {
  finalBlow: 2300,
  vignette: 500,
  zoom: 600,
  flash: 200,
  shake: 700,
} as const;

export default function MatchFinale({
  result,
  finalScore,
  totalTurns,
  playerCharacter,
  opponentCharacter,
  opponentName,
  onPlayAgain,
  playAgainLabel = "Play Again",
}: MatchFinaleProps) {
  const playerWon = result === "win";
  const isDraw = result === "draw";

  // Skip the finalBlow stage when nobody loses — go straight to vignette.
  const [stage, setStage] = useState<Stage>(isDraw ? "vignette" : "finalBlow");
  const confettiFiredRef = useRef(false);

  const palette = playerWon
    ? {
        title: "VICTORY",
        subtitle: "기싸움 승리",
        text: "text-yellow-200",
        accent: "#FCD34D",
        glow: "#F59E0B",
      }
    : isDraw
      ? {
          title: "DRAW",
          subtitle: "무승부",
          text: "text-gray-100",
          accent: "#9CA3AF",
          glow: "#6B7280",
        }
      : {
          title: "DEFEAT",
          subtitle: "기싸움 패배",
          text: "text-red-300",
          accent: "#EF4444",
          glow: "#B91C1C",
        };

  // Stage progression — schedule the chain on mount.
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    const offset = isDraw ? 0 : DURATIONS.finalBlow;

    t.push(setTimeout(() => setStage("vignette"), offset));
    t.push(setTimeout(() => setStage("zoom"), offset + DURATIONS.vignette));
    t.push(
      setTimeout(
        () => setStage("flash"),
        offset + DURATIONS.vignette + DURATIONS.zoom,
      ),
    );
    t.push(
      setTimeout(
        () => setStage("shake"),
        offset + DURATIONS.vignette + DURATIONS.zoom + DURATIONS.flash,
      ),
    );
    t.push(
      setTimeout(
        () => setStage("stats"),
        offset +
          DURATIONS.vignette +
          DURATIONS.zoom +
          DURATIONS.flash +
          DURATIONS.shake,
      ),
    );
    return () => t.forEach(clearTimeout);
  }, [isDraw]);

  // Confetti burst when the title slams in.
  useEffect(() => {
    if (stage !== "shake" || confettiFiredRef.current) return;
    confettiFiredRef.current = true;

    if (playerWon) {
      const fire = (ratio: number, opts: confetti.Options) =>
        confetti({
          particleCount: Math.floor(220 * ratio),
          origin: { y: 0.65 },
          colors: ["#FCD34D", "#F59E0B", "#FBBF24", "#FFFFFF", "#FEF3C7"],
          ...opts,
        });
      fire(0.25, { spread: 26, startVelocity: 55, scalar: 1.2 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    } else if (!isDraw) {
      confetti({
        particleCount: 90,
        startVelocity: 12,
        gravity: 0.5,
        spread: 100,
        origin: { y: -0.1, x: 0.5 },
        ticks: 220,
        colors: ["#374151", "#1F2937", "#4B5563", "#6B7280", "#111827"],
        scalar: 0.7,
        shapes: ["circle"],
        drift: 0.4,
      });
    }
  }, [stage, playerWon, isDraw]);

  const showWinner = stage === "zoom" || stage === "flash";
  const showTitle = stage === "shake" || stage === "stats";
  const showStats = stage === "stats";

  const winnerCharacter = playerWon ? playerCharacter : opponentCharacter;
  const loserCharacter = playerWon ? opponentCharacter : playerCharacter;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Final-Blow stage — winner demolishes loser before the cinematic. */}
      <AnimatePresence>
        {stage === "finalBlow" && winnerCharacter && loserCharacter && (
          <FinalBlowStage
            key="final-blow"
            winnerCharacter={winnerCharacter}
            loserCharacter={loserCharacter}
            winnerOnLeft={playerWon}
            palette={palette}
          />
        )}
      </AnimatePresence>

      {/* Layer 1: closing vignette */}
      {stage !== "finalBlow" && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.85) 65%, #000 100%)",
          }}
          initial={{ scale: 3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: DURATIONS.vignette / 1000, ease: "easeOut" }}
        />
      )}

      <AnimatePresence>
        {showWinner && (
          <motion.div
            key="speedlines"
            className="absolute inset-0 pointer-events-none speed-lines"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(stage === "flash" || stage === "shake" || stage === "stats") && (
          <motion.div
            key="colorwash"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at center, ${palette.glow}40 0%, transparent 60%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* Both fighters with poses — winner standing, loser KO'd. Only after
          the finalBlow finishes (we don't double-render fighters). */}
      <AnimatePresence>
        {(showWinner || stage === "shake" || stage === "stats") && (
          <motion.div
            key="fighters"
            className="absolute inset-0 pointer-events-none flex items-end justify-center gap-6 sm:gap-16 pb-40 sm:pb-48"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: DURATIONS.zoom / 1000,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="relative flex flex-col items-center">
              {playerCharacter && (
                <>
                  {playerWon && (
                    <div
                      className="absolute -inset-12 rounded-full animate-aura-pulse pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${palette.accent}cc 0%, ${palette.glow}55 40%, transparent 70%)`,
                        filter: "blur(24px)",
                      }}
                    />
                  )}
                  <FighterSprite
                    character={playerCharacter}
                    pose={playerWon ? "victory" : isDraw ? "idle" : "ko"}
                    width={playerWon ? 180 : 130}
                  />
                </>
              )}
            </div>

            <div className="relative flex flex-col items-center">
              {opponentCharacter && (
                <>
                  {!playerWon && !isDraw && (
                    <div
                      className="absolute -inset-12 rounded-full animate-aura-pulse pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${palette.accent}cc 0%, ${palette.glow}55 40%, transparent 70%)`,
                        filter: "blur(24px)",
                      }}
                    />
                  )}
                  <FighterSprite
                    character={opponentCharacter}
                    pose={
                      !playerWon && !isDraw
                        ? "victory"
                        : isDraw
                          ? "idle"
                          : "ko"
                    }
                    flip
                    width={!playerWon && !isDraw ? 180 : 130}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "flash" && (
          <motion.div
            key="flash"
            className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.4, 0] }}
            transition={{ duration: DURATIONS.flash / 1000, times: [0, 0.2, 0.6, 1] }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTitle && (
          <motion.div
            key="title"
            className={`relative z-10 text-center px-4 ${
              stage === "shake" ? "animate-cinematic-shake" : ""
            }`}
            initial={{ scale: 5, y: -240, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
            transition={{
              type: "spring",
              damping: 11,
              stiffness: 220,
              mass: 0.9,
            }}
          >
            <div
              className="absolute inset-0 blur-3xl pointer-events-none"
              style={{ background: palette.glow, opacity: 0.55 }}
            />
            <h1
              className={`relative text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter ${palette.text}`}
              style={{
                textShadow: `0 0 20px ${palette.accent}, 0 0 40px ${palette.glow}, 0 0 80px ${palette.glow}, 0 4px 12px rgba(0,0,0,0.85)`,
                letterSpacing: "-0.06em",
                fontStretch: "expanded",
              }}
            >
              {palette.title}
            </h1>
            <p className="relative mt-3 text-sm md:text-base text-gray-300 uppercase tracking-[0.4em]">
              {palette.subtitle}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStats && (
          <motion.div
            key="stats"
            className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 z-20"
            initial={{ y: "120%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              type: "spring",
              damping: 22,
              stiffness: 180,
              delay: 0.3,
            }}
          >
            <div className="max-w-2xl mx-auto bg-gray-900/90 backdrop-blur-md rounded-2xl p-6 border border-gray-700/60 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400 uppercase tracking-wider">
                  Final Score
                </span>
                <span className="text-2xl font-black text-white">
                  <span className={playerWon ? "text-green-400" : "text-gray-300"}>
                    {finalScore.player}
                  </span>
                  <span className="text-gray-600 mx-3">—</span>
                  <span
                    className={
                      !playerWon && !isDraw ? "text-red-400" : "text-gray-300"
                    }
                  >
                    {finalScore.opponent}
                  </span>
                </span>
              </div>
              {opponentName && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400 uppercase tracking-wider">
                    vs
                  </span>
                  <span className="text-lg font-medium text-white">
                    {opponentName}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400 uppercase tracking-wider">
                  Total Turns
                </span>
                <span className="text-lg font-medium text-white">
                  {totalTurns}
                </span>
              </div>
              <button
                onClick={onPlayAgain}
                className="w-full mt-2 py-4 rounded-xl text-xl font-bold transition-all shadow-lg
                           bg-gradient-to-r from-green-600 to-emerald-500
                           hover:from-green-500 hover:to-emerald-400
                           shadow-green-600/40 hover:shadow-green-500/50
                           active:scale-[0.98]"
              >
                {playAgainLabel}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Final-Blow Stage — apocalyptic finisher: winner charges, fires a screen-
// filling beam, loser is OBLITERATED with screen shake + chromatic split +
// debris swarm + crater explosion. Drug-trip-level intensity per user
// feedback ("약빤정도로 상대를 파괴하듯이").

type BlowSub = "ready" | "charge" | "fire" | "hit" | "fly" | "land";

interface FinalBlowStageProps {
  winnerCharacter: Character;
  loserCharacter: Character;
  /** True if the winner is rendered on the LEFT side */
  winnerOnLeft: boolean;
  palette: { accent: string; glow: string };
}

function FinalBlowStage({
  winnerCharacter,
  loserCharacter,
  winnerOnLeft,
  palette,
}: FinalBlowStageProps) {
  const [sub, setSub] = useState<BlowSub>("ready");
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => setSub("charge"), 200));
    t.push(setTimeout(() => setSub("fire"), 1000));   // longer charge buildup
    t.push(setTimeout(() => setSub("hit"), 1200));
    t.push(setTimeout(() => setSub("fly"), 1700));    // longer destruction frame
    t.push(setTimeout(() => setSub("land"), 2400));
    return () => t.forEach(clearTimeout);
  }, []);

  // Multi-burst confetti barrage at the moment of impact — fires once.
  useEffect(() => {
    if (sub !== "hit" || confettiFiredRef.current) return;
    confettiFiredRef.current = true;
    const impactX = winnerOnLeft ? 0.78 : 0.22;
    // Wave 1 — concentrated bright burst from the impact point
    confetti({
      particleCount: 220,
      spread: 100,
      startVelocity: 55,
      origin: { x: impactX, y: 0.5 },
      colors: ["#FFFFFF", "#FEF3C7", "#FACC15", "#F97316", "#EF4444"],
      scalar: 1.4,
      ticks: 180,
    });
    // Wave 2 — orange/red shockwave
    setTimeout(() => {
      confetti({
        particleCount: 140,
        spread: 180,
        startVelocity: 35,
        origin: { x: impactX, y: 0.5 },
        colors: ["#F97316", "#EF4444", "#7F1D1D", "#1F2937"],
        scalar: 1.1,
        ticks: 150,
      });
    }, 120);
    // Wave 3 — debris streaming sideways (away from winner)
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 60,
        startVelocity: 70,
        origin: { x: impactX, y: 0.5 },
        angle: winnerOnLeft ? 30 : 150,  // straight to opposite side
        colors: ["#1F2937", "#374151", "#7F1D1D"],
        scalar: 0.9,
        shapes: ["square"],
        ticks: 200,
      });
    }, 240);
  }, [sub, winnerOnLeft]);

  // Loser flies AWAY from the winner — direction depends on which side they're on.
  const loserFlyX = winnerOnLeft ? 900 : -900;

  // Winner pose tracks the charge → fire arc.
  const winnerPose =
    sub === "charge" ? "windup" : sub === "fire" ? "impact" : "idle";

  // Loser pose: hit recoil, then KO'd.
  const loserPose =
    sub === "hit" ? "hit" : sub === "fly" || sub === "land" ? "ko" : "idle";

  // Camera-shake during destruction frame — applied to entire stage.
  const isDestroying = sub === "hit" || sub === "fly";
  return (
    <motion.div
      className={`absolute inset-0 overflow-hidden ${isDestroying ? "animate-cinematic-shake" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Arena background — base + heat-damage red wash during destruction */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #1e1b4b 0%, #4c1d95 40%, #c2410c 100%)",
        }}
      />
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, #7F1D1D 0%, #B91C1C 50%, #DC2626 100%)",
          mixBlendMode: "multiply",
        }}
        animate={{
          opacity:
            sub === "charge" ? 0.15
            : sub === "fire" ? 0.3
            : sub === "hit" ? 0.5
            : sub === "fly" ? 0.4
            : 0,
        }}
        transition={{ duration: 0.25 }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 h-1/3 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(251,146,60,0.5), transparent)",
        }}
      />
      <div className="absolute left-0 right-0 bottom-1/3 h-px bg-orange-300/60 pointer-events-none" />

      {/* CHARGE: vignette darkens, speed lines converge from screen edges */}
      <AnimatePresence>
        {sub === "charge" && (
          <>
            <motion.div
              key="vignette"
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 80%)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />
            {/* Speed lines converging on winner from all sides */}
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i * 360) / 16;
              return (
                <motion.div
                  key={`speed-${i}`}
                  className="absolute origin-right"
                  style={{
                    left: winnerOnLeft ? "20%" : "80%",
                    top: "50%",
                    width: 300,
                    height: 2,
                    background: `linear-gradient(90deg, transparent, white, transparent)`,
                    transform: `rotate(${angle}deg)`,
                    filter: "drop-shadow(0 0 3px white)",
                  }}
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: [0, 0.9, 0.3] }}
                  transition={{ duration: 0.5, delay: i * 0.02 }}
                />
              );
            })}
            {/* Charging shockwave */}
            <motion.div
              key="shockwave"
              className="absolute rounded-full pointer-events-none"
              style={{
                left: winnerOnLeft ? "20%" : "80%",
                top: "50%",
                width: 260,
                height: 260,
                x: "-50%",
                y: "-50%",
                background: `radial-gradient(circle, ${palette.accent}00 30%, ${palette.glow}aa 60%, transparent 80%)`,
                filter: "blur(3px)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 3], opacity: [0, 1, 0] }}
              transition={{ duration: 0.8 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* FIRE: FULL-SCREEN white flash for the moment of release */}
      <AnimatePresence>
        {sub === "fire" && (
          <motion.div
            key="fire-flash"
            className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6] }}
            transition={{ duration: 0.18 }}
          />
        )}
      </AnimatePresence>

      {/* MASSIVE energy beam — fills the central 35% of viewport height */}
      <AnimatePresence>
        {(sub === "fire" || sub === "hit") && (
          <>
            {/* Outer halo — soft yellow plasma glow */}
            <motion.div
              key="beam-halo"
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: 0,
                right: 0,
                height: "60vh",
                maxHeight: 500,
                background:
                  "radial-gradient(ellipse at center, #FACC1577 0%, #F9731644 40%, transparent 70%)",
                filter: "blur(40px)",
                mixBlendMode: "screen",
              }}
              initial={{
                clipPath: winnerOnLeft ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)",
                opacity: 0,
              }}
              animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />
            {/* Main beam */}
            <motion.div
              key="beam-main"
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: 0,
                right: 0,
                height: 180,
                background: `linear-gradient(${winnerOnLeft ? 90 : 270}deg,
                  ${palette.accent}, #F97316, #FACC15, white, #FACC15, #F97316, ${palette.glow})`,
                filter:
                  "drop-shadow(0 0 40px #F97316) drop-shadow(0 0 80px #FACC15) blur(1px)",
                borderRadius: 60,
              }}
              initial={{
                clipPath: winnerOnLeft ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)",
                opacity: 0,
                scaleY: 0.3,
              }}
              animate={{ clipPath: "inset(0 0 0 0)", opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 1.4 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
            {/* White-hot core */}
            <motion.div
              key="beam-core"
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: 0,
                right: 0,
                height: 50,
                background:
                  "linear-gradient(90deg, transparent, white 20%, #FEF3C7 50%, white 80%, transparent)",
                filter: "drop-shadow(0 0 24px white) blur(1px)",
                borderRadius: 40,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Chromatic RGB split on HIT — world-breaking effect */}
      <AnimatePresence>
        {sub === "hit" && (
          <>
            {[
              { color: "#FF1744", dx: -10 },
              { color: "#00E5FF", dx: 10 },
            ].map((c, i) => (
              <motion.div
                key={`chrom-${i}`}
                className="absolute pointer-events-none"
                style={{
                  inset: 0,
                  background: c.color,
                  mixBlendMode: "screen",
                  transform: `translateX(${c.dx}px)`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.35, 0] }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Impact crater explosion — multi-layer at receive site */}
      <AnimatePresence>
        {(sub === "hit" || sub === "fly") && (
          <>
            {/* White-hot core */}
            <motion.div
              key="impact-core"
              className="absolute rounded-full pointer-events-none"
              style={{
                left: winnerOnLeft ? "80%" : "20%",
                top: "50%",
                width: 200,
                height: 200,
                x: "-50%",
                y: "-50%",
                background:
                  "radial-gradient(circle, white 0%, #FEF3C7 30%, #FACC15 60%, transparent 80%)",
                filter: "blur(2px)",
                mixBlendMode: "screen",
              }}
              initial={{ scale: 0.1, opacity: 0 }}
              animate={{ scale: [0.1, 1.8, 2.5], opacity: [0, 1, 0] }}
              transition={{ duration: 0.7 }}
            />
            {/* Orange shell */}
            <motion.div
              key="impact-shell"
              className="absolute rounded-full pointer-events-none"
              style={{
                left: winnerOnLeft ? "80%" : "20%",
                top: "50%",
                width: 380,
                height: 380,
                x: "-50%",
                y: "-50%",
                background:
                  "radial-gradient(circle, #F97316 0%, #DC2626 40%, transparent 70%)",
                filter: "blur(8px)",
                mixBlendMode: "screen",
              }}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: [0.2, 1.4, 2.8], opacity: [0, 0.9, 0] }}
              transition={{ duration: 0.8, delay: 0.05 }}
            />
            {/* Secondary blast ring */}
            <motion.div
              key="impact-ring"
              className="absolute rounded-full pointer-events-none border-4"
              style={{
                left: winnerOnLeft ? "80%" : "20%",
                top: "50%",
                width: 60,
                height: 60,
                x: "-50%",
                y: "-50%",
                borderColor: "white",
                filter: "drop-shadow(0 0 16px white)",
              }}
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 8, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Brief full-screen white flash on hit (in addition to fire flash) */}
      <AnimatePresence>
        {sub === "hit" && (
          <motion.div
            key="hit-flash"
            className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0.3, 0] }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* Debris trail following the loser (small dark chunks) */}
      <AnimatePresence>
        {sub === "fly" && (
          <>
            {Array.from({ length: 14 }).map((_, i) => {
              const driftAngle = (i % 5) * 20 - 40;
              const dist = 200 + i * 30;
              const flyDir = winnerOnLeft ? 1 : -1;
              return (
                <motion.div
                  key={`debris-${i}`}
                  className="absolute"
                  style={{
                    left: winnerOnLeft ? "78%" : "22%",
                    top: "50%",
                    width: 6 + (i % 4),
                    height: 6 + (i % 4),
                    background: i % 3 === 0 ? "#DC2626" : i % 3 === 1 ? "#1F2937" : "#7F1D1D",
                    borderRadius: i % 2 ? "50%" : 1,
                    filter: i % 2 ? "drop-shadow(0 0 4px #F97316)" : undefined,
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                  animate={{
                    x: flyDir * dist + Math.cos((driftAngle * Math.PI) / 180) * 100,
                    y: Math.sin((driftAngle * Math.PI) / 180) * 200 + 100,
                    opacity: 0,
                    scale: 0.3,
                    rotate: 720,
                  }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.02 }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* Winner sprite — left or right of arena */}
      <div
        className="absolute bottom-12 sm:bottom-20"
        style={{
          left: winnerOnLeft ? "8%" : undefined,
          right: !winnerOnLeft ? "8%" : undefined,
        }}
      >
        <div className="relative">
          {/* Winner aura — grows during charge */}
          <motion.div
            className="absolute -inset-10 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${palette.accent}cc 0%, ${palette.glow}66 40%, transparent 70%)`,
              filter: "blur(20px)",
            }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{
              scale: sub === "charge" ? 1.8 : sub === "fire" ? 2.2 : 1.2,
              opacity: sub === "charge" || sub === "fire" ? 1 : 0.6,
            }}
            transition={{ duration: 0.3 }}
          />
          <FighterSprite
            character={winnerCharacter}
            pose={winnerPose}
            flip={!winnerOnLeft}
            width={140}
          />
        </div>
      </div>

      {/* Loser sprite — flies away after impact */}
      <motion.div
        className="absolute bottom-12 sm:bottom-20"
        style={{
          left: !winnerOnLeft ? "8%" : undefined,
          right: winnerOnLeft ? "8%" : undefined,
        }}
        animate={{
          x: sub === "fly" || sub === "land" ? loserFlyX : 0,
          y: sub === "fly" ? -180 : sub === "land" ? 60 : 0,
          rotate:
            sub === "fly"
              ? winnerOnLeft
                ? 540
                : -540
              : sub === "land"
                ? winnerOnLeft
                  ? 720
                  : -720
                : 0,
          opacity: sub === "land" ? 0 : 1,
        }}
        transition={{
          duration: sub === "fly" ? 0.65 : sub === "land" ? 0.35 : 0.2,
          ease: sub === "fly" ? "easeOut" : "easeIn",
        }}
      >
        <FighterSprite
          character={loserCharacter}
          pose={loserPose}
          flip={winnerOnLeft}
          width={140}
        />
      </motion.div>

      {/* Dust cloud where loser lands */}
      <AnimatePresence>
        {sub === "land" && (
          <motion.div
            key="dust"
            className="absolute pointer-events-none rounded-full"
            style={{
              left: winnerOnLeft ? "85%" : "15%",
              bottom: "10%",
              width: 200,
              height: 60,
              x: "-50%",
              background:
                "radial-gradient(ellipse, rgba(180,170,150,0.7) 0%, transparent 70%)",
              filter: "blur(4px)",
            }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.6, 2], opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
