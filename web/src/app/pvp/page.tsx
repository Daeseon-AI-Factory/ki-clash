"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePvP } from "@/hooks/usePvP";
import ActionCard from "@/components/ActionCard";
import KiMeter from "@/components/KiMeter";
import type { Action } from "@/lib/api";
import Link from "next/link";
import KiAuraArena from "@/components/arena/KiAuraArena";
import PixiBattleArena, {
  type ArenaEffect,
} from "@/components/arena/pixi/PixiBattleArenaClient";
import type { EffectKind, Side } from "@/components/arena/pixi/effects";
import MatchFinale from "@/components/finale/MatchFinale";
import RoomScreen from "@/components/room/RoomScreen";
import { AdBanner, InterstitialAd } from "@/components/ads";
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

  const { showInterstitial, onMatchEnd, dismissInterstitial } = useAdTiming();

  const playerCharacter = getCharacter(chars.player);
  const opponentCharacter = getCharacter(chars.opponent);

  // Pixi wants 0xRRGGBB numbers; Character.color is a hex STRING ("#60A5FA").
  const hexToNum = (hex?: string): number =>
    parseInt((hex ?? "").replace("#", ""), 16) || 0xffffff;
  const playerColorNum = hexToNum(playerCharacter?.color);
  const enemyColorNum = hexToNum(opponentCharacter?.color);

  // API action strings are 1:1 with Pixi EffectKind (both snake_case).
  const ACTION_TO_EFFECT: Record<Action, EffectKind> = {
    charge: "charge",
    block: "block",
    attack: "attack",
    energy_wave: "energy_wave",
    teleport: "teleport",
  };

  // Single `effect` prop, fired by bumping a ref-tracked nonce (ref, not state,
  // so two fires in one turn each get a distinct nonce — no batch collapse).
  const [arenaEffect, setArenaEffect] = useState<ArenaEffect | null>(null);
  const effectNonce = useRef(0);
  const enemyFxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fireEffect = useCallback((kind: EffectKind, side: Side) => {
    effectNonce.current += 1;
    setArenaEffect({ kind, side, nonce: effectNonce.current });
  }, []);

  const prevPhase = useRef(phase);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = phase;
    if (phase === "revealing" && prev !== "revealing" && turnResult) {
      // Fire both fighters' effects on the WebGL arena. Player immediately;
      // opponent staggered ~140ms so the nonce watcher fires twice (and it
      // reads as a swing-then-clash beat rather than a simultaneous blob).
      fireEffect(ACTION_TO_EFFECT[turnResult.your_action as Action], "player");
      if (enemyFxTimer.current) clearTimeout(enemyFxTimer.current);
      const oppAction = turnResult.opponent_action as Action;
      enemyFxTimer.current = setTimeout(
        () => fireEffect(ACTION_TO_EFFECT[oppAction], "enemy"),
        140,
      );
    }
    if (phase === "match_end" && prev !== "match_end") {
      onMatchEnd();
    }
  }, [phase, turnResult, onMatchEnd, fireEffect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear a pending opponent-effect timer on unmount (StrictMode-safe).
  useEffect(() => () => {
    if (enemyFxTimer.current) clearTimeout(enemyFxTimer.current);
  }, []);

  // When usePvP returns to its own "lobby" phase (after match end + Play Again),
  // bring the page mode back to the menu too.
  useEffect(() => {
    if (phase === "lobby" && pageMode === "pvp") {
      setPageMode("menu");
    }
  }, [phase, pageMode]);

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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <InterstitialAd show={showInterstitial} onDismiss={dismissInterstitial} />

      {error && pageMode !== "room" && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm max-w-md">
          {error}
        </div>
      )}

      {/* MENU — Quick Match / Create Room / Join Room */}
      {pageMode === "menu" && (
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
            href="/"
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
      {pageMode === "room" && (
        <RoomScreen
          mode={roomMode}
          initialCode={joinCodeInput || undefined}
          onGameStart={handleRoomGameStart}
          onExit={handleRoomExit}
        />
      )}

      {/* PVP — usePvP-driven gameplay phases */}
      {pageMode === "pvp" && phase === "searching" && (
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

      {pageMode === "pvp" && phase === "matched" && (
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

      {/* Persistent WebGL arena — mounted ONCE across all gameplay phases
          (playing/revealing/waiting/round_end) so the Pixi context isn't
          recreated every turn and fighters stay consistent. Effects fire via
          the `arenaEffect` nonce at the reveal moment. */}
      {pageMode === "pvp" &&
        playerCharacter &&
        opponentCharacter &&
        (phase === "playing" ||
          phase === "revealing" ||
          phase === "waiting" ||
          phase === "round_end") && (
          <div
            className="w-full max-w-2xl rounded-xl overflow-hidden bg-gray-950/60 mb-2"
            style={{ height: "32vh", minHeight: 200 }}
          >
            <PixiBattleArena
              playerSrc={`/fighters/${chars.player}/idle.png`}
              enemySrc={`/fighters/${chars.opponent}/idle.png`}
              playerColor={playerColorNum}
              enemyColor={enemyColorNum}
              effect={arenaEffect}
            />
          </div>
        )}

      {pageMode === "pvp" && phase === "playing" && gameState && (
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Round {gameState.round_number} • Turn {gameState.turn}
            </p>
            <p className="text-lg font-bold mt-1">
              You {roundsWonYou} — {roundsWonOpponent} {opponentName || "Opponent"}
            </p>
          </div>

          <div className="space-y-2">
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
        </div>
      )}

      {pageMode === "pvp" && phase === "waiting" && (
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">Waiting for opponent...</p>
          <p className="text-sm text-gray-400">
            You&apos;ve locked in your action
          </p>
        </div>
      )}

      {pageMode === "pvp" && phase === "revealing" && turnResult && (
        <div className="w-full max-w-md space-y-6">
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

      {pageMode === "pvp" && phase === "round_end" && roundResult && (
        <div className="w-full max-w-md text-center space-y-6">
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

      {pageMode === "pvp" && phase === "match_end" && matchResult && (
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
