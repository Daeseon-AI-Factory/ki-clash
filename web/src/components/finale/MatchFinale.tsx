"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { Character } from "@/lib/characters";
import FighterSprite from "@/components/arena/FighterSprite";

/**
 * Cinematic match-end overlay. Plays a staged sequence on mount:
 *
 *   vignette (500ms) → zoom-in on winner (600ms) → impact flash (200ms)
 *   → screen shake + title slam + confetti (700ms) → stats panel slide-up
 *
 * Replaces the bare "VICTORY!" text the original match_end screen used.
 * Owns the full match-end UI — no separate stats panel in page.tsx.
 *
 * # CORE_CANDIDATE — generic "dramatic finale" pattern. The component is
 *   game-agnostic; pass `result` + score and it handles the rest.
 */

type Stage = "vignette" | "zoom" | "flash" | "shake" | "stats";
export type FinaleResult = "win" | "loss" | "draw";

interface MatchFinaleProps {
  /** Outcome from the local player's perspective */
  result: FinaleResult;
  /** Final score, e.g. {player: 2, opponent: 1} */
  finalScore: { player: number; opponent: number };
  totalTurns: number;
  playerCharacter?: Character;
  opponentCharacter?: Character;
  /** Optional label for the opponent (e.g. "vs Bora" line in stats) */
  opponentName?: string;
  onPlayAgain: () => void;
  /** Primary button label (default: "Play Again") */
  playAgainLabel?: string;
}

const DURATIONS = {
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
  const [stage, setStage] = useState<Stage>("vignette");
  const confettiFiredRef = useRef(false);

  const playerWon = result === "win";
  const isDraw = result === "draw";

  // Color / copy per result
  const palette = playerWon
    ? {
        title: "VICTORY",
        subtitle: "기싸움 승리",
        text: "text-yellow-200",
        accent: "#FCD34D", // amber-300
        glow: "#F59E0B",   // amber-500
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

  // Stage progression — fires once on mount.
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => setStage("zoom"), DURATIONS.vignette));
    t.push(
      setTimeout(() => setStage("flash"), DURATIONS.vignette + DURATIONS.zoom),
    );
    t.push(
      setTimeout(
        () => setStage("shake"),
        DURATIONS.vignette + DURATIONS.zoom + DURATIONS.flash,
      ),
    );
    t.push(
      setTimeout(
        () => setStage("stats"),
        DURATIONS.vignette +
          DURATIONS.zoom +
          DURATIONS.flash +
          DURATIONS.shake,
      ),
    );
    return () => t.forEach(clearTimeout);
  }, []);

  // Confetti burst — fires once when shake stage begins.
  useEffect(() => {
    if (stage !== "shake" || confettiFiredRef.current) return;
    confettiFiredRef.current = true;

    if (playerWon) {
      // Gold celebration burst — fired in 5 layered shots for fullness.
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
      // Defeat — ash/smoke particles drifting down from the top.
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

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Layer 1: closing vignette */}
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

      {/* Layer 2: rotating speed lines (only while zoom→flash visible) */}
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

      {/* Layer 3: radial color wash (winner aura tint) */}
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

      {/* Layer 4: both fighters — winner standing tall with aura, loser KO'd
          to the side. (Earlier iteration showed only the winner as a giant
          emoji; user feedback was that the loser needs to visibly fall.) */}
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
            {/* Player side */}
            <div className="relative flex flex-col items-center">
              {/* Aura halo behind the player */}
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

            {/* Opponent side */}
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

      {/* Layer 5: white impact flash */}
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

      {/* Layer 6: title slam (shake → stats) — wrapped in shake class */}
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
            {/* Title glow halo */}
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

      {/* Layer 7: stats panel slide-up */}
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
                  <span
                    className={
                      playerWon ? "text-green-400" : "text-gray-300"
                    }
                  >
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
