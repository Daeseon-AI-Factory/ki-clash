import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
  type RoomPlayerData,
} from "@/lib/api";
import { errorMessage, trackEvent } from "@/lib/analytics";
import { CHARACTERS } from "@/lib/characters";
import { PixelPortrait } from "@/components/deprecated/pixel-art";
import { colors, fontSize, spacing } from "@/lib/theme";

const POLL_INTERVAL_MS = 1000;
const WEB_BASE = process.env.EXPO_PUBLIC_WEB_URL || "https://jjan.daeseon.ai";

interface RoomLobbyProps {
  mode: "create" | "join";
  initialCode?: string;
  onGameStart: (
    gameId: string,
    opponentName: string,
    ourCharacterId: string,
    opponentCharacterId: string
  ) => void;
  onExit: () => void;
}

export default function RoomLobby({
  mode,
  initialCode,
  onGameStart,
  onExit,
}: RoomLobbyProps) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const initRanRef = useRef(false);
  const startCalledRef = useRef(false);
  const gameHandedOffRef = useRef(false);
  const myIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    (async () => {
      try {
        await ensureAuth();
        const id = await getPlayerId();
        myIdRef.current = id;
        setMyId(id);

        if (mode === "create") {
          const { room: created } = await createRoom();
          setRoom(created);
          trackEvent("pvp_room_created", { code: created.code });
          return;
        }

        const code = (initialCode || "").toUpperCase();
        if (code.length !== 4) {
          setError("Enter a 4-character room code.");
          return;
        }
        const joined = await joinRoom(code);
        setRoom(joined);
        trackEvent("pvp_room_joined", { code: joined.code });
      } catch (e) {
        const message = errorMessage(e);
        setError(message || "Failed to enter room");
        trackEvent("mobile_room_error", {
          mode,
          code: initialCode || null,
          message,
        });
      }
    })();
  }, [mode, initialCode]);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const next = await getRoom(room.code);
        if (!cancelled) setRoom(next);
      } catch (e) {
        if (e instanceof Error && e.message.includes("not found")) {
          setError("The room is gone.");
          trackEvent("mobile_room_error", {
            mode,
            code: room.code,
            message: "room not found while polling",
          });
          setTimeout(onExit, 1500);
        }
      }
    };

    const handle = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [room?.code, onExit]);

  useEffect(() => {
    if (!room) return;

    if (room.status === "in_game" && room.game_id) {
      if (gameHandedOffRef.current) return;
      gameHandedOffRef.current = true;
      const isHost = myIdRef.current === room.host.id;
      const me = isHost ? room.host : room.guest;
      const opponent = isHost ? room.guest : room.host;
      onGameStart(
        room.game_id,
        opponent?.name || "Opponent",
        me?.character_id || "haneul",
        opponent?.character_id || "bora"
      );
      return;
    }

    if (
      !startCalledRef.current &&
      room.status === "both_present" &&
      room.host.ready &&
      room.guest?.ready &&
      room.host.character_id &&
      room.guest.character_id
    ) {
      startCalledRef.current = true;
      startRoomGame(room.code)
        .then(({ game_id, room: next }) => {
          trackEvent("pvp_match_started", {
            mode: "room",
            code: room.code,
            game_id,
          });
          setRoom(next);
        })
        .catch((e) => {
          startCalledRef.current = false;
          const message = errorMessage(e);
          setError(message || "Failed to start game");
          trackEvent("mobile_room_error", {
            mode,
            code: room.code,
            message,
          });
        });
    }
  }, [room, onGameStart]);

  const handleShare = useCallback(async () => {
    if (!room) return;
    const roomLink = `${WEB_BASE}/pvp?room=${room.code}`;
    await Share.share({
      title: "Ki Clash Room",
      message: `Join my Ki Clash room: ${room.code}\n${roomLink}`,
      url: roomLink,
    });
    trackEvent("invite_copied", {
      surface: "mobile_room",
      room_code: room.code,
      method: "native_share",
    });
  }, [room]);

  const handlePickCharacter = useCallback(
    async (characterId: string) => {
      if (!room || busy) return;
      setBusy(true);
      try {
        const next = await setRoomCharacter(room.code, characterId);
        setRoom(next);
      } catch (e) {
        const message = errorMessage(e);
        setError(message || "Failed to pick fighter");
        trackEvent("mobile_room_error", {
          mode,
          code: room.code,
          action: "set_character",
          message,
        });
      } finally {
        setBusy(false);
      }
    },
    [room, busy]
  );

  const handleReady = useCallback(
    async (ready: boolean) => {
      if (!room || busy) return;
      setBusy(true);
      try {
        const next = await setRoomReady(room.code, ready);
        setRoom(next);
      } catch (e) {
        const message = errorMessage(e);
        setError(message || "Failed to ready up");
        trackEvent("mobile_room_error", {
          mode,
          code: room.code,
          action: "set_ready",
          message,
        });
      } finally {
        setBusy(false);
      }
    },
    [room, busy]
  );

  const handleLeave = useCallback(async () => {
    if (!room) {
      onExit();
      return;
    }
    try {
      await leaveRoom(room.code);
    } catch {
      // Best effort.
    }
    onExit();
  }, [room, onExit]);

  if (error) {
    return (
      <View style={styles.centerArea}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={onExit}>
          <Text style={styles.secondaryButtonText}>Back to PvP</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.centerArea}>
        <ActivityIndicator size="large" color={colors.yellow} />
        <Text style={styles.statusText}>
          {mode === "create" ? "Creating room..." : "Joining room..."}
        </Text>
      </View>
    );
  }

  const isHost = myId === room.host.id;
  const me = isHost ? room.host : room.guest;
  const opponent = isHost ? room.guest : room.host;
  const myCharId = me?.character_id || null;
  const myReady = me?.ready || false;
  const opponentJoined = !!room.guest;
  const bothReady = !!(room.host.ready && room.guest?.ready);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeave} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.roomCodeBox}>
          <Text style={styles.roomLabel}>Room Code</Text>
          <Text style={styles.roomCode}>{room.code}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.playersRow}>
        <PlayerCard
          player={room.host}
          label={isHost ? "You (Host)" : "Host"}
          highlight={isHost}
        />
        <PlayerCard
          player={room.guest}
          label={isHost ? "Opponent" : "You"}
          highlight={!isHost && opponentJoined}
        />
      </View>

      <Text style={styles.statusText}>
        {!opponentJoined
          ? "Share the room code with a friend."
          : bothReady
            ? "Both ready. Starting match..."
            : "Pick a fighter, then ready up."}
      </Text>

      <View style={styles.characterGrid}>
        {CHARACTERS.map((char) => {
          const selected = myCharId === char.id;
          return (
            <TouchableOpacity
              key={char.id}
              style={[
                styles.characterButton,
                {
                  borderColor: selected ? char.color : colors.border,
                  opacity: myReady && !selected ? 0.45 : 1,
                },
              ]}
              disabled={busy || myReady}
              onPress={() => handlePickCharacter(char.id)}
              activeOpacity={0.7}
            >
              <PixelPortrait characterId={char.id} size="sm" />
              <Text style={styles.characterName}>{char.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.readyButton,
          {
            backgroundColor: myReady ? colors.surfaceHover : colors.btnSuccess,
            opacity: myCharId && opponentJoined ? 1 : 0.5,
          },
        ]}
        disabled={!myCharId || !opponentJoined || busy}
        onPress={() => handleReady(!myReady)}
        activeOpacity={0.7}
      >
        <Text style={styles.readyButtonText}>
          {myReady ? "Ready" : "Ready Up"}
        </Text>
      </TouchableOpacity>

      {opponent && (
        <Text style={styles.opponentHint}>
          vs {opponent.name}
        </Text>
      )}
    </View>
  );
}

function PlayerCard({
  player,
  label,
  highlight,
}: {
  player: RoomPlayerData | null;
  label: string;
  highlight: boolean;
}) {
  const charId = player?.character_id || "haneul";
  return (
    <View
      style={[
        styles.playerCard,
        { borderColor: highlight ? colors.yellow : colors.border },
      ]}
    >
      {player ? (
        <>
          <PixelPortrait characterId={charId} size="md" />
          <Text style={styles.playerLabel}>{label}</Text>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text
            style={[
              styles.readyState,
              { color: player.ready ? colors.green : colors.textMuted },
            ]}
          >
            {player.ready ? "Ready" : "Not ready"}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.emptySlot}>WAIT</Text>
          <Text style={styles.playerLabel}>{label}</Text>
          <Text style={styles.playerName}>Waiting...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  centerArea: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  roomCodeBox: {
    alignItems: "center",
    flex: 1,
  },
  roomLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  roomCode: {
    color: colors.yellow,
    fontSize: fontSize.xxxl,
    fontWeight: "900",
    letterSpacing: 8,
  },
  shareButton: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  shareButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  playersRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  playerCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 150,
  },
  playerLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  playerName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: "800",
    textAlign: "center",
  },
  readyState: {
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
  emptySlot: {
    color: colors.textMuted,
    fontSize: fontSize.xl,
    fontWeight: "900",
    marginVertical: spacing.xl,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  characterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  characterButton: {
    width: "31%",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  characterName: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: "800",
  },
  readyButton: {
    borderRadius: 12,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  readyButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: "900",
  },
  opponentHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: "center",
  },
  errorText: {
    color: colors.red,
    fontSize: fontSize.md,
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
});
