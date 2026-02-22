/**
 * KiMeter — horizontal bar showing current ki level (0-10).
 *
 * Green for player, red for opponent. Animated width transitions.
 */

import { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, fontSize, spacing } from "@/lib/theme";

interface KiMeterProps {
  ki: number;
  label: string;
  isPlayer: boolean;
}

const KI_CAP = 10;

export default function KiMeter({ ki, label, isPlayer }: KiMeterProps) {
  const widthAnim = useRef(new Animated.Value(ki / KI_CAP)).current;
  const barColor = isPlayer ? colors.green : colors.red;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: ki / KI_CAP,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [ki, widthAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: barColor }]}>{label}</Text>
        <Text style={styles.value}>
          {ki} / {KI_CAP}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: barColor,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
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
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  value: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  track: {
    height: 8,
    backgroundColor: colors.surfaceHover,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
