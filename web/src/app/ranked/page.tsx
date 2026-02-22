"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ensureAuth,
  getLeaderboard,
  getMyRank,
  type LeaderboardEntry,
  type PlayerRank,
} from "@/lib/api";

export default function RankedPage() {
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Ranked Leaderboard</h1>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Back
          </Link>
        </div>

        {/* My rank card */}
        {myRank && (
          <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-400 uppercase tracking-wider">
                  Your Rank
                </p>
                <p className="text-3xl font-black text-yellow-300">
                  #{myRank.rank}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {myRank.elo_rating}
                </p>
                <p className="text-xs text-gray-400">ELO</p>
              </div>
            </div>
            <div className="mt-2 flex gap-4 text-sm">
              <span className="text-green-400">
                {myRank.ranked_wins}W
              </span>
              <span className="text-red-400">
                {myRank.ranked_losses}L
              </span>
              <span className="text-gray-400">
                {myRank.ranked_wins + myRank.ranked_losses > 0
                  ? `${Math.round(
                      (myRank.ranked_wins /
                        (myRank.ranked_wins + myRank.ranked_losses)) *
                        100
                    )}% WR`
                  : "—"}
              </span>
            </div>
          </div>
        )}

        {!myRank && !loading && (
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-sm">
              Play ranked PvP matches to appear on the leaderboard.
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="text-4xl animate-spin mb-4">⚡</div>
            <p className="text-gray-400">Loading leaderboard...</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">
              No ranked matches yet. Be the first!
            </p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-1">
            {/* Header */}
            <div className="flex px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
              <span className="w-10">#</span>
              <span className="flex-1">Player</span>
              <span className="w-16 text-right">ELO</span>
              <span className="w-16 text-right">W/L</span>
            </div>

            {entries.map((entry, i) => (
              <div
                key={entry.player_id}
                className={`flex items-center px-4 py-3 rounded-lg ${
                  i < 3
                    ? "bg-gray-800 border border-gray-700"
                    : "bg-gray-800/50"
                }`}
              >
                <span
                  className={`w-10 font-bold ${
                    i === 0
                      ? "text-yellow-400"
                      : i === 1
                        ? "text-gray-300"
                        : i === 2
                          ? "text-orange-400"
                          : "text-gray-500"
                  }`}
                >
                  {entry.rank}
                </span>
                <span className="flex-1 font-medium truncate">
                  {entry.display_name}
                </span>
                <span className="w-16 text-right font-bold">
                  {entry.elo_rating}
                </span>
                <span className="w-16 text-right text-sm text-gray-400">
                  {entry.ranked_wins}/{entry.ranked_losses}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
