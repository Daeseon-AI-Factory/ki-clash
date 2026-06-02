"use client";

import { useState } from "react";
import { CHARACTERS } from "@/lib/characters";
import { fighterAsset, type CharacterId } from "@/lib/assets";

interface CharacterSelectProps {
  onSelect: (characterId: string) => void;
}

/**
 * Character selection grid — 2×3 layout of fighter cards.
 *
 * Each card shows the actual fighter PNG (from /fighters/<id>/idle.png),
 * the international name, the Korean heritage name, and the bio.
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
            id={char.id}
            name={char.name}
            koreanName={char.koreanName}
            color={char.color}
            emoji={char.emoji}
            bio={char.bio}
            onClick={() => onSelect(char.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface FighterCardProps {
  id: string;
  name: string;
  koreanName: string;
  color: string;
  emoji: string;
  bio: string;
  onClick: () => void;
}

function FighterCard({ id, name, koreanName, color, emoji, bio, onClick }: FighterCardProps) {
  const [imgBroken, setImgBroken] = useState(false);
  const src = fighterAsset(id as CharacterId, "idle");

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
        boxShadow: `inset 0 0 0 1px ${color}22`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
    >
      {/* Aura glow behind the sprite — character-colored radial gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-44 sm:h-48 pointer-events-none opacity-50"
        style={{
          background: `radial-gradient(ellipse at center top, ${color}55 0%, transparent 70%)`,
        }}
      />

      {/* Fighter PNG (or symbol emoji fallback) */}
      <div className="relative h-36 sm:h-44 w-full flex items-end justify-center">
        {!imgBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="h-full object-contain"
            style={{ filter: `drop-shadow(0 0 12px ${color}88) drop-shadow(0 6px 8px rgba(0,0,0,0.5))` }}
            onError={() => setImgBroken(true)}
          />
        ) : (
          <span className="text-6xl select-none" style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
            {emoji}
          </span>
        )}
      </div>

      {/* Name block */}
      <div className="relative text-center">
        <p className="font-black text-white text-base sm:text-lg leading-tight">{name}</p>
        <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 tracking-wider">{koreanName}</p>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 leading-snug line-clamp-2">{bio}</p>
      </div>
    </button>
  );
}
