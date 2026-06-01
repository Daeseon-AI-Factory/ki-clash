"use client";

import { motion } from "framer-motion";
import type { Character } from "@/lib/characters";

/**
 * Stylized chibi anime fighter sprite — each roster character is built
 * as a "knockoff" of an iconic shōnen archetype (Naruto / Dragon Ball /
 * Bleach lineage). Pure SVG primitives, no external art.
 *
 * Per-character design lives in CHARACTER_DESIGN below — hair, outfit
 * palette, accessories, eye/mouth defaults. The body, arms, and legs
 * are shared across all fighters and recolored to match the outfit.
 *
 * Keep silhouettes/details at the "anime trope" level — recognizable
 * shōnen vibes without copying a specific licensed character.
 *
 * # CORE_CANDIDATE — drop in any roster with {id, color, emoji}.
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
  /** Width in px (height auto-scales) */
  width?: number;
}

const SKIN = "#F3D9B8";
const SKIN_SHADOW = "#D9B894";
const PUPIL = "#1A0E0E";
const PANTS = "#1F2937";

interface CharacterDesign {
  /** Hair archetype (drives HairBack + HairFront paths) */
  hair: "shonen-spike" | "long-flow" | "topknot" | "side-pony" | "swept" | "parted-bangs";
  hairColor: string;
  hairTip?: string;
  outfitMain: string;
  outfitTrim: string;
  /** Iris color (often character.color, but overridable for contrast) */
  iris?: string;
  /** Subtle facial detail */
  accessory: "headband" | "monk-dot" | "moon" | "beard" | "earring" | "clip" | "scar" | "none";
}

const CHARACTER_DESIGN: Record<string, CharacterDesign> = {
  // Goku-vibe: spiky black hair, blue-tinted gi, monk dot, calm-but-fierce
  haneul: {
    hair: "shonen-spike",
    hairColor: "#1f2937",
    hairTip: "#60A5FA",
    outfitMain: "#F59E0B",   // orange gi
    outfitTrim: "#1E40AF",   // deep-blue sash
    iris: "#1E3A8A",
    accessory: "monk-dot",
  },
  // Trunks-vibe: lavender swept hair, high-collar saiyan jacket
  bora: {
    hair: "swept",
    hairColor: "#A78BFA",
    hairTip: "#C084FC",
    outfitMain: "#312E81",   // dark indigo undersuit
    outfitTrim: "#F3F4F6",   // white armor plate accent
    iris: "#7C3AED",
    accessory: "moon",
  },
  // Naruto-vibe: blond spike, headband, orange jumpsuit
  taeyang: {
    hair: "shonen-spike",
    hairColor: "#FCD34D",
    hairTip: "#FBBF24",
    outfitMain: "#EA580C",   // bright orange
    outfitTrim: "#0F172A",   // dark navy accent
    iris: "#1D4ED8",
    accessory: "headband",
  },
  // Hitsugaya-vibe: silver spike-frost hair, captain haori over white
  danbi: {
    hair: "shonen-spike",
    hairColor: "#E5E7EB",
    hairTip: "#22D3EE",
    outfitMain: "#0E7490",   // teal haori
    outfitTrim: "#F8FAFC",   // white inner robe
    iris: "#0891B2",
    accessory: "earring",
  },
  // Master-vibe: topknot, broad shoulders, beard, brown/orange robe
  seokjin: {
    hair: "topknot",
    hairColor: "#451A03",
    outfitMain: "#9A3412",   // earth-orange
    outfitTrim: "#FBBF24",   // gold trim
    iris: "#78350F",
    accessory: "beard",
  },
  // Boa Hancock-vibe: long pink hair, elegant fitted outfit, condescending
  yuri: {
    hair: "long-flow",
    hairColor: "#F472B6",
    outfitMain: "#831843",   // dark wine
    outfitTrim: "#FBCFE8",   // soft pink accent
    iris: "#BE185D",
    accessory: "clip",
  },
};

const FALLBACK_DESIGN: CharacterDesign = {
  hair: "parted-bangs",
  hairColor: "#1f2937",
  outfitMain: "#6B7280",
  outfitTrim: "#374151",
  accessory: "none",
};

