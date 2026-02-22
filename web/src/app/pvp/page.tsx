"use client";

import { usePvP } from "@/hooks/usePvP";
import ActionCard from "@/components/ActionCard";
import KiMeter from "@/components/KiMeter";
import type { Action } from "@/lib/api";
import type { PixelAction } from "@/lib/pixel-art-types";
import Link from "next/link";
import { BattleArena, PixelPortrait } from "@/components/pixel-art";
import { AdBanner, InterstitialAd } from "@/components/ads";
import { usePixelAnimation } from "@/hooks/usePixelAnimation";
import { useAdTiming } from "@/hooks/useAdTiming";
import { useEffect, useRef } from "react";

const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

const OUTCOME_DISPLAY: Record<string, { text: string; color: string }> = {
  you_win: { text: "HIT!", color: "text-green-400" },
  you_lose: { text: "HIT!", color: "text-red-400" },
  clash: { text: "CLASH!", color: "text-yellow-400" },
  blocked: { text: "BLOCKED!", color: "text-blue-400" },
  dodged: { text: "DODGED!", color: "text-purple-400" },
  neutral: { text: "\u2014", color: "text-gray-400" },
};

const ACTION_EMOJI: Record<string, string> = {
  charge: "\u26A1",
  block: "\uD83D\uDEE1\uFE0F",
  attack: "\uD83D\uDC4A",
  energy_wave: "\uD83D\uDD25",
  teleport: "\uD83D\uDCA8",
};

const ACTION_TO_PIXEL: Record<Action, PixelAction> = {
  charge: "charge",
  block: "block",
  attack: "attack",
  energy_wave: "energyWave",
  teleport: "teleport",
};

// Fixed characters for PvP (no character select in PvP flow yet)
const PLAYER_CHAR_ID = "haneul";
const OPPONENT_CHAR_ID = "bora";

