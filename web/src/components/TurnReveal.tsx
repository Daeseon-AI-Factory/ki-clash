"use client";

import { useEffect, useState, useRef } from "react";
import type { TurnResult, TurnOutcome } from "@/lib/api";

type RevealStage = "face_down" | "flipping" | "paused" | "outcome";

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
    text: "\u2014",
    color: "text-gray-400",
    subtext: "No effect",
  },
};

const ACTION_EMOJI: Record<string, string> = {
  charge: "\u26A1",
  block: "\uD83D\uDEE1\uFE0F",
  attack: "\uD83D\uDC4A",
  energy_wave: "\uD83D\uDD25",
  teleport: "\uD83D\uDCA8",
};

/** Maps outcome to shake CSS class */
export function getShakeClass(outcome: TurnOutcome): string {
  switch (outcome) {
    case "p1_wins_round":
    case "p2_wins_round":
      return "animate-shake-strong";
    case "clash":
      return "animate-shake-medium";
    case "blocked":
    case "dodged":
      return "animate-shake-light";
    default:
      return "";
  }
}

interface TurnRevealProps {
  turnResult: TurnResult | null;
  visible: boolean;
  /** Callback when the outcome stage begins — used to trigger screen shake */
  onOutcomeRevealed?: (outcome: TurnOutcome) => void;
  /** Player display name for flip card label (default: "You") */
  playerName?: string;
  /** AI display name for flip card label (default: "AI") */
  aiName?: string;
}

/**
 * Dramatic turn reveal with staged animation:
 * 1. face_down (0ms) — both cards show "?" card backs
 * 2. flipping (0→500ms) — CSS 3D rotateY flip reveals actions
 * 3. paused (500→800ms) — cards visible, outcome hidden
 * 4. outcome (800ms+) — outcome text pops in with bounce
 */
export default function TurnReveal({
  turnResult,
  visible,
  onOutcomeRevealed,
  playerName = "You",
  aiName = "AI",
}: TurnRevealProps) {
  const [stage, setStage] = useState<RevealStage>("face_down");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Clear previous timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!visible || !turnResult) {
      setStage("face_down");
      return;
    }

    // Start face-down, then advance through stages
    setStage("face_down");

    timersRef.current.push(
      setTimeout(() => setStage("flipping"), 100) // brief pause before flip
    );

    timersRef.current.push(
      setTimeout(() => setStage("paused"), 600) // after 500ms flip
    );

    timersRef.current.push(
      setTimeout(() => {
        setStage("outcome");
        onOutcomeRevealed?.(turnResult.outcome);
      }, 900)
    );

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [visible, turnResult, onOutcomeRevealed]);

  if (!turnResult || !visible) return null;

  const outcome = OUTCOME_DISPLAY[turnResult.outcome];
  const isFlipped = stage !== "face_down";
  const showOutcome = stage === "outcome";

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* Cards face-off */}
      <div className="flex items-center gap-8">
        {/* Player's card */}
        <FlipCard
          emoji={ACTION_EMOJI[turnResult.p1_action]}
          label={turnResult.p1_action.replace("_", " ")}
          who={playerName}
          whoColor="text-green-400"
          flipped={isFlipped}
        />

        {/* VS divider */}
        <span className="text-2xl font-bold text-gray-500">VS</span>

        {/* AI's card */}
        <FlipCard
          emoji={ACTION_EMOJI[turnResult.p2_action]}
          label={turnResult.p2_action.replace("_", " ")}
          who={aiName}
          whoColor="text-red-400"
          flipped={isFlipped}
        />
      </div>

      {/* Outcome — pops in at stage 4 */}
      <div className="text-center min-h-[4rem]">
        {showOutcome && (
          <div className="animate-outcome-pop">
            <p className={`text-3xl font-black ${outcome.color}`}>
              {outcome.text}
            </p>
            <p className="text-sm text-gray-400 mt-1">{outcome.subtext}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Single flip card — shows "?" on back, emoji on front */
function FlipCard({
  emoji,
  label,
  who,
  whoColor,
  flipped,
}: {
  emoji: string;
  label: string;
  who: string;
  whoColor: string;
  flipped: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="card-flip-container w-20 h-24">
        <div className={`card-flip-inner w-full h-full ${flipped ? "flipped" : ""}`}>
          {/* Back face — "?" card */}
          <div className="card-face card-back w-full h-full rounded-xl bg-gray-700 border-2 border-gray-600">
            <span className="text-4xl text-gray-500 font-black">?</span>
          </div>
          {/* Front face — action emoji */}
          <div className="card-face card-front w-full h-full rounded-xl bg-gray-800 border-2 border-gray-600">
            <span className="text-4xl">{emoji}</span>
            <span className="text-xs text-gray-400 mt-1 capitalize">{label}</span>
          </div>
        </div>
      </div>
      <span className={`text-xs ${whoColor}`}>{who}</span>
    </div>
  );
}
