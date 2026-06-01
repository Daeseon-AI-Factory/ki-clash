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
// Final-Blow Stage — winner powers up, fires beam, loser is blasted away.

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

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => setSub("charge"), 200));
    t.push(setTimeout(() => setSub("fire"), 800));
    t.push(setTimeout(() => setSub("hit"), 1050));
    t.push(setTimeout(() => setSub("fly"), 1250));
    t.push(setTimeout(() => setSub("land"), 1900));
    return () => t.forEach(clearTimeout);
  }, []);

  // Loser flies AWAY from the winner — direction depends on which side they're on.
  const loserFlyX = winnerOnLeft ? 900 : -900;

  // Winner pose tracks the charge → fire arc.
  const winnerPose =
    sub === "charge" ? "windup" : sub === "fire" ? "impact" : "idle";

  // Loser pose: hit recoil, then KO'd.
  const loserPose =
    sub === "hit" ? "hit" : sub === "fly" || sub === "land" ? "ko" : "idle";

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Arena background — gradient sky + horizon glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #1e1b4b 0%, #4c1d95 40%, #c2410c 100%)",
        }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 h-1/3 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(251,146,60,0.5), transparent)",
        }}
      />
      <div className="absolute left-0 right-0 bottom-1/3 h-px bg-orange-300/60 pointer-events-none" />

      {/* Power-up shockwave from winner during charge */}
      <AnimatePresence>
        {sub === "charge" && (
          <motion.div
            key="shockwave"
            className="absolute rounded-full pointer-events-none"
            style={{
              left: winnerOnLeft ? "20%" : "80%",
              top: "50%",
              width: 200,
              height: 200,
              x: "-50%",
              y: "-50%",
              background: `radial-gradient(circle, ${palette.accent}00 30%, ${palette.glow}aa 60%, transparent 80%)`,
              filter: "blur(2px)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 2.5], opacity: [0, 1, 0] }}
            transition={{ duration: 0.55 }}
          />
        )}
      </AnimatePresence>

      {/* Energy beam — fires from winner toward loser during the "fire" sub-stage */}
      <AnimatePresence>
        {(sub === "fire" || sub === "hit") && (
          <motion.div
            key="beam"
            className="absolute top-1/2 -translate-y-1/2 h-20 pointer-events-none"
            style={{
              left: winnerOnLeft ? "22%" : "22%",
              right: winnerOnLeft ? "22%" : "22%",
              background: `linear-gradient(${winnerOnLeft ? 90 : 270}deg,
                ${palette.accent}, #F97316, white, #F97316, ${palette.glow})`,
              filter:
                "drop-shadow(0 0 24px #F97316) drop-shadow(0 0 64px #FACC15) blur(0.5px)",
              borderRadius: 36,
            }}
            initial={{
              clipPath: winnerOnLeft
                ? "inset(0 100% 0 0)"
                : "inset(0 0 0 100%)",
              opacity: 0,
            }}
            animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Impact explosion at loser position when beam connects */}
      <AnimatePresence>
        {(sub === "hit" || sub === "fly") && (
          <motion.div
            key="impact-burst"
            className="absolute rounded-full pointer-events-none"
            style={{
              left: winnerOnLeft ? "80%" : "20%",
              top: "50%",
              width: 280,
              height: 280,
              x: "-50%",
              y: "-50%",
              background:
                "radial-gradient(circle, white 0%, #FCD34D 25%, #F97316 50%, transparent 75%)",
              filter: "blur(2px)",
            }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.6, 2.4], opacity: [0, 1, 0] }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>

      {/* Brief white screen flash on impact */}
      <AnimatePresence>
        {sub === "hit" && (
          <motion.div
            key="hit-flash"
            className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0] }}
            transition={{ duration: 0.22 }}
          />
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
