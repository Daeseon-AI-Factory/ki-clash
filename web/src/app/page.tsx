"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { getCharacter } from "@/lib/characters";
import type { Action, Difficulty, TurnOutcome } from "@/lib/api";
import Link from "next/link";
import GameBoard from "@/components/GameBoard";
import MatchHUD from "@/components/MatchHUD";
import TurnReveal, { getShakeClass } from "@/components/TurnReveal";
import CharacterSelect from "@/components/CharacterSelect";
import AITrashTalk from "@/components/AITrashTalk";
import MuteButton from "@/components/MuteButton";
import { BattleArena, PixelPortrait } from "@/components/deprecated/pixel-art";
import { AdBanner, InterstitialAd } from "@/components/ads";
import { usePixelAnimation } from "@/hooks/deprecated/usePixelAnimation";
import { useAdTiming } from "@/hooks/useAdTiming";
import type { PixelAction } from "@/lib/deprecated/pixel-art-types";

/** Map turn outcomes to sound names */
const OUTCOME_SOUND: Record<TurnOutcome, "hit" | "clash" | "block" | "dodge" | "charge"> = {
  p1_wins_round: "hit",
  p2_wins_round: "hit",
  clash: "clash",
  blocked: "block",
  dodged: "dodge",
  neutral: "charge",
};

/** Map backend Action to PixelAction for battle arena animation */
const ACTION_TO_PIXEL: Record<Action, PixelAction> = {
  charge: "charge",
  block: "block",
  attack: "attack",
  energy_wave: "energyWave",
  teleport: "teleport",
};

