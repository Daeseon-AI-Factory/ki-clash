"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * Character-specific finishing moves for the match-end FinalBlowStage.
 *
 * Each finisher gets its own signature FX layer — different element,
 * different shape language, different palette. Picked by character id.
 *
 * Phases (drive visibility / animation gates):
 *   - "charge"  — winner powering up
 *   - "fire"    — releasing the ult
 *   - "hit"     — connects with the loser
 *   - "fly"     — loser is launched / destroyed
 *   - "land"    — settles into stillness
 */

export type FinisherPhase = "ready" | "charge" | "fire" | "hit" | "fly" | "land";

interface FinisherProps {
  /** "left" if the winner is on the left and FIRING toward the right side */
  winnerOnLeft: boolean;
  phase: FinisherPhase;
}

// ─── KAEL — Sky / Wind Vortex ────────────────────────────────────────

export function KaelFinisher({ winnerOnLeft, phase }: FinisherProps) {
  const targetX = winnerOnLeft ? "80%" : "20%";
  const showVortex = phase === "fire" || phase === "hit";
  const showLightning = phase === "hit";
  return (
    <>
      {/* Spinning wind tornadoes converging on the target */}
      <AnimatePresence>
        {showVortex && (
          <>
            {[0, 0.1, 0.2].map((delay, i) => (
              <motion.div
                key={`vortex-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: targetX,
                  top: "50%",
                  width: 300 - i * 60,
                  height: 300 - i * 60,
                  marginLeft: -(150 - i * 30),
                  marginTop: -(150 - i * 30),
                  background:
                    "conic-gradient(from 0deg, transparent, #60A5FA, white, #1E40AF, transparent)",
                  filter: "blur(8px)",
                  mixBlendMode: "screen",
                }}
                initial={{ rotate: 0, scale: 0.3, opacity: 0 }}
                animate={{
                  rotate: winnerOnLeft ? 1080 : -1080,
                  scale: 1.4,
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 1.1, delay, ease: "easeOut" }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Lightning bolts striking down */}
      <AnimatePresence>
        {showLightning &&
          Array.from({ length: 5 }).map((_, i) => {
            const xOff = (i - 2) * 30;
            return (
              <motion.div
                key={`bolt-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: `calc(${targetX} + ${xOff}px)`,
                  top: 0,
                  bottom: "50%",
                  width: 6,
                  background:
                    "linear-gradient(to bottom, transparent, white 30%, #60A5FA 70%, white)",
                  filter: "drop-shadow(0 0 10px white) blur(0.5px)",
                  transform: `skewX(${(i % 2 ? 1 : -1) * 8}deg)`,
                }}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: [0, 1, 0], scaleY: [0, 1, 1] }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
              />
            );
          })}
      </AnimatePresence>

      {/* Wind speed lines wrapping the target */}
      <AnimatePresence>
        {(phase === "fire" || phase === "hit") &&
          Array.from({ length: 20 }).map((_, i) => {
            const angle = (i * 360) / 20;
            return (
              <motion.div
                key={`wind-${i}`}
                className="absolute origin-left pointer-events-none"
                style={{
                  left: targetX,
                  top: "50%",
                  width: 200,
                  height: 1.5,
                  background:
                    "linear-gradient(90deg, transparent, white, transparent)",
                  transform: `rotate(${angle}deg)`,
                  opacity: 0.8,
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.4, delay: i * 0.015 }}
              />
            );
          })}
      </AnimatePresence>
    </>
  );
}

// ─── SELENE — Moon / Crescent Slash + Void Rift ──────────────────────

