/**
 * PvP screen — quick match plus shareable room flow.
 *
 * Mobile now mirrors the web online flow:
 * menu -> quick match OR room lobby -> WebSocket game.
 */

import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePvP } from "@/hooks/usePvP";
import ActionCard from "@/components/ActionCard";
import KiMeter from "@/components/KiMeter";
import RoomLobby from "@/components/RoomLobby";
import { BattleArena, PixelPortrait } from "@/components/deprecated/pixel-art";
import { colors, fontSize, spacing } from "@/lib/theme";
import type { Action } from "@/lib/api";

const PVP_PLAYER_CHAR = "haneul";
const PVP_OPPONENT_CHAR = "bora";
const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

type PageMode = "menu" | "room" | "pvp";

const OUTCOME_DISPLAY: Record<string, { text: string; color: string }> = {
  you_win: { text: "HIT!", color: colors.green },
  you_lose: { text: "HIT!", color: colors.red },
  clash: { text: "CLASH!", color: colors.yellow },
  blocked: { text: "BLOCKED!", color: colors.blue },
  dodged: { text: "DODGED!", color: colors.purple },
  neutral: { text: "-", color: colors.textSecondary },
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
    joinGame,
  } = usePvP();

  const [pageMode, setPageMode] = useState<PageMode>("menu");
  const [roomMode, setRoomMode] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [chars, setChars] = useState({
    player: PVP_PLAYER_CHAR,
    opponent: PVP_OPPONENT_CHAR,
  });

  const visibleMode: PageMode =
    phase === "lobby" && pageMode === "pvp" ? "menu" : pageMode;

  const startQuickMatch = async () => {
    setChars({ player: PVP_PLAYER_CHAR, opponent: PVP_OPPONENT_CHAR });
    setPageMode("pvp");
    await findMatch();
  };

  const startCreateRoom = () => {
    setRoomMode("create");
    setPageMode("room");
  };

  const startJoinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) return;
    setJoinCode(code);
    setRoomMode("join");
    setPageMode("room");
  };

  const handleRoomGameStart = async (
    gameId: string,
    oppName: string,
    ourChar: string,
    oppChar: string
  ) => {
    setChars({ player: ourChar, opponent: oppChar });
    setPageMode("pvp");
    await joinGame(gameId, oppName);
  };

  const backToMenu = () => {
    backToLobby();
    setPageMode("menu");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error && visibleMode !== "room" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {visibleMode === "menu" && (
          <View style={styles.centerArea}>
            <BattleArena
              playerCharacterId={chars.player}
              aiCharacterId={chars.opponent}
            />
            <Text style={styles.title}>PvP Mode</Text>
            <Text style={styles.subtitle}>기싸움 — vs Real Player</Text>
            <Text style={styles.tagline}>
              Create a room, share the code, or quick match.
            </Text>

            <TouchableOpacity
              style={styles.findButton}
              onPress={startQuickMatch}
              activeOpacity={0.7}
            >
              <Text style={styles.findButtonText}>Quick Match</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.roomButton}
              onPress={startCreateRoom}
              activeOpacity={0.7}
            >
              <Text style={styles.findButtonText}>Create Room</Text>
            </TouchableOpacity>

            <View style={styles.joinBox}>
              <Text style={styles.joinLabel}>Join Room</Text>
              <View style={styles.joinRow}>
                <TextInput
                  value={joinCode}
                  onChangeText={(value) =>
                    setJoinCode(
                      value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)
                    )
                  }
                  placeholder="ABCD"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={4}
                  style={styles.joinInput}
                />
                <TouchableOpacity
                  style={[
                    styles.joinButton,
                    { opacity: joinCode.trim().length === 4 ? 1 : 0.5 },
                  ]}
                  disabled={joinCode.trim().length !== 4}
                  onPress={startJoinRoom}
                  activeOpacity={0.7}
                >
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.backLinkText}>Back to AI Mode</Text>
            </TouchableOpacity>
          </View>
        )}

        {visibleMode === "room" && (
          <RoomLobby
            mode={roomMode}
            initialCode={joinCode}
            onGameStart={handleRoomGameStart}
            onExit={() => {
              setJoinCode("");
              setPageMode("menu");
            }}
          />
        )}

        {visibleMode === "pvp" && phase === "searching" && (
          <View style={styles.centerArea}>
            <Text style={styles.bigEmoji}>🔍</Text>
            <Text style={styles.statusTitle}>Searching for opponent...</Text>
            <Text style={styles.statusSubtext}>
              Waiting for another player to join
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                cancelSearch();
                setPageMode("menu");
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {visibleMode === "pvp" && phase === "matched" && (
          <View style={styles.centerArea}>
            <BattleArena
              playerCharacterId={chars.player}
              aiCharacterId={chars.opponent}
            />
            <Text style={styles.statusTitle}>Match Found!</Text>
            <Text style={styles.statusSubtext}>vs {opponentName}</Text>
            <ActivityIndicator size="large" color={colors.yellow} />
          </View>
        )}

        {visibleMode === "pvp" && phase === "playing" && gameState && (
          <View style={styles.gameArea}>
            <BattleArena
              playerCharacterId={chars.player}
              aiCharacterId={chars.opponent}
            />
            <View style={styles.scoreHeader}>
              <Text style={styles.roundInfo}>
                Round {gameState.round_number} • Turn {gameState.turn}
              </Text>
              <Text style={styles.scoreText}>
                You {roundsWonYou} - {roundsWonOpponent}{" "}
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

        {visibleMode === "pvp" && phase === "waiting" && (
          <View style={styles.centerArea}>
            <ActivityIndicator size="large" color={colors.yellow} />
            <Text style={styles.statusTitle}>Waiting for opponent...</Text>
            <Text style={styles.statusSubtext}>
              You've locked in your action
            </Text>
          </View>
        )}

        {visibleMode === "pvp" && phase === "revealing" && turnResult && (
          <View style={styles.centerArea}>
            <View style={styles.faceOff}>
              <View style={styles.faceOffSide}>
                <Text style={styles.faceOffEmoji}>
                  {ACTION_EMOJI[turnResult.your_action] || "?"}
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
                  {ACTION_EMOJI[turnResult.opponent_action] || "?"}
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

        {visibleMode === "pvp" && phase === "round_end" && roundResult && (
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
              <Text style={styles.nextButtonText}>Next Round</Text>
            </TouchableOpacity>
          </View>
        )}

        {visibleMode === "pvp" && phase === "match_end" && matchResult && (
          <View style={styles.centerArea}>
            {matchResult.winner === "you" ? (
              <PixelPortrait characterId={chars.player} size="lg" />
            ) : matchResult.winner === "opponent" ? (
              <PixelPortrait characterId={chars.opponent} size="lg" />
            ) : (
              <Text style={styles.bigEmoji}>🤝</Text>
            )}
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
              onPress={backToMenu}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>Back to PvP</Text>
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
    textAlign: "center",
  },
  statusSubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
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
  roomButton: {
    backgroundColor: colors.btnPrimary,
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
  joinBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    width: "100%",
    maxWidth: 400,
    gap: spacing.sm,
  },
  joinLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  joinRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  joinInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: "900",
    letterSpacing: 8,
    paddingHorizontal: spacing.md,
    textAlign: "center",
  },
  joinButton: {
    backgroundColor: colors.purple,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  joinButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: "800",
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
