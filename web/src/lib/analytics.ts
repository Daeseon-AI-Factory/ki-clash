"use client";

export type AnalyticsEventName =
  | "page_view"
  | "landing_view"
  | "promo_link_opened"
  | "promo_cta_clicked"
  | "promo_link_copied"
  | "return_next_day"
  | "difficulty_selected"
  | "play_start"
  | "action_submitted"
  | "match_finish"
  | "pvp_quick_match_started"
  | "pvp_room_created"
  | "pvp_room_joined"
  | "pvp_match_started"
  | "invite_copied"
  | "shop_view"
  | "founder_pass_checkout_started"
  | "founder_pass_checkout_failed"
  | "founder_pass_checkout_success";

type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const SESSION_KEY = "jjan_analytics_session_id";
const LAST_VISIT_KEY = "jjan_last_visit_date";
const CAMPAIGN_KEYS = [
  "promo",
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
] as const;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

function getPlayerId(): string | null {
  return localStorage.getItem("ki_clash_player_id");
}

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function currentCampaignProperties(): AnalyticsProperties {
  const params = new URLSearchParams(window.location.search);
  const values: AnalyticsProperties = {};

  for (const key of CAMPAIGN_KEYS) {
    const value = params.get(key);
    if (value) values[key] = value;
  }

  return values;
}

export function trackEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) {
  if (typeof window === "undefined") return;

  const payload = {
    event,
    properties: {
      ...currentCampaignProperties(),
      ...properties,
    },
    session_id: getSessionId(),
    player_id: getPlayerId(),
    path: currentPath(),
    referrer: document.referrer || null,
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      "/api/analytics/events",
      new Blob([body], { type: "application/json" }),
    );
    if (sent) return;
  }

  fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics must never break the game.
  });
}

export function trackDailyReturn() {
  if (typeof window === "undefined") return;

  const today = todayKey();
  const previous = localStorage.getItem(LAST_VISIT_KEY);
  if (previous && previous !== today) {
    trackEvent("return_next_day", { previous_visit_date: previous });
  }
  localStorage.setItem(LAST_VISIT_KEY, today);
}