export function SeleneFinisher({ winnerOnLeft, phase }: FinisherProps) {
  const targetX = winnerOnLeft ? "80%" : "20%";
  return (
    <>
      {/* Giant purple moon rises behind the winner during charge */}
      <AnimatePresence>
        {(phase === "charge" || phase === "fire" || phase === "hit") && (
          <motion.div
            key="moon"
            className="absolute rounded-full pointer-events-none"
            style={{
              left: winnerOnLeft ? "10%" : "90%",
              top: "10%",
              width: 360,
              height: 360,
              marginLeft: -180,
              background:
                "radial-gradient(circle, #C084FC 0%, #6B21A8 40%, transparent 70%)",
              filter: "blur(2px)",
              mixBlendMode: "screen",
            }}
            initial={{ scale: 0, opacity: 0, y: 200 }}
            animate={{ scale: 1, opacity: 0.9, y: 0 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* 3 crescent blades slashing diagonally across the target */}
      <AnimatePresence>
        {phase === "fire" &&
          [-45, 0, 45].map((angle, i) => (
            <motion.svg
              key={`crescent-${i}`}
              className="absolute pointer-events-none"
              style={{
                left: targetX,
                top: "50%",
                width: 300,
                height: 300,
                marginLeft: -150,
                marginTop: -150,
                transform: `rotate(${angle}deg)`,
              }}
              viewBox="0 0 300 300"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <path
                d="M 30 150 Q 150 30, 270 150 Q 150 90, 30 150 Z"
                fill="#C084FC"
                style={{ filter: "drop-shadow(0 0 16px #A855F7)" }}
              />
              <path
                d="M 50 150 Q 150 60, 250 150 Q 150 100, 50 150 Z"
                fill="white"
                opacity="0.7"
              />
            </motion.svg>
          ))}
      </AnimatePresence>

      {/* Reality cracks — zigzag white lines like broken glass on hit */}
      <AnimatePresence>
        {phase === "hit" &&
          [0, 30, 60, 90, 120, 150].map((deg, i) => (
            <motion.div
              key={`crack-${i}`}
              className="absolute origin-left pointer-events-none"
              style={{
                left: targetX,
                top: "50%",
                width: 320,
                height: 3,
                background:
                  "linear-gradient(90deg, white 0%, transparent 8%, white 16%, transparent 24%, white 32%, transparent 40%, white 48%, transparent 56%, white 64%, transparent 72%, white 80%, transparent 88%, white 100%)",
                transform: `rotate(${deg}deg)`,
                filter: "drop-shadow(0 0 4px #C084FC)",
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: [0, 1, 0.7] }}
              transition={{ duration: 0.4, delay: i * 0.03 }}
            />
          ))}
      </AnimatePresence>

      {/* Void portal opens beneath the target during fly */}
      <AnimatePresence>
        {(phase === "fly" || phase === "land") && (
          <motion.div
            key="void"
            className="absolute rounded-full pointer-events-none"
            style={{
              left: targetX,
              bottom: "10%",
              width: 280,
              height: 80,
              marginLeft: -140,
              background:
                "radial-gradient(ellipse, #1E0B3D 0%, #6B21A8 40%, transparent 70%)",
              filter: "blur(6px)",
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1.4, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── BLAZE — Sun / Multi-Beam Solar Flare ────────────────────────────

export function BlazeFinisher({ winnerOnLeft, phase }: FinisherProps) {
  const showBeams = phase === "fire" || phase === "hit";
  return (
    <>
      {/* Giant sun rises behind winner */}
      <AnimatePresence>
        {(phase === "charge" || phase === "fire" || phase === "hit") && (
          <motion.div
            key="sun"
            className="absolute rounded-full pointer-events-none"
            style={{
              left: winnerOnLeft ? "5%" : "95%",
              top: "50%",
              width: 500,
              height: 500,
              marginLeft: -250,
              marginTop: -250,
              background:
                "radial-gradient(circle, white 0%, #FEF3C7 15%, #FACC15 35%, #F97316 60%, transparent 85%)",
              filter: "blur(4px)",
              mixBlendMode: "screen",
            }}
            initial={{ scale: 0.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>

      {/* 5 simultaneous beams converging on target from different angles */}
      <AnimatePresence>
        {showBeams && (
          <>
            {[-30, -15, 0, 15, 30].map((vAngle, i) => (
              <motion.div
                key={`beam-${i}`}
                className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: 0,
                  right: 0,
                  height: 32,
                  background:
                    "linear-gradient(90deg, #F97316, #FACC15, white, #FACC15, #F97316)",
                  filter:
                    "drop-shadow(0 0 20px #F97316) drop-shadow(0 0 40px #FACC15) blur(0.5px)",
                  borderRadius: 24,
                  transform: `rotate(${vAngle * 0.3}deg) translateY(${vAngle * 1.5}px)`,
                }}
                initial={{
                  clipPath: winnerOnLeft
                    ? "inset(0 100% 0 0)"
                    : "inset(0 0 0 100%)",
                  opacity: 0,
                }}
                animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Heat-shimmer distortion via overlapping orange gradient pulses */}
      <AnimatePresence>
        {showBeams && (
          <motion.div
            key="heat"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 30%, #F9731644 70%, transparent 100%)",
              mixBlendMode: "screen",
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── YUKI — Frost / Ice Sword Slash + Shatter ────────────────────────

export function YukiFinisher({ winnerOnLeft, phase }: FinisherProps) {
  const targetX = winnerOnLeft ? "80%" : "20%";
  return (
    <>
      {/* Ice crystals forming around target during charge */}
      <AnimatePresence>
        {phase === "charge" &&
          Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 360) / 12;
            const dist = 100;
            return (
              <motion.div
                key={`ice-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: targetX,
                  top: "50%",
                  width: 14,
                  height: 28,
                  background:
                    "linear-gradient(180deg, white, #22D3EE, #0E7490)",
                  clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
                  filter: "drop-shadow(0 0 6px #22D3EE)",
                  transformOrigin: "center bottom",
                }}
                initial={{
                  x: Math.cos((angle * Math.PI) / 180) * dist,
                  y: Math.sin((angle * Math.PI) / 180) * dist,
                  scale: 0,
                  rotate: angle + 90,
                }}
                animate={{ scale: 1, opacity: [0, 1, 0.8] }}
                transition={{ duration: 0.5, delay: i * 0.03 }}
              />
            );
          })}
      </AnimatePresence>

      {/* Giant ice katana slash across the target */}
      <AnimatePresence>
        {phase === "fire" && (
          <motion.div
            key="katana"
            className="absolute pointer-events-none"
            style={{
              left: targetX,
              top: "50%",
              width: 600,
              height: 14,
              marginLeft: -300,
              background:
                "linear-gradient(90deg, transparent 0%, #67E8F9 20%, white 50%, #22D3EE 80%, transparent 100%)",
              filter: "drop-shadow(0 0 16px #22D3EE) drop-shadow(0 0 32px white)",
              transform: `rotate(${winnerOnLeft ? -25 : 25}deg)`,
              borderRadius: 8,
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1.2, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 0.45 }}
          />
        )}
      </AnimatePresence>

      {/* Frozen ice crystals on target (full freeze effect on hit) */}
      <AnimatePresence>
        {phase === "hit" && (
          <motion.div
            key="freeze"
            className="absolute pointer-events-none rounded-lg"
            style={{
              left: targetX,
              top: "50%",
              width: 240,
              height: 320,
              marginLeft: -120,
              marginTop: -160,
              background:
                "linear-gradient(135deg, #67E8F988 0%, #22D3EEcc 40%, #0E7490aa 100%)",
              border: "3px solid white",
              boxShadow: "0 0 40px #22D3EE, inset 0 0 24px white",
              backdropFilter: "blur(2px)",
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.9, scale: 1 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* Ice shards exploding outward when freeze breaks (fly phase) */}
      <AnimatePresence>
        {(phase === "fly" || phase === "land") &&
          Array.from({ length: 20 }).map((_, i) => {
            const angle = (i * 360) / 20;
            const dist = 200 + (i % 4) * 40;
            return (
              <motion.div
                key={`shard-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: targetX,
                  top: "50%",
                  width: 8 + (i % 3) * 4,
                  height: 16 + (i % 3) * 6,
                  background:
                    "linear-gradient(135deg, white, #67E8F9, #22D3EE)",
                  clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
                  filter: "drop-shadow(0 0 6px #22D3EE)",
                }}
                initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
                animate={{
                  x: Math.cos((angle * Math.PI) / 180) * dist,
                  y: Math.sin((angle * Math.PI) / 180) * dist + 100,
                  scale: 0.5,
                  opacity: 0,
                  rotate: 540,
                }}
                transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.01 }}
              />
            );
          })}
      </AnimatePresence>
    </>
  );
}

// ─── ATLAS — Stone / Meteor Bombardment ──────────────────────────────

export function AtlasFinisher({ winnerOnLeft, phase }: FinisherProps) {
  const targetX = winnerOnLeft ? "80%" : "20%";
  return (
    <>
      {/* Sky darkens during charge */}
      <AnimatePresence>
        {(phase === "charge" || phase === "fire" || phase === "hit") && (
          <motion.div
            key="sky-dark"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, #1F2937 0%, #7F1D1D 70%, transparent 100%)",
              mixBlendMode: "multiply",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* 4 meteors crashing down on target during fire */}
      <AnimatePresence>
        {(phase === "fire" || phase === "hit") &&
          [-40, -15, 15, 40].map((xOff, i) => (
            <motion.div
              key={`meteor-${i}`}
              className="absolute pointer-events-none"
              style={{
                left: `calc(${targetX} + ${xOff}px)`,
                top: 0,
                width: 30 + i * 5,
                height: 90,
                background:
                  "linear-gradient(180deg, transparent 0%, #FBBF24 30%, #F97316 60%, #7F1D1D 100%)",
                clipPath: "polygon(50% 100%, 30% 50%, 0% 0%, 70% 30%, 100% 0%, 70% 50%)",
                filter:
                  "drop-shadow(0 0 16px #F97316) drop-shadow(0 0 32px #FBBF24)",
              }}
              initial={{ y: "-100vh", opacity: 0, scale: 0.5 }}
              animate={{ y: "50vh", opacity: [0, 1, 1, 0], scale: 1.2 }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: "easeIn" }}
            />
          ))}
      </AnimatePresence>

      {/* Magma fissures cracking through ground on hit */}
      <AnimatePresence>
        {(phase === "hit" || phase === "fly") &&
          [-1, 0, 1].map((dir, i) => (
            <motion.div
              key={`crack-${i}`}
              className="absolute bottom-1/4 origin-left pointer-events-none"
              style={{
                left: targetX,
                width: 350,
                height: 6,
                background:
                  "linear-gradient(90deg, #FACC15 0%, #F97316 30%, #DC2626 70%, transparent 100%)",
                transform: `rotate(${dir * 20}deg)`,
                filter: "drop-shadow(0 0 12px #F97316) blur(0.5px)",
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: [0, 1, 0.8] }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
            />
          ))}
      </AnimatePresence>

      {/* Massive boulder crashes on target at hit */}
      <AnimatePresence>
        {phase === "hit" && (
          <motion.div
            key="boulder"
            className="absolute pointer-events-none"
            style={{
              left: targetX,
              top: "50%",
              width: 180,
              height: 180,
              marginLeft: -90,
              marginTop: -90,
              background:
                "radial-gradient(circle at 35% 35%, #78350F 0%, #44230A 60%, #1F1208 100%)",
              borderRadius: "40% 60% 50% 40%",
              boxShadow: "inset -10px -10px 20px rgba(0,0,0,0.6), 0 0 30px #F97316",
            }}
            initial={{ y: -400, scale: 0.5, rotate: -30 }}
            animate={{ y: 0, scale: 1, rotate: 0 }}
            transition={{ duration: 0.3, ease: "easeIn" }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── ROSA — Crystal / Pink Diamond Storm ─────────────────────────────

export function RosaFinisher({ winnerOnLeft, phase }: FinisherProps) {
  const targetX = winnerOnLeft ? "80%" : "20%";
  return (
    <>
      {/* Pink crystal spikes shoot up from ground around target */}
      <AnimatePresence>
        {(phase === "charge" || phase === "fire") &&
          Array.from({ length: 8 }).map((_, i) => {
            const xOff = ((i - 4) * 30);
            return (
              <motion.div
                key={`spike-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: `calc(${targetX} + ${xOff}px)`,
                  bottom: "10%",
                  width: 28,
                  height: 140,
                  background:
                    "linear-gradient(180deg, white 0%, #F472B6 30%, #BE185D 70%, #831843 100%)",
                  clipPath: "polygon(50% 0%, 90% 30%, 100% 100%, 0% 100%, 10% 30%)",
                  filter: "drop-shadow(0 0 12px #F472B6)",
                }}
                initial={{ y: 200, scaleY: 0, opacity: 0 }}
                animate={{ y: 0, scaleY: 1, opacity: 1 }}
                transition={{ duration: 0.35, delay: i * 0.04, ease: "easeOut" }}
              />
            );
          })}
      </AnimatePresence>

      {/* Multiple thin pink laser beams crossing the target */}
      <AnimatePresence>
        {(phase === "fire" || phase === "hit") &&
          [-30, -15, 0, 15, 30].map((angle, i) => (
            <motion.div
              key={`laser-${i}`}
              className="absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none"
              style={{
                height: 4,
                background:
                  "linear-gradient(90deg, transparent, #FBCFE8 20%, #F472B6 50%, white 51%, #F472B6 80%, transparent)",
                filter:
                  "drop-shadow(0 0 8px #F472B6) drop-shadow(0 0 16px white)",
                transform: `rotate(${angle * 0.3}deg)`,
              }}
              initial={{
                clipPath: winnerOnLeft
                  ? "inset(0 100% 0 0)"
                  : "inset(0 0 0 100%)",
                opacity: 0,
              }}
              animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
              transition={{ duration: 0.35, delay: i * 0.03 }}
            />
          ))}
      </AnimatePresence>

      {/* Heart-shaped explosion at impact */}
      <AnimatePresence>
        {phase === "hit" && (
          <motion.svg
            key="heart"
            className="absolute pointer-events-none"
            style={{
              left: targetX,
              top: "50%",
              width: 240,
              height: 240,
              marginLeft: -120,
              marginTop: -120,
            }}
            viewBox="0 0 100 100"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <path
              d="M 50 80 Q 10 50, 10 30 Q 10 10, 30 10 Q 50 10, 50 30 Q 50 10, 70 10 Q 90 10, 90 30 Q 90 50, 50 80 Z"
              fill="#F472B6"
              stroke="white"
              strokeWidth="2"
              style={{ filter: "drop-shadow(0 0 16px #F472B6)" }}
            />
            <path
              d="M 50 70 Q 22 48, 22 32 Q 22 18, 34 18 Q 50 18, 50 32 Q 50 18, 66 18 Q 78 18, 78 32 Q 78 48, 50 70 Z"
              fill="white"
              opacity="0.8"
            />
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Glitter particles continuously sparkling during hit + fly */}
      <AnimatePresence>
        {(phase === "hit" || phase === "fly") &&
          Array.from({ length: 25 }).map((_, i) => {
            const angle = (i * 360) / 25;
            const dist = 150 + (i % 5) * 30;
            return (
              <motion.div
                key={`glitter-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left: targetX,
                  top: "50%",
                  width: 6,
                  height: 6,
                  background: i % 2 ? "#F472B6" : "white",
                  borderRadius: "50%",
                  filter: "drop-shadow(0 0 4px #F472B6)",
                  clipPath:
                    i % 3 === 0
                      ? "polygon(50% 0%, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0% 50%, 40% 40%)"
                      : undefined,
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos((angle * Math.PI) / 180) * dist,
                  y: Math.sin((angle * Math.PI) / 180) * dist,
                  opacity: 0,
                  scale: 0.3,
                  rotate: 360,
                }}
                transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.015 }}
              />
            );
          })}
      </AnimatePresence>
    </>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────

export function CharacterFinisher({
  characterId,
  winnerOnLeft,
  phase,
}: {
  characterId: string;
  winnerOnLeft: boolean;
  phase: FinisherPhase;
}) {
  const props = { winnerOnLeft, phase };
  switch (characterId) {
    case "haneul":
      return <KaelFinisher {...props} />;
    case "bora":
      return <SeleneFinisher {...props} />;
    case "taeyang":
      return <BlazeFinisher {...props} />;
    case "danbi":
      return <YukiFinisher {...props} />;
    case "seokjin":
      return <AtlasFinisher {...props} />;
    case "yuri":
      return <RosaFinisher {...props} />;
    default:
      return null;
  }
}
