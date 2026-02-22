/**
 * AI Game screen — plays a full match vs AI opponent.
 *
 * Receives difficulty as a route param from the lobby.
 * Uses useGame hook for game state management.
 */

import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGame } from "@/hooks/useGame";
import GameBoard from "@/components/GameBoard";
import MatchHUD from "@/components/MatchHUD";
import TurnReveal from "@/components/TurnReveal";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Difficulty } from "@/lib/api";

export default function GameScreen() {
  const { difficulty } = useLocalSearchParams<{ difficulty: string }>();
  const router = useRouter();
  const {
    phase,
    gameState,
    lastTurn,
    lastRound,
    matchResult,
    playerName,
    error,
    startGame,
    playAction,
    continueFromReveal,
    continueFromRound,
  } = useGame();

  // Auto-start game when screen mounts
  useEffect(() => {
    if (difficulty) {
      startGame(difficulty as Difficulty);
    }
  }, [difficulty, startGame]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* LOADING */}
        {phase === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.yellow} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {/* PLAYING */}
        {phase === "playing" && gameState && (
          <View style={styles.gameArea}>
            <MatchHUD gameState={gameState} playerName={playerName} />
            <GameBoard
              playerKi={gameState.current_round?.p1_ki ?? 0}
              disabled={false}
              onSubmit={playAction}
            />
          </View>
        )}

        {/* REVEALING */}
        {phase === "revealing" && (
          <View style={styles.gameArea}>
            {gameState && (
              <MatchHUD gameState={gameState} playerName={playerName} />
            )}
            <TurnReveal turnResult={lastTurn} visible={true} />
            <TouchableOpacity
              style={styles.nextButton}
              onPress={continueFromReveal}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>Next Turn →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ROUND END */}
        {phase === "round_end" && lastRound && (
          <View style={styles.gameArea}>
            {gameState && (
              <MatchHUD gameState={gameState} playerName={playerName} />
            )}
            <TurnReveal turnResult={lastTurn} visible={true} />
            <View style={styles.roundEndBox}>
              <Text style={styles.roundLabel}>
                Round {lastRound.round_number} Complete
              </Text>
              <Text
                style={[
                  styles.roundResult,
                  {
                    color:
                      lastRound.winner === "p1"
                        ? colors.green
                        : lastRound.winner === "p2"
                          ? colors.red
                          : colors.yellow,
                  },
                ]}
              >
                {lastRound.winner === "p1"
                  ? "YOU WIN!"
                  : lastRound.winner === "p2"
                    ? "AI WINS!"
                    : "DRAW!"}
              </Text>
              <Text style={styles.turnsPlayed}>
                {lastRound.total_turns} turns played
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: colors.btnPrimary }]}
              onPress={continueFromRound}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>Next Round →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MATCH END */}
        {phase === "match_end" && matchResult && (
          <View style={styles.matchEndArea}>
            <Text style={styles.matchEmoji}>
              {matchResult.winner === "p1"
                ? "🏆"
                : matchResult.winner === "p2"
                  ? "💀"
                  : "🤝"}
            </Text>
            <Text
              style={[
                styles.matchResultText,
                {
                  color:
                    matchResult.winner === "p1"
                      ? colors.green
                      : matchResult.winner === "p2"
                        ? colors.red
                        : colors.yellow,
                },
              ]}
            >
              {matchResult.winner === "p1"
                ? "VICTORY!"
                : matchResult.winner === "p2"
                  ? "DEFEAT!"
                  : "DRAW!"}
            </Text>

            <View style={styles.statsBox}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Final Score</Text>
                <Text style={styles.statValue}>
                  {matchResult.rounds_won_p1} — {matchResult.rounds_won_p2}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Turns</Text>
                <Text style={styles.statValue}>{matchResult.total_turns}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: colors.btnSuccess }]}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: "rgba(127, 29, 29, 0.5)",
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.red,
  },
  gameArea: {
    gap: spacing.lg,
  },
  nextButton: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  nextButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  roundEndBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  roundLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  roundResult: {
    fontSize: fontSize.xxxl,
    fontWeight: "900",
  },
  turnsPlayed: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  matchEndArea: {
    alignItems: "center",
    gap: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  matchEmoji: {
    fontSize: 64,
  },
  matchResultText: {
    fontSize: fontSize.title,
    fontWeight: "900",
  },
  statsBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    width: "100%",
    gap: spacing.md,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statLabel: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});
