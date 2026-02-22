"use client";

import { CHARACTERS } from "@/lib/characters";
import { PixelPortrait } from "@/components/pixel-art";

interface CharacterSelectProps {
  onSelect: (characterId: string) => void;
}

/**
 * Character selection grid — 2×3 layout of fighter cards.
 *
 * Tap a card to select and immediately start the game (fast — no confirm button).
 * Each card shows: emoji (large), name, Korean name, short bio.
 */
export default function CharacterSelect({ onSelect }: CharacterSelectProps) {
  return (
    <div className="text-center space-y-6 max-w-lg w-full">
      <div>
        <h2 className="text-2xl font-black mb-1">Choose Your Fighter</h2>
        <p className="text-sm text-gray-500">Tap to start</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CHARACTERS.map((char) => (
          <button
            key={char.id}
            onClick={() => onSelect(char.id)}
            className="group flex flex-col items-center gap-2 p-4 bg-gray-800
                       hover:bg-gray-700 border-2 border-gray-700 hover:border-opacity-80
                       rounded-xl transition-all cursor-pointer"
            style={{
              // Subtle border glow on hover using the character's color
              borderColor: undefined,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = char.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "";
            }}
          >
            <PixelPortrait characterId={char.id} size="lg" />
            <div>
              <p className="font-bold text-white">{char.name}</p>
              <p className="text-xs text-gray-400">{char.koreanName}</p>
            </div>
            <p className="text-xs text-gray-500 leading-tight">{char.bio}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
