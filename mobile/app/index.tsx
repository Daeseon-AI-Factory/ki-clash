/**
 * Home screen — lobby with difficulty selection for AI mode.
 *
 * Entry point of the app. Player picks Easy/Medium/Hard → starts game.
 * Also has a link to PvP mode.
 */

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Difficulty } from "@/lib/api";

const DIFFICULTIES: { level: Difficulty; label: string; desc: string }[] = [
  { level: "easy", label: "Easy", desc: "Random moves, charges a lot" },
  { level: "medium", label: "Medium", desc: "Reads your patterns" },
  { level: "hard", label: "Hard", desc: "Game-theory optimal" },
];

export default function LobbyScreen() {
  const router = useRouter();

  const startGame = (difficulty: Difficulty) => {
    router.push({ pathname: "/game", params: { difficulty } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ki Clash</Text>
        <Text style={styles.subtitle}>기싸움</Text>
        <Text style={styles.tagline}>
          Read your opponent. Charge your ki. Strike at the right moment.
        </Text>
      </View>

      <View style={styles.difficultySection}>
        <Text style={styles.sectionLabel}>Choose Difficulty</Text>
        {DIFFICULTIES.map(({ level, label, desc }) => (
          <TouchableOpacity
            key={level}
            style={styles.difficultyButton}
            onPress={() => startGame(level)}
            activeOpacity={0.7}
          >
            <Text style={styles.difficultyLabel}>{label}</Text>
            <Text style={styles.difficultyDesc}>{desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.pvpLink}
        onPress={() => router.push("/pvp")}
        activeOpacity={0.7}
      >
        <Text style={styles.pvpLinkText}>vs Real Player (PvP) →</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "900",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.xl,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  difficultySection: {
    width: "100%",
    maxWidth: 400,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  difficultyButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  difficultyLabel: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  difficultyDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  pvpLink: {
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  pvpLinkText: {
    fontSize: fontSize.sm,
    color: colors.red,
  },
});
