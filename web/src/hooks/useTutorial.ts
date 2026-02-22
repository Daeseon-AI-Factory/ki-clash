"use client";

import { useState, useCallback } from "react";
import type { Action } from "@/lib/api";

/**
 * Tutorial step definitions.
 *
 * Each step teaches one concept with a scripted AI response so the
 * player always sees the intended outcome on their first try.
 */

export interface TutorialStep {
  /** Step number (1-indexed) */
  step: number;
  /** Title shown above the arena */
  title: string;
  /** Instruction telling player what to do */
  instruction: string;
  /** Which action the player should pick */
  expectedAction: Action;
  /** What the AI will play (scripted for guaranteed outcome) */
  aiAction: Action;
  /** Outcome explanation shown after reveal */
  explanation: string;
  /** Highlight specific cards (dims others) */
  highlightActions: Action[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    step: 1,
    title: "Step 1: Charge Your Ki",
    instruction: "Tap CHARGE to build up ki energy. You need ki to attack!",
    expectedAction: "charge",
    aiAction: "charge",
    highlightActions: ["charge"],
    explanation:
      "Both fighters charged! You gained +1 ki. Ki is your fuel — you need it for Attack (1 ki) and Energy Wave (3 ki).",
  },
  {
    step: 2,
    title: "Step 2: Attack!",
    instruction:
      "Now you have ki! Tap ATTACK to strike. The AI is charging — they're vulnerable!",
    expectedAction: "attack",
    aiAction: "charge",
    highlightActions: ["attack"],
    explanation:
      "Your Attack hit while they were Charging! That wins the round. Attack costs 1 ki and beats anyone who's Charging.",
  },
  {
    step: 3,
    title: "Step 3: Block & Counter",
    instruction:
      "The AI will Attack this time. Tap BLOCK to defend yourself!",
    expectedAction: "block",
    aiAction: "attack",
    highlightActions: ["block"],
    explanation:
      "You blocked the Attack! Block costs 0 ki and stops basic Attacks. But watch out — Energy Wave pierces through Block!",
  },
];

export type TutorialPhase =
  | "intro"
  | "playing"
  | "revealing"
  | "explanation"
  | "complete";

interface UseTutorialReturn {
  phase: TutorialPhase;
  currentStep: TutorialStep | null;
  stepIndex: number;
  playerKi: number;
  aiKi: number;
  playerAction: Action | null;
  aiAction: Action | null;
  startTutorial: () => void;
  submitAction: (action: Action) => void;
  continueFromReveal: () => void;
  continueFromExplanation: () => void;
  restart: () => void;
}

export function useTutorial(): UseTutorialReturn {
  const [phase, setPhase] = useState<TutorialPhase>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [playerKi, setPlayerKi] = useState(0);
  const [aiKi, setAiKi] = useState(0);
  const [playerAction, setPlayerAction] = useState<Action | null>(null);
  const [aiAction, setAiAction] = useState<Action | null>(null);

  const currentStep =
    stepIndex < TUTORIAL_STEPS.length ? TUTORIAL_STEPS[stepIndex] : null;

  const startTutorial = useCallback(() => {
    setStepIndex(0);
    setPlayerKi(0);
    setAiKi(0);
    setPlayerAction(null);
    setAiAction(null);
    setPhase("playing");
  }, []);

  const submitAction = useCallback(
    (action: Action) => {
      if (!currentStep) return;

      setPlayerAction(action);
      setAiAction(currentStep.aiAction);

      // Simple ki calculation
      let newPlayerKi = playerKi;
      let newAiKi = aiKi;

      if (action === "charge") newPlayerKi += 1;
      if (action === "attack") newPlayerKi -= 1;
      if (action === "energy_wave") newPlayerKi -= 3;
      if (action === "teleport") newPlayerKi -= 1;

      if (currentStep.aiAction === "charge") newAiKi += 1;
      if (currentStep.aiAction === "attack") newAiKi -= 1;

      setPlayerKi(Math.max(0, newPlayerKi));
      setAiKi(Math.max(0, newAiKi));
      setPhase("revealing");
    },
    [currentStep, playerKi, aiKi]
  );

  const continueFromReveal = useCallback(() => {
    setPhase("explanation");
  }, []);

  const continueFromExplanation = useCallback(() => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= TUTORIAL_STEPS.length) {
      setPhase("complete");
    } else {
      setStepIndex(nextIndex);
      setPlayerAction(null);
      setAiAction(null);
      setPhase("playing");
    }
  }, [stepIndex]);

  const restart = useCallback(() => {
    setPhase("intro");
    setStepIndex(0);
    setPlayerKi(0);
    setAiKi(0);
    setPlayerAction(null);
    setAiAction(null);
  }, []);

  return {
    phase,
    currentStep,
    stepIndex,
    playerKi,
    aiKi,
    playerAction,
    aiAction,
    startTutorial,
    submitAction,
    continueFromReveal,
    continueFromExplanation,
    restart,
  };
}
