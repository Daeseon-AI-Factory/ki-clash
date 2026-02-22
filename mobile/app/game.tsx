/**
 * AI Game screen — plays a full match vs AI opponent.
 *
 * Receives difficulty as a route param from the lobby.
 * Uses useGame hook for game state management.
 */

import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fontSize, spacing } from "@/lib/theme";

export default function GameScreen() {
  const { difficulty } = useLocalSearchParams<{ difficulty: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.emoji}>⚡</Text>
        <Text style={styles.text}>AI Game — {difficulty}</Text>
        <Text style={styles.subtext}>Game UI coming in Task 5.2</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  emoji: {
    fontSize: 48,
  },
  text: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