function designFor(character: Character): CharacterDesign {
  return CHARACTER_DESIGN[character.id] ?? FALLBACK_DESIGN;
}

export default function FighterSprite({
  character,
  pose = "idle",
  flip = false,
  width = 80,
}: FighterSpriteProps) {
  const height = width * 1.85;
  const design = designFor(character);

  const poseTransform = (() => {
    switch (pose) {
      case "windup":
        return { scale: 0.96, rotate: 0, x: 0, y: 0 };
      case "impact":
        return { scale: 1.06, rotate: 0, x: flip ? -10 : 10, y: 0 };
      case "recover":
        return { scale: 1.02, rotate: 0, x: 0, y: 0 };
      case "hit":
        return {
          scale: 0.95,
          rotate: flip ? 18 : -18,
          x: flip ? 16 : -16,
          y: -4,
        };
      case "ko":
        return {
          scale: 0.9,
          rotate: flip ? -85 : 85,
          x: flip ? 24 : -24,
          y: height * 0.22,
        };
      case "victory":
        return { scale: 1.1, rotate: 0, x: 0, y: -6 };
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
        transform: flip ? "scaleX(-1)" : undefined,
      }}
      animate={poseTransform}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={pose === "idle" ? "idle-bob w-full h-full" : "w-full h-full"}>
        <svg
          viewBox="-10 -20 120 190"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            overflow: "visible",
            filter: isKO
              ? "brightness(0.6) saturate(0.6)"
              : `drop-shadow(0 0 4px ${character.color}aa) drop-shadow(0 4px 6px rgba(0,0,0,0.5))`,
          }}
        >
          <defs>
            <linearGradient id={`outfit-${character.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={design.outfitMain} />
              <stop offset="100%" stopColor={darken(design.outfitMain, 0.35)} />
            </linearGradient>
            <linearGradient id={`hair-${character.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={design.hairTip ?? design.hairColor} />
              <stop offset="100%" stopColor={design.hairColor} />
            </linearGradient>
            <linearGradient id={`pants-${character.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={PANTS} />
              <stop offset="100%" stopColor="#0a0e16" />
            </linearGradient>
          </defs>

          {/* Order matters: back-layer → middle → front */}
          <FighterLegs design={design} characterId={character.id} />
          <FighterBody design={design} characterId={character.id} />
          <FighterArmBack design={design} characterId={character.id} />
          <HairBack design={design} characterId={character.id} />
          <Head />
          <Face character={character} design={design} pose={pose} />
          <HairFront design={design} characterId={character.id} />
          <Accessory design={design} />
          <FighterArmFront design={design} characterId={character.id} />
        </svg>
      </div>

      {isHit && (
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared body parts. Outfit color comes from the per-character design.

function FighterLegs({ characterId }: { design: CharacterDesign; characterId: string }) {
  const fill = `url(#pants-${characterId})`;
  return (
    <>
      <polygon points="50,98 60,128 64,158 56,158 50,132 44,98" fill={fill} />
      <ellipse cx="60" cy="158" rx="8" ry="3" fill="#0a0a0a" />
      <polygon points="50,98 42,124 34,154 42,158 50,130 50,100" fill={fill} />
      <ellipse cx="38" cy="156" rx="8" ry="3" fill="#0a0a0a" />
    </>
  );
}

function FighterBody({ design, characterId }: { design: CharacterDesign; characterId: string }) {
  const fill = `url(#outfit-${characterId})`;
  return (
    <>
      {/* Torso */}
      <polygon points="28,52 72,52 70,100 30,100" fill={fill} />
      {/* V-collar / lapel — opens to show inner trim color (gi style) */}
      <polygon
        points="44,52 50,72 56,52"
        fill={design.outfitTrim}
      />
      {/* Belt sash */}
      <rect x="29" y="92" width="42" height="7" fill={design.outfitTrim} />
      <rect x="48" y="92" width="4" height="14" fill={design.outfitTrim} opacity="0.7" />
    </>
  );
}

function FighterArmBack({ design }: { design: CharacterDesign; characterId: string }) {
  return (
    <>
      <polygon points="32,52 18,78 24,84 38,58" fill={design.outfitMain} />
      {/* Wristband (light accent) */}
      <rect x="18" y="75" width="8" height="3" fill={design.outfitTrim} />
      <circle cx="20" cy="82" r="5" fill={SKIN} />
    </>
  );
}

function FighterArmFront({ design }: { design: CharacterDesign; characterId: string }) {
  return (
    <>
      <polygon points="68,52 86,74 80,80 62,58" fill={design.outfitMain} />
      {/* Wristband */}
      <rect x="78" y="72" width="8" height="3" fill={design.outfitTrim} />
      <circle cx="84" cy="78" r="6.5" fill={SKIN} />
      <circle cx="84" cy="78" r="6.5" fill="none" stroke={SKIN_SHADOW} strokeWidth="0.6" />
    </>
  );
}

function Head() {
  return (
    <>
      {/* Neck */}
      <rect x="46" y="44" width="8" height="6" fill={SKIN_SHADOW} />
      {/* Face */}
      <ellipse cx="50" cy="32" rx="14" ry="16" fill={SKIN} />
      {/* Chin/jaw shadow */}
      <ellipse cx="50" cy="42" rx="9" ry="4" fill={SKIN_SHADOW} opacity="0.45" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Face — pose-aware eyes/brows/mouth.

function Face({
  character,
  design,
  pose,
}: {
  character: Character;
  design: CharacterDesign;
  pose: FighterPose;
}) {
  const iris = design.iris ?? character.color;
  const eyesShape =
    pose === "ko"
      ? "x"
      : pose === "hit"
        ? "squint"
        : pose === "victory"
          ? "wide"
          : "default";

  const browShape =
    pose === "windup" || pose === "impact" || pose === "victory" ? "fierce" : "default";
  const mouthShape =
    pose === "windup" || pose === "impact"
      ? "shout"
      : pose === "hit"
        ? "ouch"
        : pose === "victory"
          ? "grin"
          : pose === "ko"
            ? "ko"
            : "neutral";

  return (
    <g>
      <Eyebrows shape={browShape} />
      <Eyes shape={eyesShape} iris={iris} pose={pose} />
      <Nose />
      <Mouth shape={mouthShape} />
    </g>
  );
}

function Eyebrows({ shape }: { shape: "default" | "fierce" }) {
  if (shape === "fierce") {
    return (
      <>
        <path d="M 38 24 L 47 28" stroke="#1a0a0a" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M 62 24 L 53 28" stroke="#1a0a0a" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    );
  }
  return (
    <>
      <path d="M 39 24 L 47 24" stroke="#1a0a0a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M 53 24 L 61 24" stroke="#1a0a0a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  );
}

function Eyes({
  shape,
  iris,
  pose,
}: {
  shape: "default" | "x" | "squint" | "wide";
  iris: string;
  pose: FighterPose;
}) {
  if (shape === "x") {
    return (
      <g stroke="#1a0a0a" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M 40 30 L 47 34" />
        <path d="M 47 30 L 40 34" />
        <path d="M 53 30 L 60 34" />
        <path d="M 60 30 L 53 34" />
      </g>
    );
  }
  if (shape === "squint") {
    return (
      <>
        <path d="M 40 32 Q 44 30, 47 32" stroke="#1a0a0a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M 53 32 Q 56 30, 60 32" stroke="#1a0a0a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </>
    );
  }

  const irisR = shape === "wide" ? 2.6 : 2.3;
  const pupilR = shape === "wide" ? 1.3 : 1.1;
  const lookX = pose === "windup" ? -0.7 : pose === "impact" ? 0.9 : 0;

  return (
    <g>
      {/* Sclera (white) */}
      <ellipse cx="44" cy="32" rx="3.4" ry="4.2" fill="white" />
      <ellipse cx="56" cy="32" rx="3.4" ry="4.2" fill="white" />
      {/* Sclera outline (anime style — gives the eye definition) */}
      <ellipse cx="44" cy="32" rx="3.4" ry="4.2" fill="none" stroke="#1a0a0a" strokeWidth="0.6" />
      <ellipse cx="56" cy="32" rx="3.4" ry="4.2" fill="none" stroke="#1a0a0a" strokeWidth="0.6" />
      {/* Iris */}
      <circle cx={44 + lookX} cy="32.5" r={irisR} fill={iris} />
      <circle cx={56 + lookX} cy="32.5" r={irisR} fill={iris} />
      {/* Pupil */}
      <circle cx={44 + lookX} cy="32.5" r={pupilR} fill={PUPIL} />
      <circle cx={56 + lookX} cy="32.5" r={pupilR} fill={PUPIL} />
      {/* Catchlight highlight */}
      <circle cx={44.8 + lookX} cy="31.4" r="0.7" fill="white" />
      <circle cx={56.8 + lookX} cy="31.4" r="0.7" fill="white" />
    </g>
  );
}

function Nose() {
  return <ellipse cx="50" cy="36" rx="0.9" ry="1.4" fill={SKIN_SHADOW} opacity="0.75" />;
}

function Mouth({ shape }: { shape: "neutral" | "shout" | "ouch" | "grin" | "ko" }) {
  switch (shape) {
    case "shout":
      return (
        <>
          <ellipse cx="50" cy="41" rx="3" ry="2.6" fill="#2a0a0a" />
          {/* Teeth strip */}
          <rect x="48" y="40" width="4" height="1" fill="white" opacity="0.85" />
        </>
      );
    case "ouch":
      return (
        <path
          d="M 47 41 Q 50 39, 53 41"
          stroke="#2a0a0a"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      );
    case "grin":
      return (
        <>
          <path
            d="M 44 39 Q 50 45, 56 39"
            stroke="#2a0a0a"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 44 39 Q 50 42, 56 39 Q 50 41, 44 39 Z"
            fill="white"
            opacity="0.85"
          />
        </>
      );
    case "ko":
      return (
        <path
          d="M 47 41 L 53 41"
          stroke="#2a0a0a"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      );
    default:
      return (
        <path
          d="M 47 40 Q 50 42, 53 40"
          stroke="#2a0a0a"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hair — back layer (volume behind head) + front layer (bangs over face).

function HairBack({ design, characterId }: { design: CharacterDesign; characterId: string }) {
  const fill = `url(#hair-${characterId})`;
  switch (design.hair) {
    case "long-flow":
      // Long flowing hair past the shoulders (Boa Hancock / Yuri)
      return (
        <path
          d={`M 30 22 Q 22 60, 30 90 L 42 92 Q 36 50, 38 26 Z
              M 70 22 Q 78 60, 70 90 L 58 92 Q 64 50, 62 26 Z`}
          fill={fill}
        />
      );
    case "shonen-spike":
      // Wild spiky back-volume (Goku / Naruto)
      return (
        <path
          d={`M 30 22 L 22 6 L 32 18 L 24 0 L 38 16 L 28 -4 L 44 14
              L 50 -8 L 56 14 L 72 -4 L 62 16 L 76 0 L 68 18 L 78 6 L 70 22 Z`}
          fill={fill}
        />
      );
    case "topknot":
      return (
        <>
          <ellipse cx="50" cy="22" rx="17" ry="12" fill={fill} />
          <ellipse cx="50" cy="6" rx="6.5" ry="6.5" fill={fill} />
          <rect x="48" y="8" width="4" height="6" fill={darken(design.hairColor, 0.5)} />
        </>
      );
    case "side-pony":
      return (
        <>
          <ellipse cx="50" cy="22" rx="16" ry="12" fill={fill} />
          <path d="M 64 26 Q 84 50, 72 78 L 64 76 Q 76 50, 60 32 Z" fill={fill} />
        </>
      );
    case "swept":
      // Long fringe swept hair (Trunks / Bora)
      return (
        <>
          <ellipse cx="50" cy="22" rx="17" ry="13" fill={fill} />
          <path d="M 30 22 L 36 60 L 44 56 L 38 24 Z" fill={fill} />
          <path d="M 70 22 L 64 60 L 56 56 L 62 24 Z" fill={fill} />
        </>
      );
    case "parted-bangs":
    default:
      return <ellipse cx="50" cy="22" rx="16" ry="12" fill={fill} />;
  }
}

function HairFront({ design, characterId }: { design: CharacterDesign; characterId: string }) {
  const fill = `url(#hair-${characterId})`;
  switch (design.hair) {
    case "shonen-spike":
      // Wild forward-facing spike fringe
      return (
        <path
          d={`M 30 22 L 36 -2 L 42 16 L 48 -6 L 54 16 L 60 -2 L 68 22 Z`}
          fill={fill}
        />
      );
    case "long-flow":
      // Long bangs framing the face
      return (
        <path
          d="M 35 22 L 42 18 L 44 30 L 38 32 Z M 65 22 L 58 18 L 56 30 L 62 32 Z M 38 18 Q 50 8, 62 18 L 62 14 Q 50 4, 38 14 Z"
          fill={fill}
        />
      );
    case "swept":
      // Long sweeping bang covering one eye
      return (
        <path
          d="M 34 18 L 60 30 L 64 22 L 66 14 Q 50 6, 34 14 Z"
          fill={fill}
        />
      );
    case "topknot":
      // Slick-back bang
      return (
        <path d="M 38 22 Q 50 12, 62 22 L 62 18 Q 50 10, 38 18 Z" fill={fill} />
      );
    case "side-pony":
      // Soft forehead bangs
      return (
        <path
          d="M 36 22 Q 50 14, 64 22 L 62 16 Q 50 8, 38 16 Z"
          fill={fill}
        />
      );
    case "parted-bangs":
    default:
      return (
        <path
          d="M 36 22 Q 42 18, 48 24 L 52 24 Q 58 18, 64 22 L 64 16 Q 50 8, 36 16 Z"
          fill={fill}
        />
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-character accessory layered on top.

function Accessory({ design }: { design: CharacterDesign }) {
  switch (design.accessory) {
    case "headband":
      // Dark band across forehead + a small metal plate
      return (
        <>
          <rect x="34" y="19" width="32" height="4" fill="#0F172A" />
          <rect x="34" y="19" width="32" height="0.6" fill={design.outfitTrim} />
          <rect x="46" y="18.5" width="8" height="5" fill="#9CA3AF" />
          <rect x="46" y="18.5" width="8" height="5" fill="none" stroke="#4B5563" strokeWidth="0.4" />
        </>
      );
    case "monk-dot":
      return <circle cx="50" cy="22" r="2" fill={design.outfitTrim} stroke="white" strokeWidth="0.3" />;
    case "moon":
      // Tiny crescent on forehead
      return (
        <path d="M 50 18 A 3 3 0 1 1 47 18 A 2 2 0 1 0 50 18 Z" fill={design.outfitTrim} />
      );
    case "beard":
      return (
        <path
          d="M 42 42 Q 50 50, 58 42 Q 54 47, 50 47 Q 46 47, 42 42 Z"
          fill="#1f1108"
          opacity="0.85"
        />
      );
    case "earring":
      return <ellipse cx="36.5" cy="38" rx="1.5" ry="2.2" fill={design.outfitMain} />;
    case "clip":
      // Diamond hair clip on side
      return (
        <polygon
          points="39,16 42,18.5 39,21 36,18.5"
          fill={design.outfitTrim}
          stroke="white"
          strokeWidth="0.4"
        />
      );
    case "scar":
      return (
        <path d="M 41 28 L 38 36" stroke="#7C2D12" strokeWidth="0.8" strokeLinecap="round" fill="none" />
      );
    case "none":
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — darken a hex string by a factor.

function darken(hex: string, factor = 0.5): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const dr = Math.max(0, Math.floor(r * (1 - factor)));
  const dg = Math.max(0, Math.floor(g * (1 - factor)));
  const db = Math.max(0, Math.floor(b * (1 - factor)));
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}
