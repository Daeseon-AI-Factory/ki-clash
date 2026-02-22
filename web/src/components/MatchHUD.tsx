"use client";

import type { GameState, RoundResult } from "@/lib/api";
import KiMeter from "./KiMeter";

interface MatchHUDProps {
  gameState: GameState;
  playerName: string;
}

/**
 * Heads-up display showing:
 * - Round score (stars)
 * - Ki meters for both players
 * - Turn counter
 * - Turn history (last few moves)
 */
export default function MatchHUD({ gameState, playerName }: MatchHUDProps) {
  const round = gameState.current_round;
  const playerKi = round?.p1_ki ?? 0;
  const aiKi = round?.p2_ki ?? 0;
  const turnNumber = round?.turn_number ?? 0;
  const roundNumber = round?.round_number ?? gameState.round_results.length;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Round score */}
      <div className="flex justify-center items-center gap-4">
        <ScoreDots
          label={playerName}
          wins={gameState.rounds_won_p1}
          color="green"
        />
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            Round {roundNumber}
          </p>
          <p className="text-lg font-bold text-white">
            {gameState.rounds_won_p1} — {gameState.rounds_won_p2}
          </p>
        </div>
        <ScoreDots label="AI" wins={gameState.rounds_won_p2} color="red" />
      </div>

      {/* Ki meters */}
      <div className="space-y-2">
        <KiMeter ki={playerKi} label={`${playerName} (You)`} isPlayer={true} />
        <KiMeter ki={aiKi} label="AI Opponent" isPlayer={false} />
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
                  You: {turn.p1_action.replace("_", " ")} vs AI:{" "}
                  {turn.p2_action.replace("_", " ")}
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
}: {
  label: string;
  wins: number;
  color: "green" | "red";
}) {
  const filled = color === "green" ? "bg-green-500" : "bg-red-500";
  return (
    <div className="flex flex-col items-center gap-1">
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
