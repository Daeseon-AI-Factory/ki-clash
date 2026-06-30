"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePvP } from "@/hooks/usePvP";
import ActionCard from "@/components/ActionCard";
import KiMeter from "@/components/KiMeter";
import type { Action } from "@/lib/api";
import { API_TO_ACTION, type ActionKind } from "@/lib/actions";
import type { TurnOutcome } from "@/lib/api";
import Link from "next/link";
import KiAuraArena from "@/components/arena/KiAuraArena";
import PixiFxOverlay, {
  type OverlayEffect,
} from "@/components/arena/pixi/PixiFxOverlayClient";
import MatchFinale from "@/components/finale/MatchFinale";
import RoomScreen from "@/components/room/RoomScreen";
import { AdBanner, InterstitialAd } from "@/components/ads";
import { useActionAnimation } from "@/hooks/useActionAnimation";
import { useAdTiming } from "@/hooks/useAdTiming";
import { getCharacter } from "@/lib/characters";

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

/**
 * Page-level mode controls which top-level UI is showing:
 *   - "menu"  → PvP entry lobby (Quick Match / Create Room / Join Room)
 *   - "room"  → RoomScreen (host or guest)
 *   - "pvp"   → usePvP-driven gameplay flow (matched/playing/.../match_end)
 *
 * Quick Match goes menu → pvp directly. Room flows go menu → room → pvp
 * once both players ready and the server spawns the game.
 */
type PageMode = "menu" | "room" | "pvp";

const DEFAULT_PLAYER_CHAR = "haneul";
const DEFAULT_OPPONENT_CHAR = "bora";

