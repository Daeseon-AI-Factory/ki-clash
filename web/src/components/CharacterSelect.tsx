"use client";

import { CHARACTERS, type Character } from "@/lib/characters";
import FighterSprite from "@/components/arena/FighterSprite";

interface CharacterSelectProps {
  onSelect: (characterId: string) => void;
}

/**
 * Character selection grid — 2×3 layout of fighter cards.
 *
 * Each card shows the original fighter art, the international name,
 * the Korean heritage name, and the bio.
 *
 * Tap a card → immediately enters gameplay (no confirm).
 */
export default function CharacterSelect({ onSelect }: CharacterSelectProps) {
  return (
    <div className="text-center space-y-6 max-w-3xl w-full">
      <div>
        <h2 className="text-3xl font-black mb-1">Choose Your Fighter</h2>
        <p className="text-sm text-gray-500">Tap to start</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {CHARACTERS.map((char) => (
          <FighterCard
            key={char.id}
            character={char}
            onClick={() => onSelect(char.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface FighterCardProps {
  character: Character;
  onClick: () => void;
}

function FighterCard({ character, onClick }: FighterCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-3 p-3 sm:p-4
                 bg-gradient-to-b from-gray-800 to-gray-900
                 hover:from-gray-700 hover:to-gray-800
                 border-2 border-gray-700 rounded-2xl transition-all
                 cursor-pointer overflow-hidden relative
                 hover:shadow-2xl hover:-translate-y-1"
      style={{
        boxShadow: `inset 0 0 0 1px ${character.color}22`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = character.color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
    >
      {/* Aura glow behind the sprite — character-colored radial gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-44 sm:h-48 pointer-events-none opacity-50"
        style={{
          background: `radial-gradient(ellipse at center top, ${character.color}55 0%, transparent 70%)`,
        }}
      />

      <div className="relative h-36 sm:h-44 w-full flex items-end justify-center">
        <FighterSprite
          character={character}
          width={82}
          assetMode="auto"
          className="drop-shadow-[0_0_12px_rgba(255,255,255,0.16)]"
        />
      </div>

      {/* Name block */}
      <div className="relative text-center">
        <p className="font-black text-white text-base sm:text-lg leading-tight">{character.name}</p>
        <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 tracking-wider">{character.koreanName}</p>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 leading-snug line-clamp-2">{character.bio}</p>
      </div>
    </button>
  );
}
