"use client";

import { usePvP } from "@/hooks/usePvP";
import ActionCard from "@/components/ActionCard";
import KiMeter from "@/components/KiMeter";
import type { Action } from "@/lib/api";
import { API_TO_ACTION, type ActionKind } from "@/lib/actions";
import Link from "next/link";
import KiAuraArena from "@/components/arena/KiAuraArena";
import MatchFinale from "@/components/finale/MatchFinale";
import { AdBanner, InterstitialAd } from "@/components/ads";
import { useActionAnimation } from "@/hooks/useActionAnimation";
import { useAdTiming } from "@/hooks/useAdTiming";
import { getCharacter } from "@/lib/characters";
import { useEffect, useRef } from "react";

const ACTIONS: Action[] = ["charge", "block", "attack", "energy_wave", "teleport"];

const OUTCOME_DISPLAY: Record<string, { text: string; color: string }> = {
  you_win: { text: "HIT!", color: "text-green-400" },
  you_lose: { text: "HIT!", color: "text-red-400" },
  clash: { text: "CLASH!", color: "text-yellow-400" },
  blocked: { text: "BLOCKED!", color: "text-blue-400" },
  dodged: { text: "DODGED!", color: "text-purple-400" },
  neutral: { text: "—", color: "text-gray-400" },
};

const ACTION_EMOJI: Record<string, string> = {
  charge: "⚡",
  block: "🛡️",
  attack: "👊",
  energy_wave: "🔥",
  teleport: "💨",
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
    backToLobby,
  } = usePvP();

  const { action: arenaAction, phase: arenaPhase, triggerAction: triggerArenaAction } =
    useActionAnimation();
  const { showInterstitial, onMatchEnd, dismissInterstitial } = useAdTiming();

  // Derive opponent's animated action from turnResult — synced to the same phase.
  const opponentArenaAction: ActionKind | null =
    arenaAction && turnResult
      ? API_TO_ACTION[turnResult.opponent_action as Action]
      : null;

  // Resolve characters (currently fixed assignment; character-select PvP is future work)
  const playerCharacter = getCharacter(PLAYER_CHAR_ID);
  const opponentCharacter = getCharacter(OPPONENT_CHAR_ID);

  // Trigger arena animation on turn reveal + match-end ad timing
  const prevPhase = useRef(phase);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = phase;

    if (phase === "revealing" && prev !== "revealing" && turnResult) {
      triggerArenaAction(API_TO_ACTION[turnResult.your_action as Action]);
    }
    if (phase === "match_end" && prev !== "match_end") {
      onMatchEnd();
    }
  }, [phase, turnResult, triggerArenaAction, onMatchEnd]);

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

          <KiAuraArena
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
          <AdBanner
            adSlot={process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT || ""}
            className="mt-4"
          />
        </div>
      )}

      {/* SEARCHING */}
      {phase === "searching" && (
        <div className="text-center space-y-6 max-w-md">
          <KiAuraArena
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
          <KiAuraArena
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

          <KiAuraArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
          />

          <div className="space-y-2">
            <KiMeter ki={gameState.your_ki} label="You" isPlayer={true} />
            <KiMeter
              ki={gameState.opponent_ki}
              label={opponentName || "Opponent"}
              isPlayer={false}
            />
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
          <KiAuraArena
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
          <KiAuraArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
            playerAction={arenaAction}
            aiAction={opponentArenaAction}
            phase={arenaPhase}
          />

          <div className="flex items-center justify-center gap-8 py-6">
            <div className="flex flex-col items-center">
              <span className="text-4xl">
                {ACTION_EMOJI[turnResult.your_action] || "❓"}
              </span>
              <span className="text-sm text-gray-400 mt-1">
                {turnResult.your_action.replace("_", " ")}
              </span>
              <span className="text-xs text-green-400">You</span>
            </div>
            <span className="text-2xl font-bold text-gray-500">VS</span>
            <div className="flex flex-col items-center">
              <span className="text-4xl">
                {ACTION_EMOJI[turnResult.opponent_action] || "❓"}
              </span>
              <span className="text-sm text-gray-400 mt-1">
                {turnResult.opponent_action.replace("_", " ")}
              </span>
              <span className="text-xs text-red-400">
                {opponentName || "Opponent"}
              </span>
            </div>
          </div>

          {(() => {
            const display =
              OUTCOME_DISPLAY[turnResult.outcome] || OUTCOME_DISPLAY.neutral;
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
          <KiAuraArena
            playerCharacterId={PLAYER_CHAR_ID}
            aiCharacterId={OPPONENT_CHAR_ID}
            playerAction={arenaAction}
            aiAction={opponentArenaAction}
            phase={arenaPhase}
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

      {/* MATCH END — cinematic finale */}
      {phase === "match_end" && matchResult && (
        <MatchFinale
          result={
            matchResult.winner === "you"
              ? "win"
              : matchResult.winner === "opponent"
                ? "loss"
                : "draw"
          }
          finalScore={{ player: roundsWonYou, opponent: roundsWonOpponent }}
          totalTurns={matchResult.total_turns}
          playerCharacter={playerCharacter}
          opponentCharacter={opponentCharacter}
          opponentName={opponentName ?? undefined}
          onPlayAgain={backToLobby}
        />
      )}
    </div>
  );
}
