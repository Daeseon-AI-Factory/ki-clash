"use client";

import { motion } from "framer-motion";
import type { Character } from "@/lib/characters";

/**
 * Humanoid fighter silhouette — SVG-defined anime-style figure with a
 * character-colored hair tuft, dark gradient body, and the character's
 * emoji rendered as a glowing chest emblem (their "spirit signature").
 *
 * Replaces the giant emoji placeholders in the arena. No external art
 * assets — pure SVG primitives.
 *
 * Drives multiple poses through CSS transforms on the outer wrapper:
 *   - idle: neutral fighting stance with subtle breathing bob
 *   - windup: coil down (scale 0.95)
 *   - impact: lunge forward (scale 1.06, translateX)
 *   - hit: recoil back (rotate -15deg, translateX away)
 *   - ko: collapse to the side (rotate 75deg, translateY down, dimmed)
 *   - victory: stand tall (scale 1.08, no glow change — let aura speak)
 *
 * # CORE_CANDIDATE — generic stylized fighter sprite. Pair with any
 *   character data + action lifecycle.
 */

export type FighterPose =
  | "idle"
  | "windup"
  | "impact"
  | "recover"
  | "hit"
  | "ko"
  | "victory";

interface FighterSpriteProps {
  character: Character;
  pose?: FighterPose;
  /** Mirror horizontally — right-side fighters face left */
  flip?: boolean;
  /** Width in px (height auto-scales to ~1.5x for body proportions) */
  width?: number;
}

export default function FighterSprite({
  character,
  pose = "idle",
  flip = false,
  width = 80,
}: FighterSpriteProps) {
  const height = width * 1.6;

  // SVG path / gradient IDs scoped per character to avoid cross-character bleed
  // when multiple sprites render on one page.
  const gradId = `body-${character.id}`;
  const hairGradId = `hair-${character.id}`;

  // Pose transforms applied to the inner SVG wrapper.
  const poseTransform = (() => {
    switch (pose) {
      case "windup":
        return { scale: 0.95, rotate: 0, x: 0, y: 0 };
      case "impact":
        return { scale: 1.06, rotate: 0, x: flip ? -10 : 10, y: 0 };
      case "recover":
        return { scale: 1.02, rotate: 0, x: 0, y: 0 };
      case "hit":
        return {
          scale: 0.95,
          rotate: flip ? 15 : -15,
          x: flip ? 14 : -14,
          y: -4,
        };
      case "ko":
        // Collapsed to the side — lying face-down on the ground.
        return {
          scale: 0.9,
          rotate: flip ? -75 : 75,
          x: flip ? 18 : -18,
          y: height * 0.18,
        };
      case "victory":
        return { scale: 1.08, rotate: 0, x: 0, y: -4 };
      default:
        return { scale: 1, rotate: 0, x: 0, y: 0 };
    }
  })();

  const isKO = pose === "ko";
  const isHit = pose === "hit";

  return (
    <motion.div
      className="relative"
      style={{
        width,
        height,
        // Flip the entire fighter horizontally for right-side characters.
        transform: flip ? "scaleX(-1)" : undefined,
      }}
      animate={poseTransform}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Subtle idle bob — only when truly idle, not during any animation */}
      <div className={pose === "idle" ? "idle-bob w-full h-full" : "w-full h-full"}>
        <svg
          viewBox="0 0 100 160"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            filter: isKO
              ? "brightness(0.5) saturate(0.5)"
              : isHit
                ? "brightness(1.3) saturate(0)"
                : `drop-shadow(0 0 6px ${character.color}88) drop-shadow(0 4px 6px rgba(0,0,0,0.6))`,
          }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2a2a44" />
              <stop offset="60%" stopColor="#13131f" />
              <stop offset="100%" stopColor="#05050a" />
            </linearGradient>
            <linearGradient id={hairGradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={character.color} />
              <stop offset="100%" stopColor="#0a0a17" />
            </linearGradient>
          </defs>

          {/* Hair spikes (anime style) */}
          <polygon
            points="30,22 38,4 44,16 50,2 56,16 62,4 70,22"
            fill={`url(#${hairGradId})`}
          />

          {/* Head */}
          <ellipse cx="50" cy="32" rx="14" ry="16" fill={`url(#${gradId})`} />

          {/* Neck */}
          <rect x="46" y="44" width="8" height="6" fill={`url(#${gradId})`} />

          {/* Torso (broad shoulders → tapered waist) */}
          <polygon
            points="28,50 72,50 70,98 30,98"
            fill={`url(#${gradId})`}
          />

          {/* Belt */}
          <rect
            x="29"
            y="91"
            width="42"
            height="6"
            fill={character.color}
            opacity="0.7"
          />

          {/* Right arm (lead, forward) */}
          <polygon
            points="68,52 86,76 80,82 62,58"
            fill={`url(#${gradId})`}
          />
          {/* Right fist */}
          <circle cx="84" cy="80" r="6" fill={`url(#${gradId})`} />

          {/* Left arm (back, cocked near hip) */}
          <polygon
            points="32,52 16,76 22,82 38,58"
            fill={`url(#${gradId})`}
          />
          {/* Left fist */}
          <circle cx="18" cy="80" r="5.5" fill={`url(#${gradId})`} />

          {/* Right leg (back, extended) */}
          <polygon
            points="50,98 60,128 64,156 56,156 50,132 44,98"
            fill={`url(#${gradId})`}
          />

          {/* Left leg (forward, bent — kung-fu stance) */}
          <polygon
            points="50,98 42,126 34,154 42,156 50,132 50,100"
            fill={`url(#${gradId})`}
          />

          {/* Chest emblem — character emoji as their "ki signature" */}
          <circle cx="50" cy="68" r="9" fill="white" opacity="0.18" />
          <text
            x="50"
            y="73"
            fontSize="14"
            textAnchor="middle"
            // The chest emblem mirrors back to upright on right-side fighters
            // (the parent applies scaleX(-1); we cancel it locally so the
            // emoji stays readable).
            transform={flip ? "translate(100,0) scale(-1,1)" : undefined}
            style={{ userSelect: "none" }}
          >
            {character.emoji}
          </text>
        </svg>
      </div>

      {/* Hit-flash overlay — a brief red wash when the fighter takes damage */}
      {pose === "hit" && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-full mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle, rgba(239,68,68,0.7) 0%, transparent 70%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0] }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.div>
  );
}
