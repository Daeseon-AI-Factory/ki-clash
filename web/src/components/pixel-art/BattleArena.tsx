"use client";

import type { PixelAction, PixelPhase } from "@/lib/pixel-art-types";
import { getCharacter } from "@/lib/characters";
import PixelFighter from "./PixelFighter";
import { PixelBeam, PixelShield, PixelFlash } from "./PixelEffects";
import Scanlines from "./Scanlines";

interface BattleArenaProps {
  /** Player's character ID */
  playerCharacterId: string;
  /** AI's character ID */
  aiCharacterId: string;
  /** Current action being animated (null = idle) */
  action?: PixelAction | null;
  /** Current animation phase */
  phase?: PixelPhase;
}

/**
 * Full battle arena — two pixel fighters facing off with effects.
 *
 * Composes PixelFighter, effects (beam/shield/flash), and scanlines
 * into a single arena view. Placed above TurnReveal in game phases.
 */
export default function BattleArena({
  playerCharacterId,
  aiCharacterId,
  action = null,
  phase = "idle",
}: BattleArenaProps) {
  const playerChar = getCharacter(playerCharacterId);
  const aiChar = getCharacter(aiCharacterId);

  // Use character theme colors for effects
  const playerColor = playerChar?.color ?? "#60A5FA";
  const aiColor = aiChar?.color ?? "#C084FC";

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-gray-800/40 rounded-xl p-4 overflow-hidden">
      <Scanlines />
      <PixelFlash action={action} phase={phase} />
      <PixelBeam action={action} phase={phase} color={playerColor} />
      <PixelShield action={action} phase={phase} color={aiColor} />

      <div className="flex items-center justify-around w-full px-6 relative z-10">
        <PixelFighter
          characterId={playerCharacterId}
          name={playerChar?.name}
          side="left"
          action={action}
          phase={phase}
        />
        <span
          className="text-gray-600 text-xs font-bold"
          style={{ fontFamily: "monospace" }}
        >
          VS
        </span>
        <PixelFighter
          characterId={aiCharacterId}
          name={aiChar?.name}
          side="right"
          action={action}
          phase={phase}
        />
      </div>
    </div>
  );
}
