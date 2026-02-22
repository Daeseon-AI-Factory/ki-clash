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
  /** Player's action being animated (null = idle) */
  playerAction?: PixelAction | null;
  /** AI's action being animated (null = idle) */
  aiAction?: PixelAction | null;
  /** Current animation phase */
  phase?: PixelPhase;
  /** @deprecated Use playerAction instead. Falls back for both if set. */
  action?: PixelAction | null;
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
  playerAction,
  aiAction,
  action = null,
  phase = "idle",
}: BattleArenaProps) {
  const playerChar = getCharacter(playerCharacterId);
  const aiChar = getCharacter(aiCharacterId);

  // Resolve per-fighter actions (fall back to legacy single `action` prop)
  const resolvedPlayerAction = playerAction ?? action;
  const resolvedAiAction = aiAction ?? action;

  // Use character theme colors for effects
  const playerColor = playerChar?.color ?? "#60A5FA";
  const aiColor = aiChar?.color ?? "#C084FC";

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-gray-800/40 rounded-xl p-4 overflow-hidden">
      <Scanlines />
      <PixelFlash action={resolvedPlayerAction} phase={phase} />
      <PixelBeam action={resolvedPlayerAction} phase={phase} color={playerColor} />
      <PixelShield action={resolvedAiAction} phase={phase} color={aiColor} />

      <div className="flex items-center justify-around w-full px-6 relative z-10">
        <PixelFighter
          characterId={playerCharacterId}
          name={playerChar?.name}
          side="left"
          action={resolvedPlayerAction}
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
          action={resolvedAiAction}
          phase={phase}
        />
      </div>
    </div>
  );
}
