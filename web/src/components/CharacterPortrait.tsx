"use client";

import { useState } from "react";
import {
  characterAsset,
  type CharacterExpression,
  type CharacterId,
} from "@/lib/assets";
import { getCharacter } from "@/lib/characters";

const SIZE_PX = { sm: 48, md: 96, lg: 144 } as const;

interface CharacterPortraitProps {
  characterId: string;
  expression?: CharacterExpression;
  size?: keyof typeof SIZE_PX;
  className?: string;
}

const KNOWN_IDS: CharacterId[] = [
  "haneul",
  "bora",
  "taeyang",
  "danbi",
  "seokjin",
  "yuri",
];

/**
 * CharacterPortrait — renders a character's image asset, falling back to the
 * roster emoji if no image file is present at the expected path.
 *
 * Drop `web/public/characters/<id>/<expression>.png` and this component will
 * pick it up automatically. While the file is missing, the emoji defined in
 * `lib/characters.ts` shows instead so the UI never breaks.
 *
 * # CORE_CANDIDATE — generic asset-with-fallback pattern reusable by other
 *   image-driven components (cards, effects, backgrounds).
 */
export default function CharacterPortrait({
  characterId,
  expression = "portrait",
  size = "md",
  className = "",
}: CharacterPortraitProps) {
  const [imageBroken, setImageBroken] = useState(false);
  const character = getCharacter(characterId);
  const px = SIZE_PX[size];

  if (!character) return null;

  const hasAssetPath = KNOWN_IDS.includes(characterId as CharacterId);
  const showImage = hasAssetPath && !imageBroken;

  if (showImage) {
    // Plain <img> chosen over Next/Image so onError can swap to the emoji
    // fallback synchronously — Next/Image hides broken state behind its
    // loader and complicates the missing-asset UX during development.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={characterAsset(characterId as CharacterId, expression)}
        alt={character.name}
        width={px}
        height={px}
        className={`object-contain ${className}`}
        onError={() => setImageBroken(true)}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center select-none ${className}`}
      style={{ width: px, height: px, fontSize: px * 0.6 }}
      aria-label={character.name}
    >
      {character.emoji}
    </div>
  );
}