export default function PvPPage() {
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

  const { action: pixelAction, phase: pixelPhase, triggerAction: triggerPixel } = usePixelAnimation();
  const { showInterstitial, onMatchEnd, dismissInterstitial } = useAdTiming();

  // Derive AI pixel action from turnResult — synced to same phase as player
  const aiPixelAction: PixelAction | null =
    pixelAction && turnResult ? ACTION_TO_PIXEL[turnResult.opponent_action as Action] : null;

  // Trigger pixel animation on turn reveal
  const prevPhase = useRef(phase);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = phase;

    if (phase === "revealing" && prev !== "revealing" && turnResult) {
      triggerPixel(ACTION_TO_PIXEL[turnResult.your_action as Action]);
    }
    if (phase === "match_end" && prev !== "match_end") {
      onMatchEnd();
    }
  }, [phase, turnResult, triggerPixel, onMatchEnd]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <InterstitialAd show={showInterstitial} onDismiss={dismissInterstitial} />

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm max-w-md">
          {error}
        </div>
      )}

      {/* LOBBY */}
      {phase === "lobby" && (
        <div className="text-center space-y-8 max-w-md">
          <div>
            <h1 className="text-5xl font-black mb-2">PvP Mode</h1>
            <p className="text-xl text-gray-400">기싸움 — vs Real Player</p>
            <p className="text-sm text-gray-500 mt-2">
              Find an opponent and battle in real-time.
            </p>
          </div>

          <BattleArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
          />

          <button
            onClick={findMatch}
            className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl
                       text-xl font-bold transition-colors"
          >
            Find Match
          </button>
          <Link
            href="/"
            className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back to AI Mode
          </Link>
          <AdBanner adSlot={process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT || ""} className="mt-4" />
        </div>
      )}

      {/* SEARCHING */}
      {phase === "searching" && (
        <div className="text-center space-y-6 max-w-md">
          <BattleArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
          />
          <div>
            <p className="text-xl font-bold">Searching for opponent...</p>
            <p className="text-sm text-gray-400 mt-2">
              Waiting for another player to join
            </p>
          </div>
          <button
            onClick={cancelSearch}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl
                       text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* MATCHED — brief transition */}
      {phase === "matched" && (
        <div className="text-center space-y-4">
          <BattleArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
          />
          <p className="text-2xl font-bold">Match Found!</p>
          <p className="text-gray-400">vs {opponentName}</p>
          <div className="text-4xl animate-spin">⚡</div>
        </div>
      )}

      {/* PLAYING — select action */}
      {phase === "playing" && gameState && (
        <div className="w-full max-w-2xl space-y-6">
          {/* Score + Ki */}
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Round {gameState.round_number} • Turn {gameState.turn}
            </p>
            <p className="text-lg font-bold mt-1">
              You {roundsWonYou} — {roundsWonOpponent} {opponentName || "Opponent"}
            </p>
          </div>

          <BattleArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
          />

          <div className="space-y-2">
            <KiMeter ki={gameState.your_ki} label="You" isPlayer={true} />
            <KiMeter ki={gameState.opponent_ki} label={opponentName || "Opponent"} isPlayer={false} />
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
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
          </div>

          <p className="text-center text-xs text-gray-500">
            {gameState.time_limit}s to choose — auto-Charge if you don&apos;t pick
          </p>
        </div>
      )}

      {/* WAITING — submitted, waiting for opponent */}
      {phase === "waiting" && (
        <div className="text-center space-y-4">
          <BattleArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
          />
          <p className="text-lg font-medium">Waiting for opponent...</p>
          <p className="text-sm text-gray-400">
            You&apos;ve locked in your action
          </p>
        </div>
      )}

      {/* REVEALING — turn result */}
      {phase === "revealing" && turnResult && (
        <div className="w-full max-w-md space-y-6">
          <BattleArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
            playerAction={pixelAction}
            aiAction={aiPixelAction}
            phase={pixelPhase}
          />

          <div className="flex items-center justify-center gap-8 py-6">
            <div className="flex flex-col items-center">
              <span className="text-4xl">{ACTION_EMOJI[turnResult.your_action] || "\u2753"}</span>
              <span className="text-sm text-gray-400 mt-1">
                {turnResult.your_action.replace("_", " ")}
              </span>
              <span className="text-xs text-green-400">You</span>
            </div>
            <span className="text-2xl font-bold text-gray-500">VS</span>
            <div className="flex flex-col items-center">
              <span className="text-4xl">{ACTION_EMOJI[turnResult.opponent_action] || "\u2753"}</span>
              <span className="text-sm text-gray-400 mt-1">
                {turnResult.opponent_action.replace("_", " ")}
              </span>
              <span className="text-xs text-red-400">{opponentName || "Opponent"}</span>
            </div>
          </div>

          {(() => {
            const display = OUTCOME_DISPLAY[turnResult.outcome] || OUTCOME_DISPLAY.neutral;
            return (
              <p className={`text-3xl font-black text-center ${display.color}`}>
                {display.text}
              </p>
            );
          })()}

          <div className="flex justify-between text-sm text-gray-400 px-4">
            <span>Your Ki: {turnResult.your_ki}</span>
            <span>Opponent Ki: {turnResult.opponent_ki}</span>
          </div>
        </div>
      )}

      {/* ROUND END */}
      {phase === "round_end" && roundResult && (
        <div className="w-full max-w-md text-center space-y-6">
          <BattleArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
            playerAction={pixelAction}
            aiAction={aiPixelAction}
            phase={pixelPhase}
          />
          <div className="py-6 bg-gray-800 rounded-xl">
            <p className="text-sm text-gray-400 uppercase tracking-wider">
              Round {roundResult.round_number} Complete
            </p>
            <p
              className={`text-3xl font-black mt-2 ${
                roundResult.winner === "you"
                  ? "text-green-400"
                  : roundResult.winner === "opponent"
                    ? "text-red-400"
                    : "text-yellow-400"
              }`}
            >
              {roundResult.winner === "you"
                ? "YOU WIN!"
                : roundResult.winner === "opponent"
                  ? "OPPONENT WINS!"
                  : "DRAW!"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {roundResult.total_turns} turns
            </p>
          </div>
        </div>
      )}

      {/* MATCH END */}
      {phase === "match_end" && matchResult && (
        <div className="w-full max-w-md text-center space-y-6">
          <div className="py-8">
            <div className="flex justify-center mb-4">
              {matchResult.winner === "you" ? (
                <PixelPortrait characterId={PLAYER_CHAR_ID} size="lg" />
              ) : matchResult.winner === "opponent" ? (
                <PixelPortrait characterId={OPPONENT_CHAR_ID} size="lg" />
              ) : (
                <p className="text-6xl">🤝</p>
              )}
            </div>
            <p
              className={`text-4xl font-black ${
                matchResult.winner === "you"
                  ? "text-green-400"
                  : matchResult.winner === "opponent"
                    ? "text-red-400"
                    : "text-yellow-400"
              }`}
            >
              {matchResult.winner === "you"
                ? "VICTORY!"
                : matchResult.winner === "opponent"
                  ? "DEFEAT!"
                  : "DRAW!"}
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 space-y-3">
            <div className="flex justify-between text-lg">
              <span className="text-gray-400">vs</span>
              <span className="font-bold">{opponentName}</span>
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
    </div>
  );
}
