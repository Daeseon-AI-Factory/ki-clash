"use client";

import { useState } from "react";
import type { Action } from "@/lib/api";
import ActionCard from "./ActionCard";

const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

interface GameBoardProps {
  playerKi: number;
  disabled: boolean;
  onSubmit: (action: Action) => void;
}

/**
 * Game board showing 5 action cards in a row.
 * Player taps a card to select, then confirms by tapping again or
 * the selection auto-submits.
 */
export default function GameBoard({
  playerKi,
  disabled,
  onSubmit,
}: GameBoardProps) {
  const [selected, setSelected] = useState<Action | null>(null);

  const handleSelect = (action: Action) => {
    if (disabled) return;

    if (selected === action) {
      // Double-tap = confirm
      onSubmit(action);
      setSelected(null);
    } else {
      setSelected(action);
    }
  };

  const handleConfirm = () => {
    if (selected && !disabled) {
      onSubmit(selected);
      setSelected(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Action cards grid */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-4">
        {ACTIONS.map((action) => (
          <ActionCard
            key={action}
            action={action}
            playerKi={playerKi}
            isSelected={selected === action}
            disabled={disabled}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Confirm button */}
      {selected && !disabled && (
        <button
          onClick={handleConfirm}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold
                     rounded-xl text-lg transition-colors animate-pulse"
        >
          Confirm {selected.replace("_", " ").toUpperCase()}
        </button>
      )}
    </div>
  );
}
