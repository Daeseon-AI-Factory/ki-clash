/**
 * BattleArena — two pixel fighters facing off in React Native.
 *
 * Simplified version of the web BattleArena. Shows two idle
 * PixelPortraits with a VS label between them. CSS animations
 * aren't available in RN, so this is static for MVP.
 */

import { View, Text, StyleSheet } from "react-native";
import { getCharacter } from "@/lib/characters";
import { colors, spacing } from "@/lib/theme";
import PixelPortrait from "./PixelPortrait";

interface BattleArenaProps {
  playerCharacterId: string;
  aiCharacterId: string;
}

export default function BattleArena({
  playerCharacterId,
  aiCharacterId,
}: BattleArenaProps) {
  const playerChar = getCharacter(playerCharacterId);
  const aiChar = getCharacter(aiCharacterId);

  return (
    <View style={styles.container}>
      <View style={styles.fighterCol}>
        <PixelPortrait characterId={playerCharacterId} size="md" />
        <Text style={styles.name}>{playerChar?.name}</Text>
      </View>

      <Text style={styles.vs}>VS</Text>

      <View style={styles.fighterCol}>
        <PixelPortrait
          characterId={aiCharacterId}
          size="md"
          style={{ transform: [{ scaleX: -1 }] }}
        />
        <Text style={styles.name}>{aiChar?.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(31, 41, 55, 0.4)",
    borderRadius: 12,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
  },
  fighterCol: {
    alignItems: "center",
    gap: spacing.sm,
  },
  vs: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
    color: colors.textMuted,
  },
  name: {
    fontSize: 10,
    fontFamily: "monospace",
    color: colors.textSecondary,
  },
});
