"use client";

import { getCharacter } from "@/lib/characters";

const SIZE_PX = { sm: 48, md: 80, lg: 128 } as const;

interface CharacterAvatarProps {
  characterId: string;
  size?: keyof typeof SIZE_PX;
  /** Show the character name below the avatar */
  showLabel?: boolean;
  className?: string;
}

/**
 * Compact character avatar — a safe roster sigil wrapped in a colored
 * ki-aura halo.
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
  if (!character) return null;

  const px = SIZE_PX[size];
  const emojiSize = px * 0.65;

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
      </div>
      {showLabel && (
        <span className="mt-1 text-xs font-medium text-white/80">
          {character.name}
        </span>
      )}
    </div>
  );
}
