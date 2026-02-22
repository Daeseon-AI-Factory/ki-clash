/**
 * TurnReveal — shows the result of a turn (both actions + outcome).
 *
 * Displays emoji face-off with outcome text and color coding.
 * Triggers haptic feedback on hit.
 */

import { useEffect } from "react";
import { useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { TurnResult, TurnOutcome } from "@/lib/api";

interface TurnRevealProps {
  turnResult: TurnResult | null;
  visible: boolean;
}

const ACTION_EMOJI: Record<string, string> = {
  charge: "⚡",
  block: "🛡️",
  attack: "👊",
  energy_wave: "🔥",
  teleport: "💨",
};

const OUTCOME_DISPLAY: Record<
  TurnOutcome,
  { text: string; color: string }
> = {
  p1_wins_round: { text: "HIT!", color: colors.green },
  p2_wins_round: { text: "HIT!", color: colors.red },
  clash: { text: "CLASH!", color: colors.yellow },
  blocked: { text: "BLOCKED!", color: colors.blue },
  dodged: { text: "DODGED!", color: colors.purple },
  neutral: { text: "—", color: colors.textSecondary },
};

export default function TurnReveal({ turnResult, visible }: TurnRevealProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && turnResult) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Haptic on reveal
      if (
        turnResult.outcome === "p1_wins_round" ||
        turnResult.outcome === "p2_wins_round"
      ) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (turnResult.outcome === "clash") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible, turnResult, scaleAnim, opacityAnim]);

  if (!turnResult || !visible) return null;

  const display = OUTCOME_DISPLAY[turnResult.outcome];

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View style={styles.faceOff}>
        <View style={styles.side}>
          <Text style={styles.actionEmoji}>
            {ACTION_EMOJI[turnResult.p1_action] || "❓"}
          </Text>
          <Text style={styles.actionLabel}>
            {turnResult.p1_action.replace("_", " ")}
          </Text>
          <Text style={[styles.playerLabel, { color: colors.green }]}>You</Text>
        </View>

        <Text style={styles.vs}>VS</Text>

        <View style={styles.side}>
          <Text style={styles.actionEmoji}>
            {ACTION_EMOJI[turnResult.p2_action] || "❓"}
          </Text>
          <Text style={styles.actionLabel}>
            {turnResult.p2_action.replace("_", " ")}
          </Text>
          <Text style={[styles.playerLabel, { color: colors.red }]}>AI</Text>
        </View>
      </View>

      <Text style={[styles.outcome, { color: display.color }]}>
        {display.text}
      </Text>

      <View style={styles.kiRow}>
        <Text style={styles.kiText}>Your Ki: {turnResult.p1_ki_after}</Text>
        <Text style={styles.kiText}>AI Ki: {turnResult.p2_ki_after}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: "center",
  },
  faceOff: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  side: {
    alignItems: "center",
    gap: 4,
  },
  actionEmoji: {
    fontSize: 36,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: "capitalize",
  },
  playerLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  vs: {
    fontSize: fontSize.xl,
    fontWeight: "900",
    color: colors.textMuted,
  },
  outcome: {
    fontSize: fontSize.xxxl,
    fontWeight: "900",
  },
  kiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  kiText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
