import { NextResponse } from "next/server";

const MAX_BODY_BYTES = 16_384;

type AnalyticsBody = {
  event?: unknown;
  properties?: unknown;
  session_id?: unknown;
  player_id?: unknown;
  path?: unknown;
  referrer?: unknown;
  timestamp?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, 300) : fallback;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  let body: AnalyticsBody;
  try {
    body = JSON.parse(raw) as AnalyticsBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const event = asString(body.event);
  if (!event || !/^[a-z0-9_:-]{2,80}$/.test(event)) {
    return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
  const userAgent = request.headers.get("user-agent") ?? "";

  const payload = {
    event,
    properties: asRecord(body.properties),
    session_id: asString(body.session_id),
    player_id: asString(body.player_id),
    path: asString(body.path),
    referrer: asString(body.referrer),
    timestamp: asString(body.timestamp),
    ip_hash_source: ip ? "present" : "missing",
    user_agent: userAgent.slice(0, 180),
  };

  // First production step: make launch analytics observable in server logs.
  // This is intentionally a single line so it can be shipped into CloudWatch,
  // Vercel logs, or any later log drain without changing the client API.
  console.info("jjan_analytics_event", JSON.stringify(payload));

  return NextResponse.json({ ok: true });
}
