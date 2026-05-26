"use client";

import Link from "next/link";
import type { Action } from "@/lib/api";
import ActionCard from "@/components/ActionCard";
import KiMeter from "@/components/KiMeter";
import { BattleArena } from "@/components/deprecated/pixel-art";
import { usePixelAnimation } from "@/hooks/deprecated/usePixelAnimation";
import { useTutorial } from "@/hooks/useTutorial";
import type { PixelAction } from "@/lib/deprecated/pixel-art-types";

const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

const ACTION_EMOJI: Record<string, string> = {
  charge: "\u26A1",
  block: "\uD83D\uDEE1\uFE0F",
  attack: "\uD83D\uDC4A",
  energy_wave: "\uD83D\uDD25",
  teleport: "\uD83D\uDCA8",
};

const ACTION_TO_PIXEL: Record<Action, PixelAction> = {
  charge: "charge",
  block: "block",
  attack: "attack",
  energy_wave: "energyWave",
  teleport: "teleport",
};

export default function TutorialPage() {
  const {
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
  } = useTutorial();

  const {
    action: pixelAct,
    phase: pixelPhase,
    triggerAction: triggerPixel,
  } = usePixelAnimation();

  // Derive AI pixel action — synced to same phase as player
  const aiPixelAction: PixelAction | null =
    pixelAct && aiAction ? ACTION_TO_PIXEL[aiAction as Action] : null;

  const handleSubmit = (action: Action) => {
    submitAction(action);
    triggerPixel(ACTION_TO_PIXEL[action]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      {/* INTRO */}
      {phase === "intro" && (
        <div className="text-center space-y-8 max-w-md">
          <div>
            <h1 className="text-4xl font-black mb-2">Tutorial</h1>
            <p className="text-gray-400">
              Learn the basics in 3 quick rounds.
            </p>
          </div>

          <BattleArena
            playerCharacterId="haneul"
            aiCharacterId="bora"
          />

          <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-300 space-y-2 text-left">
            <p><strong>5 Actions:</strong> Charge, Block, Attack, Energy Wave, Teleport</p>
            <p><strong>Goal:</strong> Read your opponent and land a hit while they&apos;re vulnerable.</p>
            <p><strong>Ki:</strong> You need ki to attack. Charge to build it up!</p>
          </div>

          <button
            onClick={startTutorial}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl
                       text-xl font-bold transition-colors"
          >
            Start Tutorial
          </button>

          <Link
            href="/"
            className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Skip to game
          </Link>
        </div>
      )}

      {/* PLAYING — pick action */}
      {phase === "playing" && currentStep && (
        <div className="w-full max-w-2xl space-y-6">
          {/* Progress */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-8 h-1 rounded-full ${
                  i < stepIndex
                    ? "bg-green-500"
                    : i === stepIndex
                      ? "bg-blue-500"
                      : "bg-gray-700"
                }`}
              />
            ))}
          </div>

          <div className="text-center">
            <h2 className="text-xl font-bold">{currentStep.title}</h2>
          </div>

          <BattleArena
            playerCharacterId="haneul"
            aiCharacterId="bora"
          />

          {/* Ki meters */}
          <div className="space-y-2">
            <KiMeter ki={playerKi} label="You" isPlayer={true} />
            <KiMeter ki={aiKi} label="AI" isPlayer={false} />
          </div>

          {/* Instruction callout */}
          <div className="bg-blue-900/40 border border-blue-500/50 rounded-xl px-4 py-3 text-center">
            <p className="text-blue-200 font-medium">
              {currentStep.instruction}
            </p>
          </div>

          {/* Action cards — highlight the expected one */}
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {ACTIONS.map((action) => {
              const dimmed = !currentStep.highlightActions.includes(action);
              return (
                <div key={action} style={{ opacity: dimmed ? 0.3 : 1 }}>
                  <ActionCard
                    action={action}
                    playerKi={playerKi}
                    isSelected={false}
                    disabled={dimmed}
                    onSelect={handleSubmit}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REVEALING — show what happened */}
      {phase === "revealing" && currentStep && playerAction && aiAction && (
        <div className="w-full max-w-2xl space-y-6">
          <BattleArena
            playerCharacterId="haneul"
            aiCharacterId="bora"
            playerAction={pixelAct}
            aiAction={aiPixelAction}
            phase={pixelPhase}
          />

          <div className="flex items-center justify-center gap-8 py-4">
            <div className="flex flex-col items-center">
              <span className="text-4xl">{ACTION_EMOJI[playerAction]}</span>
              <span className="text-sm text-gray-400 mt-1 capitalize">
                {playerAction.replace("_", " ")}
              </span>
              <span className="text-xs text-green-400">You</span>
            </div>
            <span className="text-2xl font-bold text-gray-500">VS</span>
            <div className="flex flex-col items-center">
              <span className="text-4xl">{ACTION_EMOJI[aiAction]}</span>
              <span className="text-sm text-gray-400 mt-1 capitalize">
                {aiAction.replace("_", " ")}
              </span>
              <span className="text-xs text-red-400">AI</span>
            </div>
          </div>

          <button
            onClick={continueFromReveal}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl
                       text-lg font-medium transition-colors"
          >
            What happened? →
          </button>
        </div>
      )}

      {/* EXPLANATION */}
      {phase === "explanation" && currentStep && (
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="text-4xl">
            {stepIndex === 0 ? "⚡" : stepIndex === 1 ? "💥" : "🛡️"}
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <p className="text-gray-200 leading-relaxed">
              {currentStep.explanation}
            </p>
          </div>

          <button
            onClick={continueFromExplanation}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl
                       text-lg font-bold transition-colors"
          >
            {stepIndex < 2 ? "Next Lesson →" : "Finish Tutorial →"}
          </button>
        </div>
      )}

      {/* COMPLETE */}
      {phase === "complete" && (
        <div className="w-full max-w-md text-center space-y-6">
          <BattleArena
            playerCharacterId="haneul"
            aiCharacterId="bora"
          />

          <div>
            <h2 className="text-3xl font-black text-green-400">
              Tutorial Complete!
            </h2>
            <p className="text-gray-400 mt-2">
              You know the basics. There are 2 more moves to discover:
              <strong className="text-orange-400"> Energy Wave</strong> (pierces Block, costs 3 ki) and
              <strong className="text-purple-400"> Teleport</strong> (dodges all attacks, costs 1 ki).
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl
                         text-xl font-bold transition-colors text-center"
            >
              Play vs AI →
            </Link>
            <button
              onClick={restart}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl
                         text-sm font-medium transition-colors"
            >
              Replay Tutorial
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
