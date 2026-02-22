"use client";

import type { TurnResult, TurnOutcome } from "@/lib/api";

const OUTCOME_DISPLAY: Record<
  TurnOutcome,
  { text: string; color: string; subtext: string }
> = {
  p1_wins_round: {
    text: "HIT!",
    color: "text-green-400",
    subtext: "You win the round!",
  },
  p2_wins_round: {
    text: "HIT!",
    color: "text-red-400",
    subtext: "AI wins the round!",
  },
  clash: {
    text: "CLASH!",
    color: "text-yellow-400",
    subtext: "Both lose ki",
  },
  blocked: {
    text: "BLOCKED!",
    color: "text-blue-400",
    subtext: "Attack was blocked",
  },
  dodged: {
    text: "DODGED!",
    color: "text-purple-400",
    subtext: "Attack was dodged",
  },
  neutral: {
    text: "—",
    color: "text-gray-400",
    subtext: "No effect",
  },
};

const ACTION_EMOJI: Record<string, string> = {
  charge: "⚡",
  block: "🛡️",
  attack: "👊",
  energy_wave: "🔥",
  teleport: "💨",
};

interface TurnRevealProps {
  turnResult: TurnResult | null;
  visible: boolean;
}

/**
 * Dramatic reveal display showing both players' actions and the outcome.
 * Animates in with a scale + fade effect.
 */
export default function TurnReveal({ turnResult, visible }: TurnRevealProps) {
  if (!turnResult || !visible) return null;

  const outcome = OUTCOME_DISPLAY[turnResult.outcome];

  return (
    <div className="flex flex-col items-center gap-4 py-6 animate-in fade-in zoom-in duration-300">
      {/* Cards face-off */}
      <div className="flex items-center gap-8">
        {/* Player's action */}
        <div className="flex flex-col items-center">
          <span className="text-4xl">
            {ACTION_EMOJI[turnResult.p1_action]}
          </span>
          <span className="text-sm text-gray-400 mt-1">
            {turnResult.p1_action.replace("_", " ")}
          </span>
          <span className="text-xs text-green-400">You</span>
        </div>

        {/* VS */}
        <span className="text-2xl font-bold text-gray-500">VS</span>

        {/* AI's action */}
        <div className="flex flex-col items-center">
          <span className="text-4xl">
            {ACTION_EMOJI[turnResult.p2_action]}
          </span>
          <span className="text-sm text-gray-400 mt-1">
            {turnResult.p2_action.replace("_", " ")}
          </span>
          <span className="text-xs text-red-400">AI</span>
        </div>
      </div>

      {/* Outcome */}
      <div className="text-center">
        <p className={`text-3xl font-black ${outcome.color}`}>
          {outcome.text}
        </p>
        <p className="text-sm text-gray-400 mt-1">{outcome.subtext}</p>
      </div>
    </div>
  );
}
