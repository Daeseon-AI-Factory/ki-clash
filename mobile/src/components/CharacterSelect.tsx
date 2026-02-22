/**
 * CharacterSelect — grid of fighter cards for character selection.
 *
 * 2×3 layout. Tap a card to select and immediately start the game.
 * Each card shows: emoji (large), name, Korean name, short bio.
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { CHARACTERS } from "@/lib/characters";
import { colors, fontSize, spacing } from "@/lib/theme";

interface CharacterSelectProps {
  onSelect: (characterId: string) => void;
}

export default function CharacterSelect({ onSelect }: CharacterSelectProps) {
  const handleSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Fighter</Text>
        <Text style={styles.subtitle}>Tap to start</Text>
      </View>

      <View style={styles.grid}>
        {CHARACTERS.map((char) => (
          <TouchableOpacity
            key={char.id}
            style={[styles.card, { borderColor: char.color + "40" }]}
            onPress={() => handleSelect(char.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{char.emoji}</Text>
            <Text style={styles.name}>{char.name}</Text>
            <Text style={styles.koreanName}>{char.koreanName}</Text>
            <Text style={styles.bio} numberOfLines={2}>
              {char.bio}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    width: "100%",
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: "center",
    gap: 4,
    // ~45% width for 2-column layout with gap
    width: "46%",
  },
  emoji: {
    fontSize: 36,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  koreanName: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  bio: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 14,
  },
});
