/**
 * AIThinking — animated "AI is analyzing..." indicator with 3 pulsing dots.
 *
 * Uses Animated.loop with staggered delays for a wave effect.
 */

import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, fontSize, spacing } from "@/lib/theme";

export default function AIThinking() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = createPulse(dot1, 0);
    const a2 = createPulse(dot2, 200);
    const a3 = createPulse(dot3, 400);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>AI is analyzing</Text>
      <View style={styles.dots}>
        {[dot1, dot2, dot3].map((anim, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { opacity: anim }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  text: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  dots: {
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.red,
  },
});
