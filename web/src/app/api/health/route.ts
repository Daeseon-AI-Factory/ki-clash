import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "jjan-web",
    timestamp: new Date().toISOString(),
  });
}
