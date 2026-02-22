/**
 * Ranked Leaderboard screen — top players by ELO rating.
 *
 * Shows the global leaderboard and the current player's rank.
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
import {
  ensureAuth,
  getLeaderboard,
  getMyRank,
  type LeaderboardEntry,
  type PlayerRank,
} from "@/lib/api";
import { colors, fontSize, spacing } from "@/lib/theme";

function RankRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const rankColor =
    index === 0
      ? colors.yellow
      : index === 1
        ? colors.textSecondary
        : index === 2
          ? "#F97316"
          : colors.textMuted;

  return (
    <View style={[styles.row, index < 3 && styles.topRow]}>
      <Text style={[styles.rank, { color: rankColor }]}>{entry.rank}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {entry.display_name}
      </Text>
      <Text style={styles.elo}>{entry.elo_rating}</Text>
      <Text style={styles.wl}>
        {entry.ranked_wins}/{entry.ranked_losses}
      </Text>
    </View>
  );
}

export default function RankedScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<PlayerRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await ensureAuth();
        const [board, rank] = await Promise.all([
          getLeaderboard(50),
          getMyRank(),
        ]);
        setEntries(board);
        setMyRank(rank);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ranked</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* My rank card */}
      {myRank && (
        <View style={styles.myRankCard}>
          <View style={styles.myRankTop}>
            <View>
              <Text style={styles.myRankLabel}>Your Rank</Text>
              <Text style={styles.myRankNumber}>#{myRank.rank}</Text>
            </View>
            <View style={styles.myRankRight}>
              <Text style={styles.myRankElo}>{myRank.elo_rating}</Text>
              <Text style={styles.myRankEloLabel}>ELO</Text>
            </View>
          </View>
          <View style={styles.myRankStats}>
            <Text style={[styles.myRankStat, { color: colors.green }]}>
              {myRank.ranked_wins}W
            </Text>
            <Text style={[styles.myRankStat, { color: colors.red }]}>
              {myRank.ranked_losses}L
            </Text>
            <Text style={[styles.myRankStat, { color: colors.textMuted }]}>
              {myRank.ranked_wins + myRank.ranked_losses > 0
                ? `${Math.round(
                    (myRank.ranked_wins /
                      (myRank.ranked_wins + myRank.ranked_losses)) *
                      100
                  )}% WR`
                : "—"}
            </Text>
          </View>
        </View>
      )}

      {!myRank && !loading && (
        <View style={styles.noRankBox}>
          <Text style={styles.noRankText}>
            Play ranked PvP matches to appear on the leaderboard.
          </Text>
        </View>
      )}

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.yellow} />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && entries.length > 0 && (
        <>
          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.rank]}>#</Text>
            <Text style={[styles.headerCell, styles.name]}>Player</Text>
            <Text style={[styles.headerCell, styles.elo]}>ELO</Text>
            <Text style={[styles.headerCell, styles.wl]}>W/L</Text>
          </View>
          <FlatList
            data={entries}
            keyExtractor={(item) => item.player_id}
            renderItem={({ item, index }) => (
              <RankRow entry={item} index={index} />
            )}
            showsVerticalScrollIndicator={false}
          />
        </>
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
  myRankCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: "rgba(120, 53, 15, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(202, 138, 4, 0.5)",
    borderRadius: 12,
    padding: spacing.lg,
  },
  myRankTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  myRankLabel: {
    fontSize: fontSize.xs,
    color: colors.yellow,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  myRankNumber: {
    fontSize: fontSize.xxxl,
    fontWeight: "900",
    color: colors.yellow,
  },
  myRankRight: {
    alignItems: "flex-end",
  },
  myRankElo: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  myRankEloLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  myRankStats: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  myRankStat: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  noRankBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
  },
  noRankText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
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
  headerRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerCell: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.sm,
    borderRadius: 8,
  },
  topRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    marginBottom: 2,
  },
  rank: {
    width: 40,
    fontWeight: "700",
    fontSize: fontSize.md,
  },
  name: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  elo: {
    width: 60,
    textAlign: "right",
    fontWeight: "700",
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  wl: {
    width: 60,
    textAlign: "right",
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
