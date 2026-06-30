"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRoom,
  ensureAuth,
  getPlayerId,
  getRoom,
  joinRoom,
  leaveRoom,
  setRoomCharacter,
  setRoomReady,
  startRoomGame,
  type RoomData,
} from "@/lib/api";
import { CHARACTERS, getCharacter } from "@/lib/characters";
import CharacterAvatar from "@/components/arena/CharacterAvatar";
import { trackEvent } from "@/lib/analytics";

/**
 * Room screen — Tekken-style online lobby.
 *
 * Two entry modes:
 *   - "create": POST /rooms on mount → host this room
 *   - "join":   POST /rooms/{code}/join on mount → guest joins existing room
 *
 * Then for both modes: poll GET /rooms/{code} every 1s, render the lobby
 * (room code + both players + character pickers + ready buttons), and
 * when the server reports status=in_game with a game_id, hand off via
 * `onGameStart` so the parent navigates into the PvP gameplay flow.
 *
 * Idempotency: when both players are ready, ANY client can call /start
 * (server returns the same game_id on repeated calls). We let the host
 * fire it once, but the guest's fallback timer also fires after 1.5s of
 * "both ready" — covers cases where the host's tab is throttled.
 */

const POLL_INTERVAL_MS = 1000;

interface RoomScreenProps {
  mode: "create" | "join";
  /** Required for mode="join"; ignored for mode="create" */
  initialCode?: string;
  /** Called when the room hands off to gameplay. Receives game id, opponent
   *  name, and both players' chosen character ids so the parent can render
   *  the arena with the correct sprites. */
  onGameStart: (
    gameId: string,
    opponentName: string,
    ourCharacterId: string,
    opponentCharacterId: string,
  ) => void;
  /** Called when the user leaves the room (back to lobby) */
  onExit: () => void;
}

