import { NextRequest, NextResponse } from "next/server";
import { requireSandboxApiKey } from "@/lib/sandbox/auth";
// Deliberately does NOT import anything from lib/sandbox/ledger.ts,
// lib/sandbox/simulation.ts, or corridors.ts's quoteFx — see
// lib/sandbox/webhooks.ts's replayDelivery() doc comment and
// lib/sandbox/__tests__/replay-isolation.test.ts, which fails the build if
// such an import is ever added to this file.
import { replayDelivery, ReplayNotFoundError, ReplayRateLimitedError } from "@/lib/sandbox/webhooks";
import { errorEnvelope, HoscooApiError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    const body = (await req.json()) as { eventId?: string };
    if (!body.eventId) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "eventId is required"), { status: 400 });
    }

    const delivery = replayDelivery(apiKey, body.eventId);
    return NextResponse.json({ queued: true, deliveryId: delivery.id, eventId: delivery.eventId }, { status: 202 });
  } catch (e) {
    if (e instanceof ReplayRateLimitedError) {
      return NextResponse.json(errorEnvelope("RATE_LIMITED", e.message), { status: 429 });
    }
    if (e instanceof ReplayNotFoundError) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", e.message), { status: 404 });
    }
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error replaying delivery"), { status: 500 });
  }
}
