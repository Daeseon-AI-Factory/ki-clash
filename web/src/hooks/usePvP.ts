"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ensureAuth, type Action } from "@/lib/api";

/**
 * PvP game phases — similar to AI mode but with matchmaking steps.
 *
 * lobby → searching → matched → playing → revealing → round_end → match_end
 */
export type PvPPhase =
  | "lobby"
  | "searching"     // in matchmaking queue
  | "matched"       // match found, connecting to game
  | "playing"       // waiting for player to pick action
  | "waiting"       // player submitted, waiting for opponent
  | "revealing"     // turn result showing
  | "round_end"
  | "match_end";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

interface TurnResultData {
  turn_number: number;
  your_action: string;
  opponent_action: string;
  outcome: string;
  your_ki: number;
  opponent_ki: number;
}

interface RoundResultData {
  round_number: number;
  winner: string;  // "you" | "opponent" | "draw"
  total_turns: number;
}

interface MatchResultData {
  winner: string;  // "you" | "opponent" | "draw"
  rounds_won_p1: number;
  rounds_won_p2: number;
  total_turns: number;
}

interface GameStateData {
  turn: number;
  round_number: number;
  your_ki: number;
  opponent_ki: number;
  time_limit: number;
}

interface UsePvPReturn {
  phase: PvPPhase;
  opponentName: string | null;
  gameState: GameStateData | null;
  turnResult: TurnResultData | null;
  roundResult: RoundResultData | null;
  matchResult: MatchResultData | null;
  roundsWonYou: number;
  roundsWonOpponent: number;
  error: string | null;
  findMatch: () => Promise<void>;
  cancelSearch: () => void;
  submitAction: (action: Action) => void;
  continueFromReveal: () => void;
  continueFromRound: () => void;
  backToLobby: () => void;
  /** Skip matchmaking — connect directly to an existing game (e.g. spawned by a Room). */
  joinGame: (gameId: string, opponentName?: string) => Promise<void>;
}

/**
 * Custom hook for PvP multiplayer via WebSocket.
 *
 * Manages two WebSocket connections:
 * 1. Matchmaking WS — join queue, wait for pairing
 * 2. Game WS — submit actions, receive results
 */
export function usePvP(): UsePvPReturn {
  const [phase, setPhase] = useState<PvPPhase>("lobby");
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  const [turnResult, setTurnResult] = useState<TurnResultData | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResultData | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultData | null>(null);
  const [roundsWonYou, setRoundsWonYou] = useState(0);
  const [roundsWonOpponent, setRoundsWonOpponent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // WebSocket refs (persist across renders without causing re-renders)
  const matchmakingWs = useRef<WebSocket | null>(null);
  const gameWs = useRef<WebSocket | null>(null);

  // Cleanup WebSockets on unmount
  useEffect(() => {
    return () => {
      matchmakingWs.current?.close();
      gameWs.current?.close();
    };
  }, []);

  const getToken = (): string | null => {
    return localStorage.getItem("ki_clash_token");
  };

  /** Connect to matchmaking WebSocket and join queue */
  const findMatch = useCallback(async () => {
    try {
      setError(null);
      await ensureAuth();

      const token = getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }

      setPhase("searching");

      const ws = new WebSocket(
        `${WS_BASE}/api/v1/ws/matchmaking?token=${token}`
      );
      matchmakingWs.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "queue_joined":
            // Still searching
            break;

          case "match_found":
            // Found an opponent — connect to game WS
            setOpponentName(msg.data.opponent_name);
            setPhase("matched");
            ws.close();
            matchmakingWs.current = null;
            connectToGame(msg.data.game_id, token);
            break;

          case "matchmaking_timeout":
            setError("No opponents found. Try AI mode!");
            setPhase("lobby");
            ws.close();
            matchmakingWs.current = null;
            break;

          case "pong":
            break;
        }
      };

      ws.onerror = () => {
        setError("Connection error");
        setPhase("lobby");
      };

      ws.onclose = () => {
        matchmakingWs.current = null;
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to find match");
      setPhase("lobby");
    }
  }, []);

  /** Connect to game WebSocket for real-time PvP */
  const connectToGame = useCallback(
    (gameId: string, token: string) => {
      const ws = new WebSocket(
        `${WS_BASE}/api/v1/ws/game/${gameId}?token=${token}`
      );
      gameWs.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "waiting_for_action":
            setGameState({
              turn: msg.data.turn,
              round_number: msg.data.round_number,
              your_ki: msg.data.p1_ki,
              opponent_ki: msg.data.p2_ki,
              time_limit: msg.data.time_limit,
            });
            setPhase("playing");
            break;

          case "action_confirmed":
            setPhase("waiting");
            break;

          case "turn_result":
            setTurnResult(msg.data);
            setPhase("revealing");
            break;

          case "round_result": {
            setRoundResult(msg.data);
            const winner = msg.data.winner;
            if (winner === "you") {
              setRoundsWonYou((prev) => prev + 1);
            } else if (winner === "opponent") {
              setRoundsWonOpponent((prev) => prev + 1);
            }
            setPhase("round_end");
            break;
          }

          case "match_result":
            setMatchResult(msg.data);
            setPhase("match_end");
            ws.close();
            gameWs.current = null;
            break;

          case "opponent_disconnected":
            setError(
              `Opponent disconnected. Waiting ${msg.data.reconnect_timeout}s...`
            );
            break;

          case "opponent_reconnected":
            setError(null);
            break;

          case "error":
            setError(msg.data.message);
            break;

          case "pong":
            break;
        }
      };

      ws.onerror = () => {
        setError("Game connection error");
        setPhase("lobby");
      };

      ws.onclose = () => {
        gameWs.current = null;
      };
    },
    []
  );

  /** Join a pre-existing game (spawned by a Room — bypasses matchmaking). */
  const joinGame = useCallback(
    async (gameId: string, name?: string) => {
      try {
        setError(null);
        await ensureAuth();
        const token = getToken();
        if (!token) {
          setError("Not authenticated");
          return;
        }
        if (name) setOpponentName(name);
        setPhase("matched");
        connectToGame(gameId, token);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to join game");
        setPhase("lobby");
      }
    },
    [connectToGame],
  );

  const cancelSearch = useCallback(() => {
    if (matchmakingWs.current) {
      matchmakingWs.current.send(JSON.stringify({ type: "leave_queue" }));
      matchmakingWs.current.close();
      matchmakingWs.current = null;
    }
    setPhase("lobby");
  }, []);

  const submitAction = useCallback((action: Action) => {
    if (gameWs.current?.readyState === WebSocket.OPEN) {
      gameWs.current.send(
        JSON.stringify({ type: "submit_action", action })
      );
    }
  }, []);

  const continueFromReveal = useCallback(() => {
    // Server will send next waiting_for_action automatically
    // Just clear the reveal display
    setTurnResult(null);
  }, []);

  const continueFromRound = useCallback(() => {
    setTurnResult(null);
    setRoundResult(null);
    // Server will send next waiting_for_action automatically
  }, []);

  const backToLobby = useCallback(() => {
    gameWs.current?.close();
    matchmakingWs.current?.close();
    setPhase("lobby");
    setOpponentName(null);
    setGameState(null);
    setTurnResult(null);
    setRoundResult(null);
    setMatchResult(null);
    setRoundsWonYou(0);
    setRoundsWonOpponent(0);
    setError(null);
  }, []);

  return {
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
    joinGame,
  };
}
