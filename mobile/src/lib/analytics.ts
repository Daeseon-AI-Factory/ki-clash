import * as SecureStore from "expo-secure-store";
import { getPlayerId } from "@/lib/api";

type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const WEB_BASE = process.env.EXPO_PUBLIC_WEB_URL || "https://jjan.daeseon.ai";
const SESSION_KEY = "jjan_analytics_session_id";

async function getSessionId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(SESSION_KEY);
  if (existing) return existing;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await SecureStore.setItemAsync(SESSION_KEY, id);
  return id;
}

export async function trackEvent(
  event: string,
  properties: AnalyticsProperties = {}
): Promise<void> {
  try {
    const [sessionId, playerId] = await Promise.all([
      getSessionId(),
      getPlayerId(),
    ]);

    await fetch(`${WEB_BASE}/api/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        properties: {
          ...properties,
          client: "mobile",
        },
        session_id: sessionId,
        player_id: playerId,
        path: "mobile",
        referrer: null,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Analytics must never block gameplay.
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
