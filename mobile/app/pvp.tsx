/**
 * PvP screen — matchmaking and real-time game vs another player.
 *
 * Uses WebSocket connections for matchmaking + gameplay.
 * All phases: lobby → searching → matched → playing → waiting →
 *             revealing → round_end → match_end
 */

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePvP } from "@/hooks/usePvP";
import ActionCard from "@/components/ActionCard";
import KiMeter from "@/components/KiMeter";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Action } from "@/lib/api";

const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

const OUTCOME_DISPLAY: Record<string, { text: string; color: string }> = {
  you_win: { text: "HIT!", color: colors.green },
  you_lose: { text: "HIT!", color: colors.red },
  clash: { text: "CLASH!", color: colors.yellow },
  blocked: { text: "BLOCKED!", color: colors.blue },
  dodged: { text: "DODGED!", color: colors.purple },
  neutral: { text: "—", color: colors.textSecondary },
};

const ACTION_EMOJI: Record<string, string> = {
  charge: "⚡",
  block: "🛡️",
  attack: "👊",
  energy_wave: "🔥",
  teleport: "💨",
};

export default function PvPScreen() {
  const router = useRouter();
  const {
    phase,
    opponentName,
    gameState,
    turnResult,
    roundResult,
    matchResult,
    roundsWonYou,
    roundsWonOpponent,
    error,
    findMatch,
    cancelSearch,
    submitAction,
    continueFromReveal,
    continueFromRound,
    backToLobby,
  } = usePvP();

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

        {/* LOBBY */}
        {phase === "lobby" && (
          <View style={styles.centerArea}>
            <Text style={styles.title}>PvP Mode</Text>
            <Text style={styles.subtitle}>기싸움 — vs Real Player</Text>
            <Text style={styles.tagline}>
              Find an opponent and battle in real-time.
            </Text>
            <TouchableOpacity
              style={styles.findButton}
              onPress={findMatch}
              activeOpacity={0.7}
            >
              <Text style={styles.findButtonText}>Find Match</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backLink}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.backLinkText}>← Back to AI Mode</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SEARCHING */}
        {phase === "searching" && (
          <View style={styles.centerArea}>
            <Text style={styles.bigEmoji}>🔍</Text>
            <Text style={styles.statusTitle}>Searching for opponent...</Text>
            <Text style={styles.statusSubtext}>
              Waiting for another player to join
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelSearch}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MATCHED */}
        {phase === "matched" && (
          <View style={styles.centerArea}>
            <Text style={styles.bigEmoji}>⚔️</Text>
            <Text style={styles.statusTitle}>Match Found!</Text>
            <Text style={styles.statusSubtext}>vs {opponentName}</Text>
            <ActivityIndicator size="large" color={colors.yellow} />
          </View>
        )}

        {/* PLAYING */}
        {phase === "playing" && gameState && (
          <View style={styles.gameArea}>
            <View style={styles.scoreHeader}>
              <Text style={styles.roundInfo}>
                Round {gameState.round_number} • Turn {gameState.turn}
              </Text>
              <Text style={styles.scoreText}>
                You {roundsWonYou} — {roundsWonOpponent}{" "}
                {opponentName || "Opponent"}
              </Text>
            </View>

            <KiMeter ki={gameState.your_ki} label="You" isPlayer={true} />
            <KiMeter
              ki={gameState.opponent_ki}
              label={opponentName || "Opponent"}
              isPlayer={false}
            />

            <View style={styles.actionGrid}>
              {ACTIONS.map((action) => (
                <ActionCard
                  key={action}
                  action={action}
                  playerKi={gameState.your_ki}
                  isSelected={false}
                  disabled={false}
                  onSelect={submitAction}
                />
              ))}
            </View>

            <Text style={styles.timeHint}>
              {gameState.time_limit}s to choose — auto-Charge if you don't pick
            </Text>
          </View>
        )}

        {/* WAITING */}
        {phase === "waiting" && (
          <View style={styles.centerArea}>
            <ActivityIndicator size="large" color={colors.yellow} />
            <Text style={styles.statusTitle}>Waiting for opponent...</Text>
            <Text style={styles.statusSubtext}>
              You've locked in your action
            </Text>
          </View>
        )}

        {/* REVEALING */}
        {phase === "revealing" && turnResult && (
          <View style={styles.centerArea}>
            <View style={styles.faceOff}>
              <View style={styles.faceOffSide}>
                <Text style={styles.faceOffEmoji}>
                  {ACTION_EMOJI[turnResult.your_action] || "❓"}
                </Text>
                <Text style={styles.faceOffAction}>
                  {turnResult.your_action.replace("_", " ")}
                </Text>
                <Text style={[styles.faceOffPlayer, { color: colors.green }]}>
                  You
                </Text>
              </View>
              <Text style={styles.faceOffVs}>VS</Text>
              <View style={styles.faceOffSide}>
                <Text style={styles.faceOffEmoji}>
                  {ACTION_EMOJI[turnResult.opponent_action] || "❓"}
                </Text>
                <Text style={styles.faceOffAction}>
                  {turnResult.opponent_action.replace("_", " ")}
                </Text>
                <Text style={[styles.faceOffPlayer, { color: colors.red }]}>
                  {opponentName || "Opponent"}
                </Text>
              </View>
            </View>

            {(() => {
              const display =
                OUTCOME_DISPLAY[turnResult.outcome] || OUTCOME_DISPLAY.neutral;
              return (
                <Text style={[styles.outcomeText, { color: display.color }]}>
                  {display.text}
                </Text>
              );
            })()}

            <View style={styles.kiRow}>
              <Text style={styles.kiInfo}>Your Ki: {turnResult.your_ki}</Text>
              <Text style={styles.kiInfo}>
                Opponent Ki: {turnResult.opponent_ki}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={continueFromReveal}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ROUND END */}
        {phase === "round_end" && roundResult && (
          <View style={styles.centerArea}>
            <View style={styles.roundEndBox}>
              <Text style={styles.roundLabel}>
                Round {roundResult.round_number} Complete
              </Text>
              <Text
                style={[
                  styles.roundResultText,
                  {
                    color:
                      roundResult.winner === "you"
                        ? colors.green
                        : roundResult.winner === "opponent"
                          ? colors.red
                          : colors.yellow,
                  },
                ]}
              >
                {roundResult.winner === "you"
                  ? "YOU WIN!"
                  : roundResult.winner === "opponent"
                    ? "OPPONENT WINS!"
                    : "DRAW!"}
              </Text>
              <Text style={styles.turnsText}>
                {roundResult.total_turns} turns
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
          <View style={styles.centerArea}>
            <Text style={styles.bigEmoji}>
              {matchResult.winner === "you"
                ? "🏆"
                : matchResult.winner === "opponent"
                  ? "💀"
                  : "🤝"}
            </Text>
            <Text
              style={[
                styles.matchResultText,
                {
                  color:
                    matchResult.winner === "you"
                      ? colors.green
                      : matchResult.winner === "opponent"
                        ? colors.red
                        : colors.yellow,
                },
              ]}
            >
              {matchResult.winner === "you"
                ? "VICTORY!"
                : matchResult.winner === "opponent"
                  ? "DEFEAT!"
                  : "DRAW!"}
            </Text>

            <View style={styles.statsBox}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>vs</Text>
                <Text style={styles.statValue}>{opponentName}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Turns</Text>
                <Text style={styles.statValue}>{matchResult.total_turns}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: colors.btnSuccess }]}
              onPress={backToLobby}
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
  centerArea: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  gameArea: {
    gap: spacing.lg,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.xl,
    color: colors.textSecondary,
  },
  tagline: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  bigEmoji: {
    fontSize: 64,
  },
  statusTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statusSubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  findButton: {
    backgroundColor: colors.btnDanger,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  findButtonText: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cancelButton: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  backLink: {
    padding: spacing.md,
  },
  backLinkText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  scoreHeader: {
    alignItems: "center",
    gap: 4,
  },
  roundInfo: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  scoreText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  actionGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  timeHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
  faceOff: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  faceOffSide: {
    alignItems: "center",
    gap: 4,
  },
  faceOffEmoji: {
    fontSize: 36,
  },
  faceOffAction: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: "capitalize",
  },
  faceOffPlayer: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  faceOffVs: {
    fontSize: fontSize.xl,
    fontWeight: "900",
    color: colors.textMuted,
  },
  outcomeText: {
    fontSize: fontSize.xxxl,
    fontWeight: "900",
  },
  kiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: spacing.xl,
  },
  kiInfo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  nextButton: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
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
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
    width: "100%",
    maxWidth: 400,
  },
  roundLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  roundResultText: {
    fontSize: fontSize.xxxl,
    fontWeight: "900",
  },
  turnsText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
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
    maxWidth: 400,
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