export default function RoomScreen({
  mode,
  initialCode,
  onGameStart,
  onExit,
}: RoomScreenProps) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const initRanRef = useRef(false);
  const startCalledRef = useRef(false);
  const gameHandedOffRef = useRef(false);
  const myIdRef = useRef<string | null>(null);

  // One-time initialisation: create or join.
  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    (async () => {
      try {
        await ensureAuth();
        myIdRef.current = getPlayerId();

        if (mode === "create") {
          const { room: r } = await createRoom();
          setRoom(r);
          trackEvent("pvp_room_created", { code: r.code });
        } else {
          if (!initialCode) {
            setError("missing room code");
            return;
          }
          const r = await joinRoom(initialCode);
          setRoom(r);
          trackEvent("pvp_room_joined", { code: r.code });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed to enter room");
      }
    })();
  }, [mode, initialCode]);

  // Poll for updates while in the room.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const r = await getRoom(room.code);
        if (cancelled) return;
        setRoom(r);
      } catch (e) {
        // 404 = room destroyed (host left) → bail out
        if (e instanceof Error && e.message.includes("not found")) {
          setError("the host left the room");
          setTimeout(onExit, 1500);
          return;
        }
        // Other errors: log but keep polling — could be transient.
      }
    };

    const handle = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
    // Only the room code matters for the polling identity — restarting on
    // every state change would spam requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code]);

  // Two separate concerns, two separate guards:
  //   gameHandedOffRef — fire onGameStart exactly once (navigate to gameplay)
  //   startCalledRef   — call POST /start at most once (avoid duplicate spawn)
  //
  // BUG FIX: previously a single `startCalledRef` guard sat ABOVE the
  // in_game check, so once the host called /start (setting the ref true),
  // the next poll that saw status=in_game returned early and onGameStart
  // never fired → stuck forever on "Match starting...". The handoff check
  // must run regardless of whether THIS client called /start.
  useEffect(() => {
    if (!room) return;

    // 1) Game is live → hand off to gameplay (once). Runs for BOTH players,
    //    whether or not this client was the one that called /start.
    if (room.status === "in_game" && room.game_id) {
      if (gameHandedOffRef.current) return;
      gameHandedOffRef.current = true;
      const myId = myIdRef.current;
      const isHost = myId === room.host.id;
      const me = isHost ? room.host : room.guest;
      const opp = isHost ? room.guest : room.host;
      onGameStart(
        room.game_id,
        opp?.name ?? "Opponent",
        me?.character_id ?? "haneul",
        opp?.character_id ?? "bora",
      );
      return;
    }

    // 2) Both ready but game not spawned yet → trigger /start (once).
    if (
      !startCalledRef.current &&
      room.status === "both_present" &&
      room.host.ready &&
      room.guest?.ready &&
      room.host.character_id &&
      room.guest.character_id
    ) {
      startCalledRef.current = true;
      startRoomGame(room.code).catch((e) => {
        startCalledRef.current = false;
        setError(e instanceof Error ? e.message : "failed to start game");
      });
    }
  }, [room, onGameStart]);

  const handleCopy = useCallback(() => {
    if (!room) return;
    const origin = window.location.origin;
    const roomLink = `${origin}/pvp?room=${room.code}`;
    navigator.clipboard.writeText(roomLink).then(() => {
      setCopied(true);
      trackEvent("invite_copied", {
        surface: "room",
        room_code: room.code,
        method: "clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [room]);

  const handlePickCharacter = useCallback(
    async (characterId: string) => {
      if (!room || busy) return;
      setBusy(true);
      try {
        const r = await setRoomCharacter(room.code, characterId);
        setRoom(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed to set character");
      } finally {
        setBusy(false);
      }
    },
    [room, busy],
  );

  const handleToggleReady = useCallback(
    async (next: boolean) => {
      if (!room || busy) return;
      setBusy(true);
      try {
        const r = await setRoomReady(room.code, next);
        setRoom(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed to set ready");
      } finally {
        setBusy(false);
      }
    },
    [room, busy],
  );

  const handleLeave = useCallback(async () => {
    if (!room) {
      onExit();
      return;
    }
    try {
      await leaveRoom(room.code);
    } catch {
      // Best effort — exit anyway.
    }
    onExit();
  }, [room, onExit]);

  if (error) {
    return (
      <div className="text-center max-w-md space-y-4">
        <p className="text-red-300 text-lg">{error}</p>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium"
        >
          ← Back to lobby
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="text-center space-y-3">
        <div className="text-4xl animate-spin">⚡</div>
        <p className="text-gray-400">
          {mode === "create" ? "Creating room..." : "Joining room..."}
        </p>
      </div>
    );
  }

  const myId = myIdRef.current;
  const isHost = myId === room.host.id;
  const me = isHost ? room.host : room.guest;
  const myCharId = me?.character_id ?? null;
  const myReady = me?.ready ?? false;
  const opponentJoined = !!room.guest;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header — code + leave */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleLeave}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          ← Leave
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            Room Code
          </p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-4xl font-black tabular-nums tracking-[0.3em] text-yellow-300"
               style={{ textShadow: "0 0 20px rgba(250,204,21,0.6)" }}>
              {room.code}
            </p>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
            >
              {copied ? "✓ Link copied" : "Copy link"}
            </button>
          </div>
        </div>
        <div className="w-[60px]" />
      </div>

      {/* Both players side-by-side */}
      <div className="grid grid-cols-2 gap-4">
        <PlayerCard
          player={room.host}
          label={isHost ? "You (Host)" : "Host"}
          highlight={isHost}
        />
        <PlayerCard
          player={room.guest}
          label={
            opponentJoined
              ? !isHost ? "You" : "Opponent"
              : "Waiting for opponent..."
          }
          highlight={!isHost && opponentJoined}
        />
      </div>

      {/* Status line */}
      <div className="text-center text-sm text-gray-400">
        {!opponentJoined && (
          <p>
            Send the room link or share code{" "}
            <span className="font-bold text-yellow-300">{room.code}</span>{" "}
            with a friend.
          </p>
        )}
        {opponentJoined && room.status === "both_present" && (
          <p>
            {room.host.ready && room.guest?.ready
              ? "Both ready — starting match..."
              : "Pick a fighter and ready up when you're set."}
          </p>
        )}
        {room.status === "in_game" && (
          <p className="text-green-400">Match starting...</p>
        )}
      </div>

      {/* Character picker (collapsed to chosen avatar once selected) */}
      {!myCharId ? (
        <div className="space-y-3">
          <p className="text-center text-xs text-gray-500 uppercase tracking-wider">
            Choose your fighter
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => handlePickCharacter(c.id)}
                disabled={busy}
                className="flex flex-col items-center gap-1 p-2 bg-gray-800 hover:bg-gray-700
                           border-2 border-gray-700 rounded-xl transition-all disabled:opacity-50"
                style={{ borderColor: undefined }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = c.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "";
                }}
              >
                <CharacterAvatar characterId={c.id} size="sm" />
                <span className="text-xs font-bold text-white">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => handlePickCharacter("")}
            className="text-sm text-gray-400 hover:text-gray-200 underline"
            disabled={myReady || busy}
          >
            Change fighter
          </button>
        </div>
      )}

      {/* Ready button */}
      {myCharId && (
        <button
          onClick={() => handleToggleReady(!myReady)}
          disabled={busy}
          className={`w-full py-4 rounded-xl text-xl font-bold transition-all shadow-lg
            ${
              myReady
                ? "bg-green-600 hover:bg-green-500 shadow-green-600/40"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/40"
            }
            disabled:opacity-50`}
        >
          {myReady ? "✓ Ready — tap to unready" : "Ready Up"}
        </button>
      )}
    </div>
  );
}

function PlayerCard({
  player,
  label,
  highlight,
}: {
  player: { id: string; name: string; character_id: string | null; ready: boolean } | null;
  label: string;
  highlight: boolean;
}) {
  const character = player?.character_id ? getCharacter(player.character_id) : null;
  return (
    <div
      className={`relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all
        ${highlight ? "border-yellow-400 bg-gray-800/80" : "border-gray-700 bg-gray-800/50"}`}
    >
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 text-center">
        {label}
      </p>
      <div className="h-28 flex items-center justify-center">
        {character ? (
          <CharacterAvatar characterId={character.id} size="lg" />
        ) : player ? (
          <div className="text-5xl text-gray-600 animate-pulse">?</div>
        ) : (
          <div className="text-4xl text-gray-700">·</div>
        )}
      </div>
      <p className="mt-2 text-base font-bold text-white truncate w-full text-center">
        {player?.name ?? "—"}
      </p>
      {character && (
        <p className="text-xs text-gray-500">{character.name}</p>
      )}
      {player && (
        <div
          className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
            ${player.ready ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"}`}
        >
          {player.ready ? "Ready" : "Not Ready"}
        </div>
      )}
    </div>
  );
}
