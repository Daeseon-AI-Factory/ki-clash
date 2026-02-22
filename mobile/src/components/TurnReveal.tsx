/**
 * TurnReveal — dramatic staged reveal with card flip animation.
 *
 * 4-stage internal state machine:
 * 1. face_down — both cards show "?" (0ms)
 * 2. flipping — Animated.timing rotateY 0→180° (500ms)
 * 3. paused — cards visible, outcome hidden (300ms)
 * 4. outcome — outcome text scales in, screen shake triggers
 *
 * Uses two overlapping Views per card: front swaps to visible at 90°.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { TurnResult, TurnOutcome } from "@/lib/api";

type RevealStage = "face_down" | "flipping" | "paused" | "outcome";

interface TurnRevealProps {
  turnResult: TurnResult | null;
  visible: boolean;
  /** Called when outcome stage begins — used to trigger screen shake */
  onOutcomeRevealed?: (outcome: TurnOutcome) => void;
}

const ACTION_EMOJI: Record<string, string> = {
  charge: "\u26A1",
  block: "\uD83D\uDEE1\uFE0F",
  attack: "\uD83D\uDC4A",
  energy_wave: "\uD83D\uDD25",
  teleport: "\uD83D\uDCA8",
};

const OUTCOME_DISPLAY: Record<
  TurnOutcome,
  { text: string; color: string; subtext: string }
> = {
  p1_wins_round: { text: "HIT!", color: colors.green, subtext: "You win the round!" },
  p2_wins_round: { text: "HIT!", color: colors.red, subtext: "AI wins the round!" },
  clash: { text: "CLASH!", color: colors.yellow, subtext: "Both lose ki" },
  blocked: { text: "BLOCKED!", color: colors.blue, subtext: "Attack was blocked" },
  dodged: { text: "DODGED!", color: colors.purple, subtext: "Attack was dodged" },
  neutral: { text: "\u2014", color: colors.textSecondary, subtext: "No effect" },
};

/** Returns shake intensity based on outcome */
export function getShakeIntensity(outcome: TurnOutcome): number {
  switch (outcome) {
    case "p1_wins_round":
    case "p2_wins_round":
      return 6;
    case "clash":
      return 3;
    case "blocked":
    case "dodged":
      return 2;
    default:
      return 0;
  }
}

export default function TurnReveal({
  turnResult,
  visible,
  onOutcomeRevealed,
}: TurnRevealProps) {
  const [stage, setStage] = useState<RevealStage>("face_down");
  const flipAnim = useRef(new Animated.Value(0)).current;
  const outcomeScale = useRef(new Animated.Value(0)).current;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!visible || !turnResult) {
      setStage("face_down");
      flipAnim.setValue(0);
      outcomeScale.setValue(0);
      return;
    }

    setStage("face_down");
    flipAnim.setValue(0);
    outcomeScale.setValue(0);

    // Stage 1→2: Start flip after brief pause
    timersRef.current.push(
      setTimeout(() => {
        setStage("flipping");
        Animated.timing(flipAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 100)
    );

    // Stage 2→3: Pause
    timersRef.current.push(
      setTimeout(() => {
        setStage("paused");
      }, 600)
    );

    // Stage 3→4: Outcome
    timersRef.current.push(
      setTimeout(() => {
        setStage("outcome");
        onOutcomeRevealed?.(turnResult.outcome);

        // Haptic feedback based on outcome
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

        Animated.spring(outcomeScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }).start();
      }, 900)
    );

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [visible, turnResult, onOutcomeRevealed, flipAnim, outcomeScale]);

  if (!turnResult || !visible) return null;

  const display = OUTCOME_DISPLAY[turnResult.outcome];

  // Interpolate flip rotation
  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["180deg", "90deg", "0deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "90deg", "180deg"],
  });
  // Swap visibility at midpoint — front becomes visible after 90°
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  return (
    <View style={styles.container}>
      {/* Cards face-off */}
      <View style={styles.faceOff}>
        <FlipCard
          emoji={ACTION_EMOJI[turnResult.p1_action] || "?"}
          label={turnResult.p1_action.replace("_", " ")}
          who="You"
          whoColor={colors.green}
          frontRotate={frontRotate}
          backRotate={backRotate}
          frontOpacity={frontOpacity}
          backOpacity={backOpacity}
        />
        <Text style={styles.vs}>VS</Text>
        <FlipCard
          emoji={ACTION_EMOJI[turnResult.p2_action] || "?"}
          label={turnResult.p2_action.replace("_", " ")}
          who="AI"
          whoColor={colors.red}
          frontRotate={frontRotate}
          backRotate={backRotate}
          frontOpacity={frontOpacity}
          backOpacity={backOpacity}
        />
      </View>

      {/* Outcome — pops in at stage 4 */}
      <View style={styles.outcomeContainer}>
        {stage === "outcome" && (
          <Animated.View style={{ transform: [{ scale: outcomeScale }] }}>
            <Text style={[styles.outcomeText, { color: display.color }]}>
              {display.text}
            </Text>
            <Text style={styles.outcomeSubtext}>{display.subtext}</Text>
          </Animated.View>
        )}
      </View>

      {/* Ki values */}
      <View style={styles.kiRow}>
        <Text style={styles.kiText}>Your Ki: {turnResult.p1_ki_after}</Text>
        <Text style={styles.kiText}>AI Ki: {turnResult.p2_ki_after}</Text>
      </View>
    </View>
  );
}

/** Single flip card with front/back faces */
function FlipCard({
  emoji,
  label,
  who,
  whoColor,
  frontRotate,
  backRotate,
  frontOpacity,
  backOpacity,
}: {
  emoji: string;
  label: string;
  who: string;
  whoColor: string;
  frontRotate: Animated.AnimatedInterpolation<string>;
  backRotate: Animated.AnimatedInterpolation<string>;
  frontOpacity: Animated.AnimatedInterpolation<number>;
  backOpacity: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <View style={styles.cardColumn}>
      <View style={styles.cardContainer}>
        {/* Back face — "?" */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardBack,
            {
              opacity: backOpacity,
              transform: [{ perspective: 600 }, { rotateY: backRotate }],
            },
          ]}
        >
          <Text style={styles.cardQuestion}>?</Text>
        </Animated.View>

        {/* Front face — emoji + label */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardFront,
            {
              opacity: frontOpacity,
              transform: [{ perspective: 600 }, { rotateY: frontRotate }],
            },
          ]}
        >
          <Text style={styles.cardEmoji}>{emoji}</Text>
          <Text style={styles.cardLabel}>{label}</Text>
        </Animated.View>
      </View>
      <Text style={[styles.whoLabel, { color: whoColor }]}>{who}</Text>
    </View>
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
  vs: {
    fontSize: fontSize.xl,
    fontWeight: "900",
    color: colors.textMuted,
  },
  cardColumn: {
    alignItems: "center",
    gap: 4,
  },
  cardContainer: {
    width: 80,
    height: 96,
  },
  cardFace: {
    position: "absolute",
    width: 80,
    height: 96,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
  },
  cardBack: {
    backgroundColor: colors.surfaceHover,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardFront: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardQuestion: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.textMuted,
  },
  cardEmoji: {
    fontSize: 36,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textTransform: "capitalize",
    marginTop: 4,
  },
  whoLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  outcomeContainer: {
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  outcomeText: {
    fontSize: fontSize.xxxl,
    fontWeight: "900",
    textAlign: "center",
  },
  outcomeSubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
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
