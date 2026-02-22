"use client";

import { useState, useCallback } from "react";
import type { Action } from "@/lib/api";
import ActionCard from "./ActionCard";
import Countdown from "./Countdown";

const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

interface GameBoardProps {
  playerKi: number;
  disabled: boolean;
  onSubmit: (action: Action) => void;
  /** Called on each countdown beat for sound triggers */
  onCountdownBeat?: () => void;
}

/**
 * Game board showing 5 action cards in a row with an inline countdown timer.
 *
 * The timer ticks during action selection. When it hits 0, auto-submits
 * "charge" (the safest default — costs 0 ki and builds resources).
 * Player can tap to select, then confirm before the timer expires.
 */
export default function GameBoard({
  playerKi,
  disabled,
  onSubmit,
  onCountdownBeat,
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

  /** Auto-submit Charge when timer expires */
  const handleTimeout = useCallback(() => {
    onSubmit("charge");
    setSelected(null);
  }, [onSubmit]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Selection countdown timer */}
      {!disabled && (
        <div className="mb-4">
          <Countdown
            seconds={3}
            onTimeout={handleTimeout}
            onBeat={onCountdownBeat}
          />
        </div>
      )}

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
