/**
 * useGame — state machine hook for AI mode game flow (mobile).
 *
 * Phases: loading → playing → revealing → round_end → match_end
 * (+ character_select inserted before loading on first start)
 *
 * Same logic as the web version but uses async SecureStore for tokens.
 * The lobby/difficulty selection is on the home screen (index.tsx),
 * and the game screen receives the difficulty as a route param.
 *
 * The countdown is now an inline selection timer on GameBoard (not a phase).
 * playAction submits the action and transitions directly to the result phase.
 */

import { useState, useCallback, useRef } from "react";
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
import { getRandomCharacterExcluding } from "@/lib/characters";

export type GamePhase =
  | "character_select"
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
  playerCharacterId: string | null;
  aiCharacterId: string | null;
  error: string | null;
  /** Call this first with the difficulty, transitions to character_select */
  initGame: (difficulty: Difficulty) => void;
  /** Call after character is picked, creates the actual game */
  startGame: (characterId: string) => Promise<void>;
  playAction: (action: Action) => Promise<void>;
  continueFromReveal: () => void;
  continueFromRound: () => void;
}

export function useGame(): UseGameReturn {
  const [phase, setPhase] = useState<GamePhase>("character_select");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnResult | null>(null);
  const [lastRound, setLastRound] = useState<RoundResult | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [playerName, setPlayerName] = useState("You");
  const [playerCharacterId, setPlayerCharacterId] = useState<string | null>(null);
  const [aiCharacterId, setAiCharacterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store difficulty between character_select and startGame
  const difficultyRef = useRef<Difficulty>("easy");

  /** Store difficulty and transition to character select */
  const initGame = useCallback((difficulty: Difficulty) => {
    difficultyRef.current = difficulty;
    setPhase("character_select");
  }, []);

  /** Pick character, assign AI opponent, create game via API */
  const startGame = useCallback(async (characterId: string) => {
    try {
      setError(null);
      setPhase("loading");

      // Set characters
      setPlayerCharacterId(characterId);
      const aiChar = getRandomCharacterExcluding(characterId);
      setAiCharacterId(aiChar.id);

      await ensureAuth();
      const name = await getDisplayName();
      if (name) setPlayerName(name);

      const state = await createAIGame(difficultyRef.current);
      setGameState(state);
      setLastTurn(null);
      setLastRound(null);
      setMatchResult(null);
      setPhase("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start game");
    }
  }, []);

  /** Submit action and transition directly to result phase */
  const playAction = useCallback(
    async (action: Action) => {
      if (!gameState) return;

      try {
        setError(null);
        setPhase("loading");

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
        setPhase("playing");
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
    playerCharacterId,
    aiCharacterId,
    error,
    initGame,
    startGame,
    playAction,
    continueFromReveal,
    continueFromRound,
  };
}
