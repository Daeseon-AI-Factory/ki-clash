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
} from "@/lib/api";
import { getRandomCharacterExcluding } from "@/lib/characters";

/**
 * Game flow states:
 * - lobby: choosing difficulty
 * - character_select: picking a fighter
 * - loading: creating game / waiting for API
 * - playing: in a match, selecting actions (countdown timer ticks here)
 * - revealing: showing turn result animation
 * - round_end: showing round result
 * - match_end: showing final match result
 */
export type GamePhase =
  | "lobby"
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
  selectDifficulty: (difficulty: Difficulty) => void;
  startGame: (characterId: string) => Promise<void>;
  playAction: (action: Action) => Promise<void>;
  continueFromReveal: () => void;
  continueFromRound: () => void;
  backToLobby: () => void;
}

/**
 * Custom hook managing the entire game lifecycle.
 *
 * Flow: lobby → character_select → loading → playing → revealing → ...
 *
 * selectDifficulty stores the chosen difficulty and transitions to character_select.
 * startGame(characterId) uses the stored difficulty, picks a random AI character,
 * then creates the game via API.
 */
export function useGame(): UseGameReturn {
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnResult | null>(null);
  const [lastRound, setLastRound] = useState<RoundResult | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [playerName, setPlayerName] = useState("Player");
  const [playerCharacterId, setPlayerCharacterId] = useState<string | null>(null);
  const [aiCharacterId, setAiCharacterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store difficulty between character_select and startGame
  const difficultyRef = useRef<Difficulty>("easy");

  /** Step 1: Store difficulty, move to character select */
  const selectDifficulty = useCallback((difficulty: Difficulty) => {
    difficultyRef.current = difficulty;
    setPhase("character_select");
  }, []);

  /** Step 2: Pick character, assign AI opponent, create game */
  const startGame = useCallback(async (characterId: string) => {
    try {
      setError(null);
      setPhase("loading");

      // Set characters
      setPlayerCharacterId(characterId);
      const aiChar = getRandomCharacterExcluding(characterId);
      setAiCharacterId(aiChar.id);

      await ensureAuth();
      setPlayerName(getDisplayName() || "Player");

      const state = await createAIGame(difficultyRef.current);
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

  /** Submit action and transition directly to result phase */
  const playAction = useCallback(
    async (action: Action) => {
      if (!gameState) return;

      try {
        setError(null);
        setPhase("loading");

        const response = await submitAction(gameState.game_id, action);

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
    setPlayerCharacterId(null);
    setAiCharacterId(null);
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
    playerCharacterId,
    aiCharacterId,
    error,
    selectDifficulty,
    startGame,
    playAction,
    continueFromReveal,
    continueFromRound,
    backToLobby,
  };
}
