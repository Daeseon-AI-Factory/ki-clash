/**
 * Match History screen — list of past matches with results.
 *
 * Fetches from GET /api/v1/players/me/matches and displays
 * each match as a card with win/loss/draw coloring.
 */

import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ensureAuth, getMatchHistory, type MatchSummary } from "@/lib/api";
import { colors, fontSize, spacing } from "@/lib/theme";

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function MatchCard({ match }: { match: MatchSummary }) {
  const isWin = match.winner === "p1";
  const isLoss = match.winner === "p2";

  const resultText = isWin ? "WIN" : isLoss ? "LOSS" : match.winner === "draw" ? "DRAW" : "IN PROGRESS";
  const resultColor = isWin
    ? colors.green
    : isLoss
      ? colors.red
      : colors.yellow;

  const matchType = match.match_type.startsWith("ai_")
    ? `vs AI (${match.match_type.replace("ai_", "")})`
    : "vs Player";

  const timeAgo = getTimeAgo(new Date(match.created_at));

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchCardLeft}>
        <View style={styles.matchCardHeader}>
          <Text style={[styles.resultText, { color: resultColor }]}>
            {resultText}
          </Text>
          <Text style={styles.matchType}>{matchType}</Text>
        </View>
        <Text style={styles.matchScore}>
          {match.rounds_won_p1} — {match.rounds_won_p2} • {match.total_turns} turns
        </Text>
        {match.opponent_name && (
          <Text style={styles.opponentName}>vs {match.opponent_name}</Text>
        )}
      </View>
      <Text style={styles.timeAgo}>{timeAgo}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await ensureAuth();
        const data = await getMatchHistory();
        setMatches(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Match History</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.yellow} />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && matches.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No matches yet. Go play!</Text>
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.playButtonText}>Play Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && matches.length > 0 && (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MatchCard match={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  backText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  errorBox: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: "rgba(127, 29, 29, 0.5)",
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 8,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.red,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  playButton: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  playButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchCardLeft: {
    flex: 1,
    gap: 4,
  },
  matchCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  resultText: {
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  matchType: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  matchScore: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  opponentName: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  timeAgo: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
