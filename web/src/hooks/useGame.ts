"use client";

import { useState, useCallback } from "react";
import {
  createAIGame,
  submitAction,
  ensureAuth,
  getDisplayName,
  type Action,
  type Difficulty,
  type GameState,
  type TurnResult,
  type RoundResult,
  type MatchResult,
} from "@/lib/api";

/**
 * Game flow states:
 * - lobby: choosing difficulty
 * - loading: creating game / waiting for API
 * - playing: in a match, selecting actions (countdown timer ticks here)
 * - revealing: showing turn result animation
 * - round_end: showing round result
 * - match_end: showing final match result
 */
export type GamePhase =
  | "lobby"
  | "loading"
  | "playing"
  | "revealing"
  | "round_end"
  | "match_end";

interface UseGameReturn {
  phase: GamePhase;
  gameState: GameState | null;
  lastTurn: TurnResult | null;
  lastRound: RoundResult | null;
  matchResult: MatchResult | null;
  playerName: string;
  error: string | null;
  startGame: (difficulty: Difficulty) => Promise<void>;
  playAction: (action: Action) => Promise<void>;
  continueFromReveal: () => void;
  continueFromRound: () => void;
  backToLobby: () => void;
}

/**
 * Custom hook managing the entire game lifecycle.
 *
 * This is the "state machine" of the game UI.
 * It handles: auth → game creation → turn submission → phase transitions.
 *
 * The countdown is now an inline selection timer on GameBoard (not a phase).
 * playAction submits the action and transitions directly to the result phase.
 */
export function useGame(): UseGameReturn {
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnResult | null>(null);
  const [lastRound, setLastRound] = useState<RoundResult | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [playerName, setPlayerName] = useState("Player");
  const [error, setError] = useState<string | null>(null);

  const startGame = useCallback(async (difficulty: Difficulty) => {
    try {
      setError(null);
      setPhase("loading");

      await ensureAuth();
      setPlayerName(getDisplayName() || "Player");

      const state = await createAIGame(difficulty);
      setGameState(state);
      setLastTurn(null);
      setLastRound(null);
      setMatchResult(null);
      setPhase("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start game");
      setPhase("lobby");
    }
  }, []);

  /** Submit action and transition directly to result phase (no countdown buffer) */
  const playAction = useCallback(
    async (action: Action) => {
      if (!gameState) return;

      try {
        setError(null);
        setPhase("loading");

        const response = await submitAction(gameState.game_id, action);

        // Apply result directly — no buffering
        setLastTurn(response.turn_result);
        setGameState(response.game_state);

        if (response.match_result) {
          setMatchResult(response.match_result);
          setLastRound(response.round_result);
          setPhase("match_end");
        } else if (response.round_result) {
          setLastRound(response.round_result);
          setPhase("round_end");
        } else {
          setPhase("revealing");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit action");
        setPhase("playing");
      }
    },
    [gameState]
  );

  const continueFromReveal = useCallback(() => {
    setPhase("playing");
  }, []);

  const continueFromRound = useCallback(() => {
    setLastTurn(null);
    setLastRound(null);
    setPhase("playing");
  }, []);

  const backToLobby = useCallback(() => {
    setGameState(null);
    setLastTurn(null);
    setLastRound(null);
    setMatchResult(null);
    setError(null);
    setPhase("lobby");
  }, []);

  return {
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
  };
}
