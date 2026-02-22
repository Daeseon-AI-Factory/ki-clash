/**
 * Countdown — inline selection timer bar.
 *
 * A shrinking bar with countdown number that ticks during action selection.
 * When it hits 0, fires onTimeout (auto-submits Charge).
 * Uses Animated.timing for smooth bar animation.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fontSize, spacing } from "@/lib/theme";

interface CountdownProps {
  /** Total seconds for the timer */
  seconds?: number;
  /** Called when timer reaches 0 */
  onTimeout: () => void;
  /** Called on each second tick for sound triggers */
  onBeat?: () => void;
  /** Set to true to pause/reset the timer */
  paused?: boolean;
}

const DEFAULT_SECONDS = 3;

export default function Countdown({
  seconds = DEFAULT_SECONDS,
  onTimeout,
  onBeat,
  paused = false,
}: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);
  const barAnim = useRef(new Animated.Value(1)).current;
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);
  const lastBeatRef = useRef(seconds);

  useEffect(() => {
    if (paused) return;

    // Reset state
    startTimeRef.current = Date.now();
    setRemaining(seconds);
    firedRef.current = false;
    lastBeatRef.current = seconds;
    barAnim.setValue(1);

    // Fire initial beat
    onBeat?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animate bar from 1 → 0
    Animated.timing(barAnim, {
      toValue: 0,
      duration: seconds * 1000,
      useNativeDriver: false, // width% needs non-native driver
    }).start();

    // Tick every 100ms to update the number display
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);

      // Fire beat on each whole-second boundary
      const currentSecond = Math.ceil(left);
      if (currentSecond < lastBeatRef.current && currentSecond > 0) {
        lastBeatRef.current = currentSecond;
        onBeat?.();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onBeat?.();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onTimeout();
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      barAnim.stopAnimation();
    };
  }, [seconds, paused, onTimeout, onBeat, barAnim]);

  const displayNumber = Math.ceil(remaining);
  const fraction = remaining / seconds;

  // Color transitions: green → yellow → red
  const barColor =
    fraction > 0.5
      ? colors.green
      : fraction > 0.25
        ? colors.yellow
        : colors.red;

  const textColor =
    fraction > 0.5
      ? colors.green
      : fraction > 0.25
        ? colors.yellow
        : colors.red;

  // Bar width as percentage via animated interpolation
  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>Choose your action!</Text>
        <Text style={[styles.number, { color: textColor }]}>
          {displayNumber}
        </Text>
      </View>

      {/* Bar track */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { width: barWidth, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  number: {
    fontSize: fontSize.lg,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.surfaceHover,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
});
