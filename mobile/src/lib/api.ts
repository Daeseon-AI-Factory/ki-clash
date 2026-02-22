/**
 * API client for Ki Clash backend (React Native).
 *
 * Same types and API methods as web, but uses expo-secure-store
 * instead of localStorage for secure token storage on device.
 */

import * as SecureStore from "expo-secure-store";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

// --- Types matching backend schemas ---

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  player_id: string;
  display_name: string;
}

export type Action =
  | "charge"
  | "block"
  | "attack"
  | "energy_wave"
  | "teleport";

export type Difficulty = "easy" | "medium" | "hard";

export type TurnOutcome =
  | "p1_wins_round"
  | "p2_wins_round"
  | "clash"
  | "blocked"
  | "dodged"
  | "neutral";

export type RoundWinner = "p1" | "p2" | "draw";

export type MatchStatus = "in_progress" | "completed" | "abandoned";

export interface TurnResult {
  turn_number: number;
  p1_action: Action;
  p2_action: Action;
  outcome: TurnOutcome;
  p1_ki_after: number;
  p2_ki_after: number;
}

export interface RoundResult {
  round_number: number;
  winner: RoundWinner;
  total_turns: number;
}

export interface MatchResult {
  winner: RoundWinner;
  rounds_won_p1: number;
  rounds_won_p2: number;
  total_turns: number;
}

export interface RoundState {
  round_number: number;
  p1_ki: number;
  p2_ki: number;
  turn_number: number;
  turn_history: TurnResult[];
}

export interface GameState {
  game_id: string;
  match_type: string;
  status: MatchStatus;
  rounds_won_p1: number;
  rounds_won_p2: number;
  current_round: RoundState | null;
  round_results: RoundResult[];
}

export interface SubmitActionResponse {
  turn_result: TurnResult;
  round_result: RoundResult | null;
  match_result: MatchResult | null;
  game_state: GameState;
}

export interface PlayerProfile {
  id: string;
  display_name: string;
  email: string | null;
  wins: number;
  losses: number;
  draws: number;
  created_at: string;
}

// --- Secure token management (expo-secure-store) ---

const KEYS = {
  token: "ki_clash_token",
  refresh: "ki_clash_refresh",
  playerId: "ki_clash_player_id",
  displayName: "ki_clash_display_name",
} as const;

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.token);
}

async function setTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.token, access);
  await SecureStore.setItemAsync(KEYS.refresh, refresh);
}

export async function getPlayerId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.playerId);
}

export async function getDisplayName(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.displayName);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.token);
  await SecureStore.deleteItemAsync(KEYS.refresh);
  await SecureStore.deleteItemAsync(KEYS.playerId);
  await SecureStore.deleteItemAsync(KEYS.displayName);
}

// --- HTTP helpers ---

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `API error: ${res.status}`);
  }

  return res.json();
}

// --- API methods ---

export async function createGuestSession(): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/api/v1/auth/guest", {
    method: "POST",
  });
  await setTokens(data.access_token, data.refresh_token);
  await SecureStore.setItemAsync(KEYS.playerId, data.player_id);
  await SecureStore.setItemAsync(KEYS.displayName, data.display_name);
  return data;
}

export async function ensureAuth(): Promise<void> {
  if (!(await isLoggedIn())) {
    await createGuestSession();
  }
}

export async function createAIGame(
  difficulty: Difficulty
): Promise<GameState> {
  return apiFetch<GameState>("/api/v1/games/ai", {
    method: "POST",
    body: JSON.stringify({ difficulty }),
  });
}

export async function getGameState(gameId: string): Promise<GameState> {
  return apiFetch<GameState>(`/api/v1/games/${gameId}`);
}

export async function submitAction(
  gameId: string,
  action: Action
): Promise<SubmitActionResponse> {
  return apiFetch<SubmitActionResponse>(`/api/v1/games/${gameId}/action`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function getMyProfile(): Promise<PlayerProfile> {
  return apiFetch<PlayerProfile>("/api/v1/players/me");
}

export interface MatchSummary {
  id: string;
  match_type: string;
  winner: string | null;
  rounds_won_p1: number;
  rounds_won_p2: number;
  total_turns: number;
  opponent_name: string | null;
  created_at: string;
}

export async function getMatchHistory(): Promise<MatchSummary[]> {
  return apiFetch<MatchSummary[]>("/api/v1/players/me/matches");
}

// --- Ranked ---

export interface LeaderboardEntry {
  rank: number;
  player_id: string;
  display_name: string;
  elo_rating: number;
  ranked_wins: number;
  ranked_losses: number;
}

export interface PlayerRank {
  rank: number;
  player_id: string;
  display_name: string;
  elo_rating: number;
  ranked_wins: number;
  ranked_losses: number;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>(`/api/v1/ranked/leaderboard?limit=${limit}`);
}

export async function getMyRank(): Promise<PlayerRank | null> {
  return apiFetch<PlayerRank | null>("/api/v1/ranked/me");
}

// --- Purchases ---

export async function getAdFreeStatus(): Promise<{ ad_free: boolean }> {
  return apiFetch<{ ad_free: boolean }>("/api/v1/purchases/ad-free-status");
}
