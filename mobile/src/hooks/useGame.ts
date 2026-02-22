/**
 * useGame — state machine hook for AI mode game flow (mobile).
 *
 * Phases: lobby → loading → playing → revealing → round_end → match_end
 *
 * Same logic as the web version but uses async SecureStore for tokens.
 * The lobby/difficulty selection is on the home screen (index.tsx),
 * and the game screen receives the difficulty as a route param.
 */

import { useState, useCallback } from "react";
import {
  ensureAuth,
  createAIGame,
  submitAction as apiSubmitAction,
  getDisplayName,
  type Action,
  type Difficulty,
  type GameState,
  type TurnResult,
  type RoundResult,
  type MatchResult,
} from "@/lib/api";

export type GamePhase =
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
}

export function useGame(): UseGameReturn {
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnResult | null>(null);
  const [lastRound, setLastRound] = useState<RoundResult | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [playerName, setPlayerName] = useState("You");
  const [error, setError] = useState<string | null>(null);

  const startGame = useCallback(async (difficulty: Difficulty) => {
    try {
      setError(null);
      setPhase("loading");

      await ensureAuth();
      const name = await getDisplayName();
      if (name) setPlayerName(name);

      const state = await createAIGame(difficulty);
      setGameState(state);
      setLastTurn(null);
      setLastRound(null);
      setMatchResult(null);
      setPhase("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start game");
    }
  }, []);

  const playAction = useCallback(
    async (action: Action) => {
      if (!gameState) return;

      try {
        setError(null);
        const res = await apiSubmitAction(gameState.game_id, action);

        setGameState(res.game_state);
        setLastTurn(res.turn_result);

        if (res.match_result) {
          setMatchResult(res.match_result);
          setLastRound(res.round_result);
          setPhase("match_end");
        } else if (res.round_result) {
          setLastRound(res.round_result);
          setPhase("round_end");
        } else {
          setPhase("revealing");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit action");
      }
    },
    [gameState]
  );

  const continueFromReveal = useCallback(() => {
    setLastTurn(null);
    setPhase("playing");
  }, []);

  const continueFromRound = useCallback(() => {
    setLastTurn(null);
    setLastRound(null);
    setPhase("playing");
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
  };
}
