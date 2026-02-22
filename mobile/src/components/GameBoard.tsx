/**
 * GameBoard — grid of 5 action cards with select-and-confirm flow.
 *
 * Includes an inline countdown timer that ticks during selection.
 * When timer hits 0, auto-submits "charge" (safest default).
 */

import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import ActionCard from "./ActionCard";
import Countdown from "./Countdown";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Action } from "@/lib/api";

const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

interface GameBoardProps {
  playerKi: number;
  disabled: boolean;
  onSubmit: (action: Action) => void;
  /** Called on each countdown beat for sound triggers */
  onCountdownBeat?: () => void;
}

export default function GameBoard({
  playerKi,
  disabled,
  onSubmit,
  onCountdownBeat,
}: GameBoardProps) {
  const [selected, setSelected] = useState<Action | null>(null);

  const handleSelect = (action: Action) => {
    if (selected === action) {
      // Double-tap = confirm
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSubmit(action);
      setSelected(null);
    } else {
      setSelected(action);
    }
  };

  const handleConfirm = () => {
    if (selected) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    <View style={styles.container}>
      {/* Selection countdown timer */}
      {!disabled && (
        <Countdown
          seconds={3}
          onTimeout={handleTimeout}
          onBeat={onCountdownBeat}
        />
      )}

      <View style={styles.grid}>
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
      </View>

      {selected && !disabled && (
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          activeOpacity={0.7}
        >
          <Text style={styles.confirmText}>
            Confirm {selected.replace("_", " ")} ✓
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  confirmButton: {
    backgroundColor: colors.btnSuccess,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  confirmText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
    textTransform: "capitalize",
  },
});
