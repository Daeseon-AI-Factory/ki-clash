/**
 * GameBoard — grid of 5 action cards with select-and-confirm flow.
 *
 * Tap a card to select it. A confirm button appears at the bottom.
 * Tap confirm to submit the action. This prevents accidental plays.
 */

import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import ActionCard from "./ActionCard";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Action } from "@/lib/api";

const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

interface GameBoardProps {
  playerKi: number;
  disabled: boolean;
  onSubmit: (action: Action) => void;
}

export default function GameBoard({
  playerKi,
  disabled,
  onSubmit,
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

  return (
    <View style={styles.container}>
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
