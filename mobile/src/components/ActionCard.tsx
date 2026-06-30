/**
 * ActionCard — a single action button for the game board.
 *
 * Displays action emoji, name (English + Korean), ki cost.
 * Dims when player can't afford it. Highlights when selected.
 * Tap to select, tap again to confirm (double-tap pattern).
 */

import { useState } from "react";
import { TouchableOpacity, View, Text, Image, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Action } from "@/lib/api";

interface ActionCardProps {
  action: Action;
  playerKi: number;
  isSelected: boolean;
  disabled: boolean;
  onSelect: (action: Action) => void;
  /**
   * Optional bundled image asset (require result) to render instead of emoji.
   * Pass `null`/`undefined` to use the emoji fallback.
   */
  iconAsset?: number | null;
}

interface ActionConfig {
  emoji: string;
  label: string;
  korean: string;
  cost: number;
  color: string;
  bgColor: string;
}

const ACTION_CONFIG: Record<Action, ActionConfig> = {
  charge: {
    emoji: "⚡",
    label: "Charge",
    korean: "모으기",
    cost: 0,
    color: colors.charge,
    bgColor: "#422006",
  },
  block: {
    emoji: "🛡️",
    label: "Block",
    korean: "막기",
    cost: 0,
    color: colors.block,
    bgColor: "#172554",
  },
  attack: {
    emoji: "👊",
    label: "Attack",
    korean: "파",
    cost: 1,
    color: colors.attack,
    bgColor: "#450A0A",
  },
  energy_wave: {
    emoji: "🔥",
    label: "Burst",
    korean: "기폭",
    cost: 3,
    color: colors.energyWave,
    bgColor: "#431407",
  },
  teleport: {
    emoji: "💨",
    label: "Teleport",
    korean: "순간이동",
    cost: 1,
    color: colors.teleport,
    bgColor: "#3B0764",
  },
};

export default function ActionCard({
  action,
  playerKi,
  isSelected,
  disabled,
  onSelect,
  iconAsset,
}: ActionCardProps) {
  const config = ACTION_CONFIG[action];
  const canAfford = playerKi >= config.cost;
  const isDisabled = disabled || !canAfford;
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = iconAsset != null && !imageBroken;

  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(action);
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: config.bgColor, borderColor: config.color },
        isSelected && styles.selected,
        isDisabled && styles.disabled,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={isDisabled}
    >
      {showImage ? (
        <Image
          source={iconAsset as number}
          style={styles.icon}
          onError={() => setImageBroken(true)}
        />
      ) : (
        <Text style={styles.emoji}>{config.emoji}</Text>
      )}
      <Text style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
      <Text style={styles.korean}>{config.korean}</Text>
      {config.cost > 0 && (
        <View
          style={[
            styles.costBadge,
            { backgroundColor: canAfford ? colors.charge : colors.textMuted },
          ]}
        >
          <Text style={styles.costText}>{config.cost}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: 2,
    flex: 1,
  },
  selected: {
    borderWidth: 3,
    shadowColor: "#FFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabled: {
    opacity: 0.4,
  },
  emoji: {
    fontSize: 24,
  },
  icon: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    textAlign: "center",
  },
  korean: {
    fontSize: 8,
    color: colors.textMuted,
    textAlign: "center",
  },
  costBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  costText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.background,
  },
});
