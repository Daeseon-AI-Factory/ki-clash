"use client";

import { useState } from "react";
import { cardIconAsset } from "@/lib/assets";
import type { Action } from "@/lib/api";

/**
 * Visual config for each action card.
 * Maps game actions to display properties (label, Korean name, color, emoji, ki cost).
 *
 * Icon resolution: if a file exists at `cardIconAsset(action)` it renders;
 * otherwise the emoji defined here is used as the fallback.
 */
const ACTION_CONFIG: Record<
  Action,
  {
    label: string;
    korean: string;
    emoji: string;
    cost: number;
    color: string;        // tailwind border/ring color when selected
    bgColor: string;      // tailwind bg color
    description: string;
  }
> = {
  charge: {
    label: "Charge",
    korean: "기 모으기",
    emoji: "⚡",
    cost: 0,
    color: "border-yellow-400 ring-yellow-400",
    bgColor: "bg-yellow-500/10",
    description: "+1 Ki",
  },
  block: {
    label: "Block",
    korean: "막기",
    emoji: "🛡️",
    cost: 0,
    color: "border-blue-400 ring-blue-400",
    bgColor: "bg-blue-500/10",
    description: "Blocks Attack",
  },
  attack: {
    label: "Attack",
    korean: "파",
    emoji: "👊",
    cost: 1,
    color: "border-red-400 ring-red-400",
    bgColor: "bg-red-500/10",
    description: "Hits Charge",
  },
  energy_wave: {
    label: "Energy Wave",
    korean: "에네르기파",
    emoji: "🔥",
    cost: 3,
    color: "border-orange-400 ring-orange-400",
    bgColor: "bg-orange-500/10",
    description: "Pierces Block",
  },
  teleport: {
    label: "Teleport",
    korean: "순간이동",
    emoji: "💨",
    cost: 1,
    color: "border-purple-400 ring-purple-400",
    bgColor: "bg-purple-500/10",
    description: "Dodges attacks",
  },
};

interface ActionCardProps {
  action: Action;
  playerKi: number;
  isSelected: boolean;
  disabled: boolean;
  onSelect: (action: Action) => void;
}

export default function ActionCard({
  action,
  playerKi,
  isSelected,
  disabled,
  onSelect,
}: ActionCardProps) {
  const config = ACTION_CONFIG[action];
  const canAfford = playerKi >= config.cost;
  const isDisabled = disabled || !canAfford;

  return (
    <button
      onClick={() => !isDisabled && onSelect(action)}
      disabled={isDisabled}
      className={`
        relative flex flex-col items-center justify-center
        w-full p-3 sm:p-4 rounded-xl border-2 transition-all duration-200
        ${
          isSelected
            ? `${config.color} ring-2 scale-105 ${config.bgColor}`
            : isDisabled
              ? "border-gray-700 bg-gray-800/50 opacity-40 cursor-not-allowed"
              : `border-gray-600 bg-gray-800 hover:border-gray-400 hover:scale-102 cursor-pointer`
        }
      `}
    >
      {/* Ki cost badge */}
      {config.cost > 0 && (
        <span
          className={`
            absolute -top-2 -right-2 text-xs font-bold px-2 py-0.5 rounded-full
            ${canAfford ? "bg-yellow-500 text-black" : "bg-gray-600 text-gray-400"}
          `}
        >
          {config.cost} Ki
        </span>
      )}

      {/* Icon (SVG asset if available, emoji fallback otherwise) */}
      <ActionIcon action={action} emoji={config.emoji} />

      {/* Action name */}
      <span className="text-sm sm:text-base font-bold text-white">
        {config.label}
      </span>

      {/* Korean name */}
      <span className="text-xs text-gray-400">{config.korean}</span>

      {/* Description */}
      <span className="text-xs text-gray-500 mt-1">{config.description}</span>
    </button>
  );
}

/** Renders the action's SVG icon if present, falling back to the emoji. */
function ActionIcon({ action, emoji }: { action: Action; emoji: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return <span className="text-2xl sm:text-3xl mb-1">{emoji}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- needs onError fallback
    <img
      src={cardIconAsset(action)}
      alt=""
      className="w-8 h-8 sm:w-10 sm:h-10 mb-1 object-contain"
      onError={() => setBroken(true)}
    />
  );
}
