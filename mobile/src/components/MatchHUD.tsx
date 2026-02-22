/**
 * MatchHUD — heads-up display showing match state.
 *
 * Displays round score (dots), ki meters, turn counter,
 * and a scrollable turn history. Shows character emoji+name when available.
 */

import { View, Text, ScrollView, StyleSheet } from "react-native";
import KiMeter from "./KiMeter";
import AIThinking from "./AIThinking";
import { PixelPortrait } from "@/components/pixel-art";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { GameState, TurnOutcome } from "@/lib/api";
import type { Character } from "@/lib/characters";

interface MatchHUDProps {
  gameState: GameState;
  playerName: string;
  /** Show animated "AI is analyzing..." below AI ki meter */
  showAIThinking?: boolean;
  /** Player's chosen character (shows emoji+name when set) */
  playerCharacter?: Character;
  /** AI's assigned character (shows emoji+name when set) */
  aiCharacter?: Character;
}

const OUTCOME_SHORT: Record<TurnOutcome, { text: string; color: string }> = {
  p1_wins_round: { text: "HIT", color: colors.green },
  p2_wins_round: { text: "HIT", color: colors.red },
  clash: { text: "CLASH", color: colors.yellow },
  blocked: { text: "BLK", color: colors.blue },
  dodged: { text: "DGE", color: colors.purple },
  neutral: { text: "—", color: colors.textMuted },
};

export default function MatchHUD({
  gameState,
  playerName,
  showAIThinking,
  playerCharacter,
  aiCharacter,
}: MatchHUDProps) {
  const round = gameState.current_round;

  // Display labels: character name only (portraits shown separately)
  const playerLabel = playerCharacter ? playerCharacter.name : playerName;
  const aiLabel = aiCharacter ? aiCharacter.name : "AI";
  const playerCharId = playerCharacter?.id;
  const aiCharId = aiCharacter?.id;

  return (
    <View style={styles.container}>
      {/* Round Score */}
      <View style={styles.scoreRow}>
        <ScoreDots label={playerLabel} wins={gameState.rounds_won_p1} color={colors.green} characterId={playerCharId} />
        <Text style={styles.turnCounter}>
          Turn {round?.turn_number ?? 0} / 20
        </Text>
        <ScoreDots label={aiLabel} wins={gameState.rounds_won_p2} color={colors.red} characterId={aiCharId} />
      </View>

      {/* Ki Meters */}
      {round && (
        <View style={styles.kiSection}>
          <KiMeter ki={round.p1_ki} label={playerLabel} isPlayer={true} />
          <KiMeter ki={round.p2_ki} label={aiLabel} isPlayer={false} />
          {showAIThinking && <AIThinking />}
        </View>
      )}

      {/* Turn History (last 5) */}
      {round && round.turn_history.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.historyScroll}
          contentContainerStyle={styles.historyContent}
        >
          {round.turn_history
            .slice(-5)
            .reverse()
            .map((turn) => {
              const display = OUTCOME_SHORT[turn.outcome];
              return (
                <View key={turn.turn_number} style={styles.historyItem}>
                  <Text style={styles.historyTurn}>T{turn.turn_number}</Text>
                  <Text style={styles.historyActions}>
                    {turn.p1_action.slice(0, 3)} vs {turn.p2_action.slice(0, 3)}
                  </Text>
                  <Text style={[styles.historyOutcome, { color: display.color }]}>
                    {display.text}
                  </Text>
                </View>
              );
            })}
        </ScrollView>
      )}
    </View>
  );
}

function ScoreDots({
  label,
  wins,
  color,
  characterId,
}: {
  label: string;
  wins: number;
  color: string;
  characterId?: string;
}) {
  return (
    <View style={styles.scoreDotsContainer}>
      {characterId && <PixelPortrait characterId={characterId} size="sm" />}
      <Text style={[styles.scoreLabel, { color }]}>{label}</Text>
      <View style={styles.dots}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < wins ? color : colors.surfaceHover,
                borderColor: color,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  turnCounter: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  scoreDotsContainer: {
    alignItems: "center",
    gap: 4,
  },
  scoreLabel: {
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  dots: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  kiSection: {
    gap: spacing.sm,
  },
  historyScroll: {
    maxHeight: 60,
  },
  historyContent: {
    gap: spacing.sm,
  },
  historyItem: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    minWidth: 64,
  },
  historyTurn: {
    fontSize: 9,
    color: colors.textMuted,
  },
  historyActions: {
    fontSize: 9,
    color: colors.textSecondary,
    textTransform: "capitalize",
  },
  historyOutcome: {
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
});
