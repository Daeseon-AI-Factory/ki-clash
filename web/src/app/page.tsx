"use client";

import { useGame } from "@/hooks/useGame";
import type { Difficulty } from "@/lib/api";
import Link from "next/link";
import GameBoard from "@/components/GameBoard";
import MatchHUD from "@/components/MatchHUD";
import TurnReveal from "@/components/TurnReveal";

export default function Home() {
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
    backToLobby,
  } = useGame();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* LOBBY — Choose difficulty */}
      {phase === "lobby" && <LobbyScreen onStart={startGame} />}

      {/* LOADING */}
      {phase === "loading" && (
        <div className="text-center">
          <div className="text-4xl animate-spin mb-4">⚡</div>
          <p className="text-gray-400">Loading...</p>
        </div>
      )}

      {/* PLAYING — Main game */}
      {phase === "playing" && gameState && (
        <div className="w-full max-w-2xl space-y-6">
          <MatchHUD gameState={gameState} playerName={playerName} />
          <GameBoard
            playerKi={gameState.current_round?.p1_ki ?? 0}
            disabled={false}
            onSubmit={playAction}
          />
        </div>
      )}

      {/* REVEALING — Turn result */}
      {phase === "revealing" && (
        <div className="w-full max-w-2xl space-y-6">
          {gameState && <MatchHUD gameState={gameState} playerName={playerName} />}
          <TurnReveal turnResult={lastTurn} visible={true} />
          <button
            onClick={continueFromReveal}
            className="w-full max-w-2xl py-3 bg-gray-700 hover:bg-gray-600 rounded-xl
                       text-lg font-medium transition-colors"
          >
            Next Turn →
          </button>
        </div>
      )}

      {/* ROUND END */}
      {phase === "round_end" && lastRound && (
        <div className="w-full max-w-2xl space-y-6">
          {gameState && <MatchHUD gameState={gameState} playerName={playerName} />}
          <TurnReveal turnResult={lastTurn} visible={true} />
          <div className="text-center py-6 bg-gray-800 rounded-xl">
            <p className="text-sm text-gray-400 uppercase tracking-wider">
              Round {lastRound.round_number} Complete
            </p>
            <p
              className={`text-3xl font-black mt-2 ${
                lastRound.winner === "p1"
                  ? "text-green-400"
                  : lastRound.winner === "p2"
                    ? "text-red-400"
                    : "text-yellow-400"
              }`}
            >
              {lastRound.winner === "p1"
                ? "YOU WIN!"
                : lastRound.winner === "p2"
                  ? "AI WINS!"
                  : "DRAW!"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {lastRound.total_turns} turns played
            </p>
          </div>
          <button
            onClick={continueFromRound}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl
                       text-lg font-bold transition-colors"
          >
            Next Round →
          </button>
        </div>
      )}

      {/* MATCH END */}
      {phase === "match_end" && matchResult && (
        <div className="w-full max-w-md text-center space-y-6">
          <div className="py-8">
            <p className="text-6xl mb-4">
              {matchResult.winner === "p1" ? "🏆" : matchResult.winner === "p2" ? "💀" : "🤝"}
            </p>
            <p
              className={`text-4xl font-black ${
                matchResult.winner === "p1"
                  ? "text-green-400"
                  : matchResult.winner === "p2"
                    ? "text-red-400"
                    : "text-yellow-400"
              }`}
            >
              {matchResult.winner === "p1"
                ? "VICTORY!"
                : matchResult.winner === "p2"
                  ? "DEFEAT!"
                  : "DRAW!"}
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 space-y-3">
            <div className="flex justify-between text-lg">
              <span className="text-gray-400">Final Score</span>
              <span className="font-bold">
                {matchResult.rounds_won_p1} — {matchResult.rounds_won_p2}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Turns</span>
              <span className="font-medium">{matchResult.total_turns}</span>
            </div>
          </div>

          <button
            onClick={backToLobby}
            className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl
                       text-xl font-bold transition-colors"
          >
            Play Again
          </button>
        </div>
      )}

      {/* PvP link on lobby */}
      {phase === "lobby" && (
        <Link
          href="/pvp"
          className="mt-4 text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          vs Real Player (PvP) →
        </Link>
      )}
    </div>
  );
}

/** Lobby screen — title + difficulty selection */
function LobbyScreen({
  onStart,
}: {
  onStart: (difficulty: Difficulty) => void;
}) {
  const difficulties: { level: Difficulty; label: string; desc: string }[] = [
    { level: "easy", label: "Easy", desc: "Random moves, charges a lot" },
    { level: "medium", label: "Medium", desc: "Reads your patterns" },
    { level: "hard", label: "Hard", desc: "Game-theory optimal" },
  ];

  return (
    <div className="text-center space-y-8 max-w-md">
      <div>
        <h1 className="text-5xl font-black mb-2">Ki Clash</h1>
        <p className="text-xl text-gray-400">기싸움</p>
        <p className="text-sm text-gray-500 mt-2">
          Read your opponent. Charge your ki. Strike at the right moment.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-gray-400 uppercase tracking-wider">
          Choose Difficulty
        </p>
        {difficulties.map(({ level, label, desc }) => (
          <button
            key={level}
            onClick={() => onStart(level)}
            className="w-full py-4 px-6 bg-gray-800 hover:bg-gray-700 border border-gray-700
                       hover:border-gray-500 rounded-xl transition-all text-left"
          >
            <span className="text-lg font-bold">{label}</span>
            <span className="text-sm text-gray-400 ml-3">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
