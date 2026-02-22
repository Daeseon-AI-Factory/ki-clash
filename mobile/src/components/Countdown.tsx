/**
 * Countdown — 3-beat countdown overlay (3 → 2 → 1 → REVEAL!).
 *
 * Uses Animated.sequence with spring scaling for each beat.
 * Calls onBeat on each number and onComplete when finished.
 */

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fontSize } from "@/lib/theme";

interface CountdownProps {
  onComplete: () => void;
  onBeat?: (beat: number) => void;
}

const BEAT_DURATION_MS = 700;
const BEATS = [3, 2, 1];
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function Countdown({ onComplete, onBeat }: CountdownProps) {
  const [currentBeat, setCurrentBeat] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    onBeat?.(BEATS[0]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Animate first beat in
    animateBeatIn();

    BEATS.forEach((beat, index) => {
      if (index > 0) {
        timers.push(
          setTimeout(() => {
            setCurrentBeat(index);
            onBeat?.(beat);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            animateBeatIn();
          }, BEAT_DURATION_MS * index)
        );
      }
    });

    // REVEAL phase
    timers.push(
      setTimeout(() => {
        setCurrentBeat(3);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        animateBeatIn();
      }, BEAT_DURATION_MS * BEATS.length)
    );

    // Fire completion
    timers.push(
      setTimeout(() => {
        onComplete();
      }, BEAT_DURATION_MS * (BEATS.length + 1))
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete, onBeat]);

  function animateBeatIn() {
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }

  const display = currentBeat < 3 ? String(BEATS[currentBeat]) : "REVEAL!";
  const isReveal = currentBeat === 3;

  return (
    <View style={styles.overlay}>
      <Animated.Text
        style={[
          isReveal ? styles.revealText : styles.beatText,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {display}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  beatText: {
    fontSize: 96,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  revealText: {
    fontSize: 56,
    fontWeight: "900",
    color: colors.yellow,
  },
});
