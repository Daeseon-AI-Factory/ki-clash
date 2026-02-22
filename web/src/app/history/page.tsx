"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ensureAuth, getMatchHistory, type MatchSummary } from "@/lib/api";

export default function HistoryPage() {
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Match History</h1>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Back
          </Link>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="text-4xl animate-spin mb-4">⚡</div>
            <p className="text-gray-400">Loading matches...</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No matches yet. Go play!</p>
            <Link
              href="/"
              className="mt-4 inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500
                         rounded-xl font-bold transition-colors"
            >
              Play Now
            </Link>
          </div>
        )}

        {!loading && matches.length > 0 && (
          <div className="space-y-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: MatchSummary }) {
  const isWin = match.winner === "p1";
  const isLoss = match.winner === "p2";
  const isDraw = match.winner === "draw";

  const resultText = isWin ? "WIN" : isLoss ? "LOSS" : isDraw ? "DRAW" : "IN PROGRESS";
  const resultColor = isWin
    ? "text-green-400"
    : isLoss
      ? "text-red-400"
      : isDraw
        ? "text-yellow-400"
        : "text-gray-400";

  const matchType = match.match_type.startsWith("ai_")
    ? `vs AI (${match.match_type.replace("ai_", "")})`
    : "vs Player";

  const date = new Date(match.created_at);
  const timeAgo = getTimeAgo(date);

  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className={`font-bold ${resultColor}`}>{resultText}</span>
          <span className="text-xs text-gray-500">{matchType}</span>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          {match.rounds_won_p1} — {match.rounds_won_p2} • {match.total_turns} turns
        </p>
        {match.opponent_name && (
          <p className="text-xs text-gray-500">vs {match.opponent_name}</p>
        )}
      </div>
      <span className="text-xs text-gray-600">{timeAgo}</span>
    </div>
  );
}

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
