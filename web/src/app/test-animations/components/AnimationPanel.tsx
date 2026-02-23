"use client";

import { type ReactNode } from "react";
import { useAnimationState } from "./useAnimationState";
import type { AnimationAction, PanelRenderProps } from "./types";

/**
 * Shared wrapper for each animation style panel.
 *
 * Uses the render-prop pattern: the parent provides a label and border color,
 * while the child function receives {action, phase} and renders its own fighters.
 * This keeps every panel visually consistent (header, button row, arena size)
 * while allowing completely different rendering approaches inside.
 */

const ACTIONS: { label: string; action: AnimationAction; icon: string }[] = [
  { label: "Charge", action: "charge", icon: "⚡" },
  { label: "Block", action: "block", icon: "🛡️" },
  { label: "Attack", action: "attack", icon: "👊" },
  { label: "E.Wave", action: "energyWave", icon: "💥" },
  { label: "Teleport", action: "teleport", icon: "✨" },
];

interface AnimationPanelProps {
  title: string;
  borderColor: string;
  children: (props: PanelRenderProps) => ReactNode;
}

export function AnimationPanel({
  title,
  borderColor,
  children,
}: AnimationPanelProps) {
  const { action, phase, triggerAction, isAnimating } = useAnimationState();

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden border-2"
      style={{ borderColor }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 text-center text-sm font-bold text-white"
        style={{ backgroundColor: borderColor }}
      >
        {title}
      </div>

      {/* Arena — fixed height so all panels stay aligned */}
      <div className="relative h-56 bg-gray-900 overflow-hidden flex items-center justify-center">
        {children({ action, phase })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1 p-2 bg-gray-800 justify-center flex-wrap">
        {ACTIONS.map(({ label, action: act, icon }) => (
          <button
            key={act}
            onClick={() => triggerAction(act)}
            disabled={isAnimating}
            className="px-2 py-1.5 text-xs font-medium rounded-lg
                       bg-gray-700 text-gray-200 hover:bg-gray-600
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors cursor-pointer"
          >
            {icon} {label}
          </button>
        ))}
      </div>
    </div>
  );
}