function readInitialRoomCode(): string {
  if (typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get("room")
    || new URLSearchParams(window.location.search).get("code")
    || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

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
    joinGame,
  } = usePvP();

  // Page mode + room sub-mode + characters chosen for THIS match.
  // Characters default to a fixed pair for Quick Match (where there's no
  // pre-game character select) but are overwritten by the Room flow.
  const [pageMode, setPageMode] = useState<PageMode>("menu");
  const [roomMode, setRoomMode] = useState<"create" | "join">("create");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [chars, setChars] = useState<{ player: string; opponent: string }>({
    player: DEFAULT_PLAYER_CHAR,
    opponent: DEFAULT_OPPONENT_CHAR,
  });
  const initialRoomHandledRef = useRef(false);
  const visiblePageMode: PageMode =
    phase === "lobby" && pageMode === "pvp" ? "menu" : pageMode;

  const { action: arenaAction, phase: arenaPhase, triggerAction: triggerArenaAction } =
    useActionAnimation();
  const { showInterstitial, onMatchEnd, dismissInterstitial } = useAdTiming();

  const opponentArenaAction: ActionKind | null =
    arenaAction && turnResult
      ? API_TO_ACTION[turnResult.opponent_action as Action]
      : null;

  const arenaOutcome: TurnOutcome | null = (() => {
    if (!turnResult) return null;
    const o = turnResult.outcome;
    if (o === "you_win") return "p1_wins_round";
    if (o === "you_lose") return "p2_wins_round";
    if (o === "clash" || o === "blocked" || o === "dodged" || o === "neutral") {
      return o;
    }
    return null;
  })();

  const playerCharacter = getCharacter(chars.player);
  const opponentCharacter = getCharacter(chars.opponent);

  // ── WebGL effect overlay (additive — layered over KiAuraArena, DR-18) ────
  const hexToNum = (hex?: string): number =>
    parseInt((hex ?? "").replace("#", ""), 16) || 0xffffff;
  const playerColorNum = hexToNum(playerCharacter?.color);
  const enemyColorNum = hexToNum(opponentCharacter?.color);
  const [arenaEffect, setArenaEffect] = useState<OverlayEffect | null>(null);
  const effectNonce = useRef(0);
  const enemyFxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireEffect = useCallback((kind: OverlayEffect["kind"], side: OverlayEffect["side"]) => {
    effectNonce.current += 1;
    setArenaEffect({ kind, side, nonce: effectNonce.current });
  }, []);
  useEffect(() => () => { if (enemyFxTimer.current) clearTimeout(enemyFxTimer.current); }, []);

  const prevPhase = useRef(phase);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = phase;
    if (phase === "revealing" && prev !== "revealing" && turnResult) {
      triggerArenaAction(API_TO_ACTION[turnResult.your_action as Action]);
      // ADD WebGL particle effects on top: player now, opponent staggered.
      fireEffect(turnResult.your_action as OverlayEffect["kind"], "player");
      if (enemyFxTimer.current) clearTimeout(enemyFxTimer.current);
      const oppAct = turnResult.opponent_action as OverlayEffect["kind"];
      enemyFxTimer.current = setTimeout(() => fireEffect(oppAct, "enemy"), 140);
    }
    if (phase === "match_end" && prev !== "match_end") {
      onMatchEnd();
    }
  }, [phase, turnResult, triggerArenaAction, onMatchEnd, fireEffect]);

  // Direct room links: /pvp?room=ABCD opens the join-room flow after hydration.
  useEffect(() => {
    if (initialRoomHandledRef.current) return;
    initialRoomHandledRef.current = true;
    const roomCode = readInitialRoomCode();
    if (roomCode.length !== 4) return;
    const handle = window.setTimeout(() => {
      setJoinCodeInput(roomCode);
      setRoomMode("join");
      setPageMode("room");
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  // ── Action handlers ────────────────────────────────────────────────────

  const startQuickMatch = async () => {
    setChars({ player: DEFAULT_PLAYER_CHAR, opponent: DEFAULT_OPPONENT_CHAR });
    setPageMode("pvp");
    await findMatch();
  };

  const startCreateRoom = () => {
    setRoomMode("create");
    setPageMode("room");
  };

  const startJoinRoom = () => {
    if (joinCodeInput.trim().length !== 4) return;
    setRoomMode("join");
    setPageMode("room");
  };

  const handleRoomGameStart = (
    gameId: string,
    oppName: string,
    ourChar: string,
    oppChar: string,
  ) => {
    setChars({ player: ourChar, opponent: oppChar });
    setPageMode("pvp");
    joinGame(gameId, oppName);
  };

  const handleRoomExit = () => {
    setJoinCodeInput("");
    setPageMode("menu");
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100svh] bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <InterstitialAd show={showInterstitial} onDismiss={dismissInterstitial} />

      {error && visiblePageMode !== "room" && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm max-w-md">
          {error}
        </div>
      )}

      {/* MENU — Quick Match / Create Room / Join Room */}
      {visiblePageMode === "menu" && (
        <div className="text-center space-y-8 max-w-md w-full">
          <div>
            <h1 className="text-5xl font-black mb-2">PvP Mode</h1>
            <p className="text-xl text-gray-400">기싸움 — vs Real Player</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={startQuickMatch}
              className="w-full py-5 bg-gradient-to-r from-red-600 to-orange-500
                         hover:from-red-500 hover:to-orange-400
                         rounded-xl text-xl font-bold transition-all shadow-lg shadow-red-900/40"
            >
              ⚡ Quick Match
              <span className="block text-xs font-medium opacity-80 mt-1">
                Auto-matched with the next available opponent
              </span>
            </button>

            <button
              onClick={startCreateRoom}
              className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-500
                         hover:from-blue-500 hover:to-indigo-400
                         rounded-xl text-xl font-bold transition-all shadow-lg shadow-blue-900/40"
            >
              🏠 Create Room
              <span className="block text-xs font-medium opacity-80 mt-1">
                Get a code, share with a friend
              </span>
            </button>

            {/* Join Room — inline code input */}
            <div className="p-4 bg-gray-800/80 border border-gray-700 rounded-xl space-y-3">
              <p className="text-sm font-medium text-gray-300">
                🚪 Join Room — enter the 4-character code
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="text"
                  maxLength={4}
                  autoCapitalize="characters"
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") startJoinRoom();
                  }}
                  placeholder="ABCD"
                  className="flex-1 px-4 py-3 bg-gray-900 border-2 border-gray-700
                             focus:border-purple-500 rounded-lg text-2xl font-black
                             tracking-[0.4em] text-center outline-none"
                />
                <button
                  onClick={startJoinRoom}
                  disabled={joinCodeInput.trim().length !== 4}
                  className="px-5 py-3 bg-purple-600 hover:bg-purple-500
                             disabled:bg-gray-700 disabled:text-gray-500
                             rounded-lg font-bold transition-colors"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          <Link
            href="/play"
            className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back to AI Mode
          </Link>
          <AdBanner
            adSlot={process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT || ""}
            className="mt-2"
          />
        </div>
      )}

      {/* ROOM — host or guest waiting flow */}
      {visiblePageMode === "room" && (
        <RoomScreen
          mode={roomMode}
          initialCode={joinCodeInput || undefined}
          onGameStart={handleRoomGameStart}
          onExit={handleRoomExit}
        />
      )}

      {/* PVP — usePvP-driven gameplay phases */}
      {visiblePageMode === "pvp" && phase === "searching" && (
        <div className="text-center space-y-6 max-w-md">
          <KiAuraArena
            playerCharacterId={chars.player}
            aiCharacterId={chars.opponent}
          />
          <div>
            <p className="text-xl font-bold">Searching for opponent...</p>
            <p className="text-sm text-gray-400 mt-2">
              Waiting for another player to join
            </p>
          </div>
          <button
            onClick={() => {
              cancelSearch();
              setPageMode("menu");
            }}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl
                       text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {visiblePageMode === "pvp" && phase === "matched" && (
        <div className="text-center space-y-4">
          <KiAuraArena
            playerCharacterId={chars.player}
            aiCharacterId={chars.opponent}
          />
          <p className="text-2xl font-bold">Match Found!</p>
          <p className="text-gray-400">vs {opponentName}</p>
          <div className="text-4xl animate-spin">⚡</div>
        </div>
      )}

      {/* UNIFIED PVP GAMEPLAY — one fixed skeleton across playing/waiting/
          revealing/round_end. Header + arena stay put; only the bottom slot's
          content swaps. No reflow, one screen, any phone (mirrors AI page). */}
      {visiblePageMode === "pvp" &&
        (phase === "playing" ||
          phase === "waiting" ||
          phase === "revealing" ||
          phase === "round_end") && (
          <div className="w-full max-w-2xl flex flex-col justify-center gap-2 overflow-hidden h-[calc(100svh-2rem)]">
            {/* Header — round + score, always */}
            <div className="shrink-0 text-center leading-tight">
              <p className="text-sm font-black text-yellow-400 uppercase tracking-widest">
                Round{" "}
                {gameState?.round_number ??
                  roundResult?.round_number ??
                  1}
              </p>
              <p className="text-2xl font-black text-white">
                {roundsWonYou} — {roundsWonOpponent}
              </p>
              <p className="text-[10px] text-gray-500">
                You vs {opponentName || "Opponent"}
                {gameState ? ` · Turn ${gameState.turn}` : ""}
              </p>
            </div>

            {/* Arena — always, capped height; overlay always mounted */}
            <div className="relative flex-1 min-h-0 max-h-[34svh]">
              <KiAuraArena
                playerCharacterId={chars.player}
                aiCharacterId={chars.opponent}
                playerAction={
                  phase === "revealing" || phase === "round_end" ? arenaAction : null
                }
                aiAction={
                  phase === "revealing" || phase === "round_end"
                    ? opponentArenaAction
                    : null
                }
                phase={
                  phase === "revealing" || phase === "round_end" ? arenaPhase : "idle"
                }
                outcome={
                  phase === "revealing" || phase === "round_end" ? arenaOutcome : null
                }
                fill
              />
              <PixiFxOverlay
                className="absolute inset-0 pointer-events-none"
                playerColor={playerColorNum}
                enemyColor={enemyColorNum}
                effect={arenaEffect}
              />
            </div>

            {/* BOTTOM SLOT — min-h, content swaps by phase, never clips */}
            <div className="shrink-0 min-h-[12rem] flex flex-col justify-center gap-2">
              {phase === "playing" && gameState && (
                <>
                  <div className="space-y-1">
                    <KiMeter ki={gameState.your_ki} label="You" isPlayer={true} />
                    <KiMeter
                      ki={gameState.opponent_ki}
                      label={opponentName || "Opponent"}
                      isPlayer={false}
                    />
                  </div>
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
                </>
              )}

              {phase === "waiting" && (
                <div className="text-center">
                  <p className="text-lg font-medium">Waiting for opponent...</p>
                  <p className="text-sm text-gray-400">You&apos;ve locked in your action</p>
                </div>
              )}

              {phase === "revealing" && turnResult && (
                <>
                  <div className="flex items-center justify-center gap-8">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl">{ACTION_EMOJI[turnResult.your_action] || "❓"}</span>
                      <span className="text-xs text-green-400">You</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-500">VS</span>
                    <div className="flex flex-col items-center">
                      <span className="text-4xl">{ACTION_EMOJI[turnResult.opponent_action] || "❓"}</span>
                      <span className="text-xs text-red-400">{opponentName || "Opponent"}</span>
                    </div>
                  </div>
                  {(() => {
                    const display = OUTCOME_DISPLAY[turnResult.outcome] || OUTCOME_DISPLAY.neutral;
                    return <p className={`text-3xl font-black text-center ${display.color}`}>{display.text}</p>;
                  })()}
                  <div className="flex justify-between text-sm text-gray-400 px-4">
                    <span>Your Ki: {turnResult.your_ki}</span>
                    <span>Opp Ki: {turnResult.opponent_ki}</span>
                  </div>
                </>
              )}

              {phase === "round_end" && roundResult && (
                <div className="text-center py-3 bg-gray-800 rounded-xl">
                  <p className="text-sm text-gray-400 uppercase tracking-wider">
                    Round {roundResult.round_number} Complete
                  </p>
                  <p
                    className={`text-3xl font-black mt-1 ${
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
                </div>
              )}
            </div>
          </div>
        )}

      {visiblePageMode === "pvp" && phase === "match_end" && matchResult && (
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
          onPlayAgain={() => {
            backToLobby();
            setPageMode("menu");
          }}
        />
      )}
    </div>
  );
}
