"use client";

import { useMemo } from "react";
import type { Character } from "@/lib/characters";

interface AITrashTalkProps {
  character: Character;
  /** Current turn number — used to re-pick a line each turn */
  turnNumber: number;
}

/**
 * Speech bubble showing the AI character's trash talk.
 *
 * Picks a deterministic-random line from the character's trashTalk array
 * based on the turn number (so it changes each turn but stays stable
 * across re-renders within the same turn).
 */
export default function AITrashTalk({ character, turnNumber }: AITrashTalkProps) {
  const line = useMemo(() => {
    // Simple deterministic pick: turn number mod array length
    const index = turnNumber % character.trashTalk.length;
    return character.trashTalk[index];
  }, [character, turnNumber]);

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div
        className="bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3
                    flex items-start gap-3"
      >
        <span className="text-2xl flex-shrink-0">{character.emoji}</span>
        <p className="text-sm text-gray-300 italic leading-relaxed">
          &ldquo;{line}&rdquo;
        </p>
      </div>
    </div>
  );
}
