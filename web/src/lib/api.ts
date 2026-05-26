/**
 * API client for Ki Clash backend.
 *
 * Handles all HTTP communication with the FastAPI server.
 * Stores JWT tokens in localStorage for persistence across page reloads.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  elo_rating: number;
  ranked_wins: number;
  ranked_losses: number;
  ad_free: boolean;
  created_at: string;
}

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

export interface CheckoutResponse {
  session_id: string;
  checkout_url: string;
}

// --- Token management ---

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ki_clash_token");
}

function setTokens(access: string, refresh: string): void {
  localStorage.setItem("ki_clash_token", access);
  localStorage.setItem("ki_clash_refresh", refresh);
}

export function getPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ki_clash_player_id");
}

export function getDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ki_clash_display_name");
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

export function logout(): void {
  localStorage.removeItem("ki_clash_token");
  localStorage.removeItem("ki_clash_refresh");
  localStorage.removeItem("ki_clash_player_id");
  localStorage.removeItem("ki_clash_display_name");
}

// --- HTTP helpers ---

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  return apiFetchInternal<T>(path, options, /* allowAuthRetry */ true);
}

async function apiFetchInternal<T>(
  path: string,
  options: RequestInit,
  allowAuthRetry: boolean,
): Promise<T> {
  const token = getToken();
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

  // Auto-heal expired/stale tokens. The guest endpoint never returns 401,
  // so this can't loop. Skip for the guest endpoint itself.
  if (
    res.status === 401
    && allowAuthRetry
    && path !== "/api/v1/auth/guest"
  ) {
    logout();
    await createGuestSession();
    return apiFetchInternal<T>(path, options, /* allowAuthRetry */ false);
  }

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
  setTokens(data.access_token, data.refresh_token);
  localStorage.setItem("ki_clash_player_id", data.player_id);
  localStorage.setItem("ki_clash_display_name", data.display_name);
  return data;
}

export async function ensureAuth(): Promise<void> {
  if (!isLoggedIn()) {
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

/** Match summary returned by match history endpoint */
export interface MatchSummary {
  id: string;
  match_type: string;
  status: MatchStatus;
  opponent_name: string | null;
  rounds_won_p1: number;
  rounds_won_p2: number;
  winner: RoundWinner | null;
  total_turns: number;
  created_at: string;
}

export async function getMatchHistory(): Promise<MatchSummary[]> {
  return apiFetch<MatchSummary[]>("/api/v1/players/me/matches");
}

// --- Ranked ---

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

export async function createAdFreeCheckout(
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>("/api/v1/purchases/checkout/ad-free", {
    method: "POST",
    body: JSON.stringify({ success_url: successUrl, cancel_url: cancelUrl }),
  });
}
