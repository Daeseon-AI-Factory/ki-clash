"use client";

import type { GameState } from "@/lib/api";
import type { Character } from "@/lib/characters";
import KiMeter from "./KiMeter";
import AIThinking from "./AIThinking";
import { PixelPortrait } from "./deprecated/pixel-art";

interface MatchHUDProps {
  gameState: GameState;
  playerName: string;
  /** Show animated "AI is analyzing..." below AI ki meter */
  showAIThinking?: boolean;
  /** Player's chosen character (shows emoji+name when set) */
  playerCharacter?: Character;
  /** AI's assigned character (shows emoji+name when set) */
  aiCharacter?: Character;
}

/**
 * Heads-up display showing:
 * - Round score (stars) with character emoji+name
 * - Ki meters for both players
 * - Turn counter
 * - Turn history (last few moves)
 */
export default function MatchHUD({
  gameState,
  playerName,
  showAIThinking,
  playerCharacter,
  aiCharacter,
}: MatchHUDProps) {
  const round = gameState.current_round;
  const playerKi = round?.p1_ki ?? 0;
  const aiKi = round?.p2_ki ?? 0;
  const turnNumber = round?.turn_number ?? 0;
  const roundNumber = round?.round_number ?? gameState.round_results.length;

  // Display labels: name only (pixel portraits handle the visual identity)
  const playerLabel = playerCharacter ? playerCharacter.name : playerName;
  const aiLabel = aiCharacter ? aiCharacter.name : "AI";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Round score */}
      <div className="flex justify-center items-center gap-4">
        <ScoreDots
          label={playerLabel}
          wins={gameState.rounds_won_p1}
          color="green"
          characterId={playerCharacter?.id}
        />
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            Round {roundNumber}
          </p>
          <p className="text-lg font-bold text-white">
            {gameState.rounds_won_p1} — {gameState.rounds_won_p2}
          </p>
        </div>
        <ScoreDots label={aiLabel} wins={gameState.rounds_won_p2} color="red" characterId={aiCharacter?.id} />
      </div>

      {/* Ki meters */}
      <div className="space-y-2">
        <KiMeter ki={playerKi} label={playerLabel} isPlayer={true} />
        <KiMeter ki={aiKi} label={aiLabel} isPlayer={false} />
        {showAIThinking && <AIThinking />}
      </div>

      {/* Turn counter */}
      <p className="text-center text-xs text-gray-500">
        Turn {turnNumber} / 20
      </p>

      {/* Recent turn history */}
      {round && round.turn_history.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
            History
          </p>
          <div className="space-y-1">
            {[...round.turn_history].reverse().slice(0, 5).map((turn) => (
              <div
                key={turn.turn_number}
                className="flex justify-between text-xs text-gray-400"
              >
                <span>T{turn.turn_number}</span>
                <span>
                  {playerCharacter?.name ?? "You"}: {turn.p1_action.replace("_", " ")} vs{" "}
                  {aiCharacter?.name ?? "AI"}: {turn.p2_action.replace("_", " ")}
                </span>
                <span className="font-medium">
                  {turn.outcome.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreDots({
  label,
  wins,
  color,
  characterId,
}: {
  label: string;
  wins: number;
  color: "green" | "red";
  characterId?: string;
}) {
  const filled = color === "green" ? "bg-green-500" : "bg-red-500";
  return (
    <div className="flex flex-col items-center gap-1">
      {characterId && <PixelPortrait characterId={characterId} size="sm" />}
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex gap-1">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${
              i < wins ? filled : "bg-gray-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