export default function Home() {
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
    selectDifficulty,
    startGame,
    playAction,
    continueFromReveal,
    continueFromRound,
    backToLobby,
  } = useGame();

  const { play, muted, toggleMute } = useSoundEffects();
  const [shakeClass, setShakeClass] = useState("");
  const { action: pixelAction, phase: pixelPhase, triggerAction: triggerPixelAction } = usePixelAnimation();
  const {
    action: finishAction,
    phase: finishPhase,
    triggerAction: triggerFinish,
  } = usePixelAnimation({ windupMs: 600, impactMs: 1000, recoverMs: 1200 });
  const { showInterstitial, showAds, onMatchEnd, dismissInterstitial } = useAdTiming();

  // Derive AI pixel action from lastTurn — synced to same phase as player
  const aiPixelAction: PixelAction | null =
    pixelAction && lastTurn ? ACTION_TO_PIXEL[lastTurn.p2_action] : null;

  // Derive finish actions — winner gets "victory", loser gets "defeat"
  const playerFinishAction: PixelAction | null =
    finishAction && matchResult
      ? matchResult.winner === "p1" ? "victory" : matchResult.winner === "p2" ? "defeat" : "victory"
      : null;
  const aiFinishAction: PixelAction | null =
    finishAction && matchResult
      ? matchResult.winner === "p2" ? "victory" : matchResult.winner === "p1" ? "defeat" : "victory"
      : null;

  // Derive character objects from IDs (memoized to avoid re-lookups)
  const playerCharacter = useMemo(
    () => (playerCharacterId ? getCharacter(playerCharacterId) : undefined),
    [playerCharacterId]
  );
  const aiCharacter = useMemo(
    () => (aiCharacterId ? getCharacter(aiCharacterId) : undefined),
    [aiCharacterId]
  );

  // Display names: name only (pixel portraits handle visual identity)
  const playerDisplayName = playerCharacter
    ? playerCharacter.name
    : playerName;
  const aiDisplayName = aiCharacter
    ? aiCharacter.name
    : "AI";

  // Track previous phase to detect transitions
  const prevPhaseRef = useRef(phase);

  // Play sounds on phase transitions
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    // Reveal sound + pixel animation when entering revealing/round_end/match_end from loading
    if (prevPhase === "loading" && phase !== "loading" && phase !== "playing" && phase !== "lobby" && phase !== "character_select") {
      play("reveal");

      // Outcome sound after a short delay (let reveal sweep finish)
      if (lastTurn) {
        setTimeout(() => play(OUTCOME_SOUND[lastTurn.outcome]), 300);
        // Trigger pixel arena animation matching the player's action
        triggerPixelAction(ACTION_TO_PIXEL[lastTurn.p1_action]);
      }
    }

    // Round result sounds
    if (phase === "round_end" && lastRound) {
      setTimeout(() => {
        play(lastRound.winner === "p1" ? "round_win" : "round_lose");
      }, 600);
    }

    // Match result sounds + victory/defeat animation + ad trigger
    if (phase === "match_end" && matchResult) {
      triggerFinish(matchResult.winner === "p1" ? "victory" : "defeat");
      setTimeout(() => {
        play(matchResult.winner === "p1" ? "round_win" : "round_lose");
      }, 600);
      onMatchEnd();
    }
  }, [phase, lastTurn, lastRound, matchResult, play, onMatchEnd, triggerFinish]);

  /** Countdown beat handler — plays click sound on each tick */
  const handleCountdownBeat = useCallback(() => {
    play("countdown_beat");
  }, [play]);

  /** Screen shake when outcome is revealed inside TurnReveal */
  const handleOutcomeRevealed = useCallback((outcome: TurnOutcome) => {
    const cls = getShakeClass(outcome);
    if (cls) {
      setShakeClass(cls);
      // Remove class after animation completes so it can re-trigger
      setTimeout(() => setShakeClass(""), 500);
    }
  }, []);

  return (
    <div className={`min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 ${shakeClass}`}>
      {/* Mute toggle */}
      <MuteButton muted={muted} onToggle={toggleMute} />

      {/* Interstitial ad overlay (between matches, hidden if ad-free) */}
      {showAds && <InterstitialAd show={showInterstitial} onDismiss={dismissInterstitial} />}

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* LOBBY — Choose difficulty */}
      {phase === "lobby" && (
        <>
          <LobbyScreen onStart={selectDifficulty} />
          {showAds && <AdBanner adSlot={process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT || ""} className="mt-6 w-full max-w-md" />}
        </>
      )}

      {/* CHARACTER SELECT — Pick your fighter */}
      {phase === "character_select" && (
        <CharacterSelect onSelect={startGame} />
      )}

      {/* LOADING */}
      {phase === "loading" && (
        <div className="text-center">
          <div className="text-4xl animate-spin mb-4">⚡</div>
          <p className="text-gray-400">Loading...</p>
        </div>
      )}

      {/* PLAYING — Main game with inline selection timer */}
      {phase === "playing" && gameState && (
        <div className="w-full max-w-2xl space-y-6">
          <MatchHUD gameState={gameState} playerName={playerName} showAIThinking playerCharacter={playerCharacter} aiCharacter={aiCharacter} />
          {playerCharacterId && aiCharacterId && (
            <BattleArena
              playerCharacterId={playerCharacterId}
              aiCharacterId={aiCharacterId}
            />
          )}
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
        </div>
      )}

      {/* REVEALING — Turn result */}
      {phase === "revealing" && (
        <div className="w-full max-w-2xl space-y-6">
          {gameState && <MatchHUD gameState={gameState} playerName={playerName} playerCharacter={playerCharacter} aiCharacter={aiCharacter} />}
          {playerCharacterId && aiCharacterId && (
            <BattleArena
              playerCharacterId={playerCharacterId}
              aiCharacterId={aiCharacterId}
              playerAction={pixelAction}
              aiAction={aiPixelAction}
              phase={pixelPhase}
            />
          )}
          <TurnReveal turnResult={lastTurn} visible={true} onOutcomeRevealed={handleOutcomeRevealed} playerName={playerDisplayName} aiName={aiDisplayName} />
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
          {gameState && <MatchHUD gameState={gameState} playerName={playerName} playerCharacter={playerCharacter} aiCharacter={aiCharacter} />}
          {playerCharacterId && aiCharacterId && (
            <BattleArena
              playerCharacterId={playerCharacterId}
              aiCharacterId={aiCharacterId}
              playerAction={pixelAction}
              aiAction={aiPixelAction}
              phase={pixelPhase}
            />
          )}
          <TurnReveal turnResult={lastTurn} visible={true} onOutcomeRevealed={handleOutcomeRevealed} playerName={playerDisplayName} aiName={aiDisplayName} />
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
        <div className="w-full max-w-2xl text-center space-y-6">
          {/* Battle arena with victory/defeat animation */}
          {playerCharacterId && aiCharacterId && (
            <BattleArena
              playerCharacterId={playerCharacterId}
              aiCharacterId={aiCharacterId}
              playerAction={playerFinishAction}
              aiAction={aiFinishAction}
              phase={finishPhase}
            />
          )}

          <div className="py-4">
            <p
              className={`text-5xl font-black animate-match-result-slam ${
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

      {/* Navigation links on lobby */}
      {phase === "lobby" && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <Link
            href="/tutorial"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            How to Play (Tutorial) →
          </Link>
          <Link
            href="/pvp"
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            vs Real Player (PvP) →
          </Link>
          <Link
            href="/invite"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Challenge a Friend →
          </Link>
          <Link
            href="/history"
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            Match History →
          </Link>
          <Link
            href="/ranked"
            className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            Ranked Leaderboard →
          </Link>
          <Link
            href="/shop"
            className="text-sm text-green-400 hover:text-green-300 transition-colors"
          >
            Shop — Remove Ads →
          </Link>
        </div>
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
