/**
 * AI Game screen — plays a full match vs AI opponent.
 *
 * Receives difficulty as a route param from the lobby.
 * Uses useGame hook for game state management.
 * Includes inline selection timer, character select, AI trash talk,
 * card flip reveal, screen shake, and sound effects.
 */

import { useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGame } from "@/hooks/useGame";
import { useSoundEffects, type SoundName } from "@/hooks/useSoundEffects";
import { getCharacter } from "@/lib/characters";
import GameBoard from "@/components/GameBoard";
import MatchHUD from "@/components/MatchHUD";
import TurnReveal, { getShakeIntensity } from "@/components/TurnReveal";
import CharacterSelect from "@/components/CharacterSelect";
import AITrashTalk from "@/components/AITrashTalk";
import MuteButton from "@/components/MuteButton";
import { BattleArena, PixelPortrait } from "@/components/deprecated/pixel-art";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Difficulty, TurnOutcome } from "@/lib/api";

/** Map turn outcomes to sound names */
const OUTCOME_SOUND: Record<TurnOutcome, SoundName> = {
  p1_wins_round: "hit",
  p2_wins_round: "hit",
  clash: "clash",
  blocked: "block",
  dodged: "dodge",
  neutral: "charge",
};

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
    playerCharacterId,
    aiCharacterId,
    error,
    initGame,
    startGame,
    playAction,
    continueFromReveal,
    continueFromRound,
  } = useGame();

  const { play, muted, toggleMute } = useSoundEffects();

  // Screen shake animated value
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Track previous phase for sound triggers
  const prevPhaseRef = useRef(phase);

  // Derive character objects from IDs
  const playerCharacter = useMemo(
    () => (playerCharacterId ? getCharacter(playerCharacterId) : undefined),
    [playerCharacterId]
  );
  const aiCharacter = useMemo(
    () => (aiCharacterId ? getCharacter(aiCharacterId) : undefined),
    [aiCharacterId]
  );

  // Display names: name only (portraits shown via pixel art)
  const playerDisplayName = playerCharacter
    ? playerCharacter.name
    : playerName;
  const aiDisplayName = aiCharacter
    ? aiCharacter.name
    : "AI";

  // Initialize with difficulty on mount — goes to character_select
  useEffect(() => {
    if (difficulty) {
      initGame(difficulty as Difficulty);
    }
  }, [difficulty, initGame]);

  // Play sounds on phase transitions
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    // Reveal sound when transitioning from loading to a result phase
    if (prevPhase === "loading" && phase !== "loading" && phase !== "playing" && phase !== "character_select") {
      play("reveal");

      if (lastTurn) {
        setTimeout(() => play(OUTCOME_SOUND[lastTurn.outcome]), 300);
      }
    }

    if (phase === "round_end" && lastRound) {
      setTimeout(() => {
        play(lastRound.winner === "p1" ? "round_win" : "round_lose");
      }, 600);
    }

    if (phase === "match_end" && matchResult) {
      setTimeout(() => {
        play(matchResult.winner === "p1" ? "round_win" : "round_lose");
      }, 600);
    }
  }, [phase, lastTurn, lastRound, matchResult, play]);

  /** Countdown beat handler */
  const handleCountdownBeat = useCallback(() => {
    play("countdown_beat");
  }, [play]);

  /** Screen shake when outcome is revealed inside TurnReveal */
  const handleOutcomeRevealed = useCallback(
    (outcome: TurnOutcome) => {
      const intensity = getShakeIntensity(outcome);
      if (intensity > 0) {
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: intensity, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -intensity, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: intensity * 0.7, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -intensity * 0.7, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: intensity * 0.3, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
      }
    },
    [shakeAnim]
  );

  return (
    <SafeAreaView style={styles.container}>
      <MuteButton muted={muted} onToggle={toggleMute} />

      <Animated.View
        style={[styles.shakeWrapper, { transform: [{ translateX: shakeAnim }] }]}
      >
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

          {/* CHARACTER SELECT */}
          {phase === "character_select" && (
            <CharacterSelect onSelect={startGame} />
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
              {playerCharacterId && aiCharacterId && (
                <BattleArena
                  playerCharacterId={playerCharacterId}
                  aiCharacterId={aiCharacterId}
                />
              )}
              <MatchHUD
                gameState={gameState}
                playerName={playerName}
                showAIThinking
                playerCharacter={playerCharacter}
                aiCharacter={aiCharacter}
              />
              {aiCharacter && (
                <AITrashTalk
                  character={aiCharacter}
                  turnNumber={gameState.current_round?.turn_number ?? 0}
                />
              )}
              <GameBoard
                playerKi={gameState.current_round?.p1_ki ?? 0}
                disabled={false}
                onSubmit={playAction}
                onCountdownBeat={handleCountdownBeat}
              />
            </View>
          )}

          {/* REVEALING */}
          {phase === "revealing" && (
            <View style={styles.gameArea}>
              {playerCharacterId && aiCharacterId && (
                <BattleArena
                  playerCharacterId={playerCharacterId}
                  aiCharacterId={aiCharacterId}
                />
              )}
              {gameState && (
                <MatchHUD
                  gameState={gameState}
                  playerName={playerName}
                  playerCharacter={playerCharacter}
                  aiCharacter={aiCharacter}
                />
              )}
              <TurnReveal
                turnResult={lastTurn}
                visible={true}
                onOutcomeRevealed={handleOutcomeRevealed}
                playerName={playerDisplayName}
                aiName={aiDisplayName}
              />
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
              {playerCharacterId && aiCharacterId && (
                <BattleArena
                  playerCharacterId={playerCharacterId}
                  aiCharacterId={aiCharacterId}
                />
              )}
              {gameState && (
                <MatchHUD
                  gameState={gameState}
                  playerName={playerName}
                  playerCharacter={playerCharacter}
                  aiCharacter={aiCharacter}
                />
              )}
              <TurnReveal
                turnResult={lastTurn}
                visible={true}
                onOutcomeRevealed={handleOutcomeRevealed}
                playerName={playerDisplayName}
                aiName={aiDisplayName}
              />
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
              {matchResult.winner === "p1" && playerCharacterId ? (
                <PixelPortrait characterId={playerCharacterId} size="lg" />
              ) : matchResult.winner === "p2" && aiCharacterId ? (
                <PixelPortrait characterId={aiCharacterId} size="lg" />
              ) : (
                <Text style={styles.matchEmoji}>🤝</Text>
              )}
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
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shakeWrapper: {
    flex: 1,
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
