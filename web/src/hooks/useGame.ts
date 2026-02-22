"use client";

import { useState, useCallback, useRef } from "react";
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
  type SubmitActionResponse,
} from "@/lib/api";

/**
 * Game flow states:
 * - lobby: choosing difficulty
 * - loading: creating game / waiting for API
 * - playing: in a match, selecting actions
 * - countdown: 3-beat countdown before reveal (API response buffered in ref)
 * - revealing: showing turn result animation
 * - round_end: showing round result
 * - match_end: showing final match result
 */
export type GamePhase =
  | "lobby"
  | "loading"
  | "playing"
  | "countdown"
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
  /** Called when the countdown animation finishes — applies buffered result */
  onCountdownComplete: () => void;
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
 * The countdown phase buffers the API response in a ref (NOT state) to avoid
 * rendering the result before the countdown finishes. When onCountdownComplete
 * fires, we flush the ref into state and transition to the next phase.
 */
export function useGame(): UseGameReturn {
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnResult | null>(null);
  const [lastRound, setLastRound] = useState<RoundResult | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [playerName, setPlayerName] = useState("Player");
  const [error, setError] = useState<string | null>(null);

  // Buffered API response — held during countdown, applied on completion
  const pendingResult = useRef<SubmitActionResponse | null>(null);

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

  const playAction = useCallback(
    async (action: Action) => {
      if (!gameState) return;

      try {
        setError(null);
        setPhase("loading");

        const response: SubmitActionResponse = await submitAction(
          gameState.game_id,
          action
        );

        // Buffer the response — don't render yet
        pendingResult.current = response;
        // Transition to countdown — result stays hidden
        setPhase("countdown");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit action");
        setPhase("playing");
      }
    },
    [gameState]
  );

  /** Flush buffered result into state and advance to the correct phase */
  const onCountdownComplete = useCallback(() => {
    const response = pendingResult.current;
    if (!response) return;
    pendingResult.current = null;

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
  }, []);

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
    pendingResult.current = null;
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
    onCountdownComplete,
    continueFromReveal,
    continueFromRound,
    backToLobby,
  };
}
