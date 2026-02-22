/**
 * PvP screen — matchmaking and real-time game vs another player.
 *
 * Uses WebSocket connections for matchmaking + gameplay.
 * Full implementation in Task 5.3.
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fontSize, spacing } from "@/lib/theme";

export default function PvPScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.emoji}>⚔️</Text>
        <Text style={styles.title}>PvP Mode</Text>
        <Text style={styles.subtext}>Real-time PvP coming in Task 5.3</Text>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Text style={styles.backText}>← Back to AI Mode</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
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
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  subtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  backButton: {
    alignItems: "center",
    padding: spacing.md,
  },
  backText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
