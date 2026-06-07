"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { getCharacter } from "@/lib/characters";
import type { Difficulty, TurnOutcome } from "@/lib/api";
import Link from "next/link";
import GameBoard from "@/components/GameBoard";
import MatchHUD from "@/components/MatchHUD";
import TurnReveal, { getShakeClass } from "@/components/TurnReveal";
import CharacterSelect from "@/components/CharacterSelect";
import AITrashTalk from "@/components/AITrashTalk";
import MuteButton from "@/components/MuteButton";
import KiAuraArena from "@/components/arena/KiAuraArena";
import PixiFxOverlay, {
  type OverlayEffect,
} from "@/components/arena/pixi/PixiFxOverlayClient";
import MatchFinale from "@/components/finale/MatchFinale";
import { AdBanner, InterstitialAd } from "@/components/ads";
import { useActionAnimation } from "@/hooks/useActionAnimation";
import { useAdTiming } from "@/hooks/useAdTiming";
import { API_TO_ACTION, type ActionKind } from "@/lib/actions";

/** Map turn outcomes to sound names */
const OUTCOME_SOUND: Record<TurnOutcome, "hit" | "clash" | "block" | "dodge" | "charge"> = {
  p1_wins_round: "hit",
  p2_wins_round: "hit",
  clash: "clash",
  blocked: "block",
  dodged: "dodge",
  neutral: "charge",
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
  const { action: arenaAction, phase: arenaPhase, triggerAction: triggerArenaAction } =
    useActionAnimation();
  const { showInterstitial, showAds, onMatchEnd, dismissInterstitial } = useAdTiming();

  // Derive AI's animated action from lastTurn — synced to the same phase as the player.
  const aiArenaAction: ActionKind | null =
    arenaAction && lastTurn ? API_TO_ACTION[lastTurn.p2_action] : null;

  // Derive character objects from IDs (memoized to avoid re-lookups)
  const playerCharacter = useMemo(
    () => (playerCharacterId ? getCharacter(playerCharacterId) : undefined),
    [playerCharacterId]
  );
  const aiCharacter = useMemo(
    () => (aiCharacterId ? getCharacter(aiCharacterId) : undefined),
    [aiCharacterId]
  );

  // Display names — use character name if chosen, else fall back to player/AI label.
  const playerDisplayName = playerCharacter ? playerCharacter.name : playerName;
  const aiDisplayName = aiCharacter ? aiCharacter.name : "AI";

  // ── WebGL effect overlay (additive — layered over KiAuraArena, DR-18) ────
  const hexToNum = (hex?: string): number =>
    parseInt((hex ?? "").replace("#", ""), 16) || 0xffffff;
  const playerColorNum = hexToNum(playerCharacter?.color);
  const aiColorNum = hexToNum(aiCharacter?.color);
  const [arenaEffect, setArenaEffect] = useState<OverlayEffect | null>(null);
  const effectNonce = useRef(0);
  const enemyFxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireEffect = useCallback((kind: OverlayEffect["kind"], side: OverlayEffect["side"]) => {
    effectNonce.current += 1;
    setArenaEffect({ kind, side, nonce: effectNonce.current });
  }, []);
  useEffect(() => () => { if (enemyFxTimer.current) clearTimeout(enemyFxTimer.current); }, []);

  // Track previous phase to detect transitions
  const prevPhaseRef = useRef(phase);

  // Auto-advance — user explicitly wanted faster pacing ("3초후에 다음턴으로").
  // TurnReveal's outcome lands ~2.1s after entering the revealing phase;
  // a further 3s holds the result, then we advance automatically. The
  // "Next Turn" / "Next Round" buttons stay around as a skip-ahead option.
  useEffect(() => {
    if (phase === "revealing") {
      const t = setTimeout(continueFromReveal, 5100);
      return () => clearTimeout(t);
    }
    if (phase === "round_end") {
      const t = setTimeout(continueFromRound, 4500);
      return () => clearTimeout(t);
    }
  }, [phase, continueFromReveal, continueFromRound]);

  // Play sounds on phase transitions
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    // Reveal sound + arena animation when entering revealing/round_end/match_end from loading
    if (
      prevPhase === "loading" &&
      phase !== "loading" &&
      phase !== "playing" &&
      phase !== "lobby" &&
      phase !== "character_select"
    ) {
      play("reveal");

      // Outcome sound after a short delay (let reveal sweep finish)
      if (lastTurn) {
        setTimeout(() => play(OUTCOME_SOUND[lastTurn.outcome]), 300);
        // Drive KiAuraArena's action animation lifecycle (motion — untouched).
        triggerArenaAction(API_TO_ACTION[lastTurn.p1_action]);
        // ADD WebGL particle effects on top: player now, AI staggered ~140ms.
        fireEffect(lastTurn.p1_action, "player");
        if (enemyFxTimer.current) clearTimeout(enemyFxTimer.current);
        const aiAct = lastTurn.p2_action;
        enemyFxTimer.current = setTimeout(() => fireEffect(aiAct, "enemy"), 140);
      }
    }

    // Round result sounds
    if (phase === "round_end" && lastRound) {
      setTimeout(() => {
        play(lastRound.winner === "p1" ? "round_win" : "round_lose");
      }, 600);
    }

    // Match result — sound + ad trigger. (MatchFinale handles its own visual cinematics.)
    if (phase === "match_end" && matchResult) {
      setTimeout(() => {
        play(matchResult.winner === "p1" ? "round_win" : "round_lose");
      }, 1500); // delay until after vignette + zoom — lands with the title slam
      onMatchEnd();
    }
  }, [phase, lastTurn, lastRound, matchResult, play, onMatchEnd, triggerArenaAction, fireEffect]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div
      className={`min-h-[100svh] bg-gray-900 text-white flex flex-col items-center justify-center p-4 ${shakeClass}`}
    >
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
          {showAds && (
            <AdBanner
              adSlot={process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT || ""}
              className="mt-6 w-full max-w-md"
            />
          )}
        </>
      )}

      {/* CHARACTER SELECT — Pick your fighter */}
      {phase === "character_select" && <CharacterSelect onSelect={startGame} />}

      {/* LOADING */}
      {phase === "loading" && (
        <div className="text-center">
          <div className="text-4xl animate-spin mb-4">⚡</div>
          <p className="text-gray-400">Loading...</p>
        </div>
      )}

      {/* UNIFIED GAMEPLAY — one fixed skeleton across playing/revealing/round_end.
          HUD + arena stay in the SAME place/size every phase; only the
          fixed-height bottom slot's CONTENT swaps. Nothing reflows → the screen
          never jumps between phases. One screen, any phone, no scroll. */}
      {(phase === "playing" || phase === "revealing" || phase === "round_end") &&
        gameState && (
          <div className="w-full max-w-2xl flex flex-col gap-2 overflow-hidden h-[calc(100svh-2rem)]">
            {/* HUD — always present, same spot */}
            <div className="shrink-0">
              <MatchHUD
                gameState={gameState}
                playerName={playerName}
                showAIThinking={phase === "playing"}
                playerCharacter={playerCharacter}
                aiCharacter={aiCharacter}
              />
            </div>

            {/* Arena — always present, same size; props change per phase but the
                component (and its WebGL overlay) never remounts. */}
            {playerCharacterId && aiCharacterId && (
              <div className="relative flex-1 min-h-0">
                <KiAuraArena
                  playerCharacterId={playerCharacterId}
                  aiCharacterId={aiCharacterId}
                  playerAction={phase === "playing" ? null : arenaAction}
                  aiAction={phase === "playing" ? null : aiArenaAction}
                  phase={phase === "playing" ? "idle" : arenaPhase}
                  outcome={phase === "playing" ? null : lastTurn?.outcome ?? null}
                  fill
                />
                <PixiFxOverlay
                  className="absolute inset-0 pointer-events-none"
                  playerColor={playerColorNum}
                  enemyColor={aiColorNum}
                  effect={arenaEffect}
                />
              </div>
            )}

            {/* BOTTOM SLOT — FIXED height; content swaps by phase, no reflow. */}
            <div className="shrink-0 h-[224px] flex flex-col justify-center">
              {phase === "playing" && (
                <GameBoard
                  playerKi={gameState.current_round?.p1_ki ?? 0}
                  disabled={false}
                  onSubmit={playAction}
                  onCountdownBeat={handleCountdownBeat}
                />
              )}
              {phase === "revealing" && (
                <TurnReveal
                  turnResult={lastTurn}
                  visible={true}
                  onOutcomeRevealed={handleOutcomeRevealed}
                  playerName={playerDisplayName}
                  aiName={aiDisplayName}
                />
              )}
              {phase === "round_end" && lastRound && (
                <div className="text-center py-4 bg-gray-800 rounded-xl">
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
              )}
            </div>
          </div>
        )}

      {/* MATCH END — cinematic finale owns the entire screen */}
      {phase === "match_end" && matchResult && (
        <MatchFinale
          result={
            matchResult.winner === "p1"
              ? "win"
              : matchResult.winner === "p2"
                ? "loss"
                : "draw"
          }
          finalScore={{
            player: matchResult.rounds_won_p1,
            opponent: matchResult.rounds_won_p2,
          }}
          totalTurns={matchResult.total_turns}
          playerCharacter={playerCharacter}
          opponentCharacter={aiCharacter}
          onPlayAgain={backToLobby}
        />
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
        <h1 className="text-6xl font-black mb-2 tracking-tighter"
            style={{
              textShadow: "0 0 24px #FACC1588, 0 2px 8px rgba(0,0,0,0.5)",
              letterSpacing: "-0.04em",
            }}>
          JJAN<span className="text-yellow-300">!</span>
        </h1>
        <p className="text-xl text-gray-400">짠 · 기싸움</p>
        <p className="text-sm text-gray-500 mt-2">
          1-second reveal duel. Read your opponent. Charge your ki. Strike at the right moment.
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
