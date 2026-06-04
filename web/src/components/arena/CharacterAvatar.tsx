"use client";

import { useState } from "react";
import { getCharacter } from "@/lib/characters";
import { fighterAsset, type CharacterId } from "@/lib/assets";

const SIZE_PX = { sm: 48, md: 80, lg: 128 } as const;

interface CharacterAvatarProps {
  characterId: string;
  size?: keyof typeof SIZE_PX;
  /** Show the character name below the avatar */
  showLabel?: boolean;
  className?: string;
}

/**
 * Compact character avatar — the real fighter PNG wrapped in a colored
 * ki-aura halo, with an emoji fallback if the PNG is missing.
 *
 * Used on non-arena surfaces (room lobby, character grid, shop, invite).
 * Mirrors the aesthetic of <KiAuraArena> for visual consistency.
 *
 * # CORE_CANDIDATE — drop-in avatar for any character roster.
 */
export default function CharacterAvatar({
  characterId,
  size = "md",
  showLabel = false,
  className = "",
}: CharacterAvatarProps) {
  const character = getCharacter(characterId);
  const [imgBroken, setImgBroken] = useState(false);
  if (!character) return null;

  const px = SIZE_PX[size];
  const emojiSize = px * 0.65;
  const src = fighterAsset(character.id as CharacterId, "idle");

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-full"
        style={{ width: px, height: px }}
      >
        {/* Soft pulsing aura */}
        <div
          className="absolute inset-0 rounded-full blur-md animate-aura-pulse"
          style={{
            background: `radial-gradient(circle, ${character.color}cc 0%, ${character.color}55 40%, transparent 70%)`,
          }}
        />
        {/* Thin rotating ring */}
        <div
          className="absolute inset-0 rounded-full animate-aura-rotate"
          style={{
            background: `conic-gradient(from 0deg, transparent, ${character.color}88, transparent, ${character.color}66, transparent)`,
            filter: "blur(2px)",
            opacity: 0.7,
          }}
        />

        {/* Real fighter PNG (preferred) → emoji fallback */}
        {!imgBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={character.name}
            onError={() => setImgBroken(true)}
            className="relative object-contain"
            style={{
              // Slightly larger than the circle so the character fills it,
              // anchored to show the upper body / face.
              width: px * 1.25,
              height: px * 1.25,
              objectPosition: "top center",
              filter: `drop-shadow(0 0 6px ${character.color}) drop-shadow(0 2px 4px rgba(0,0,0,0.5))`,
            }}
          />
        ) : (
          <span
            className="relative select-none"
            style={{
              fontSize: emojiSize,
              lineHeight: 1,
              filter: `drop-shadow(0 0 6px ${character.color}) drop-shadow(0 2px 4px rgba(0,0,0,0.5))`,
            }}
          >
            {character.emoji}
          </span>
        )}
      </div>
      {showLabel && (
        <span className="mt-1 text-xs font-medium text-white/80">
          {character.name}
        </span>
      )}
    </div>
  );
}
