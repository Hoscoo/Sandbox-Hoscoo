import { NextRequest, NextResponse } from "next/server";
import { requireSandboxApiKey } from "@/lib/sandbox/auth";
import { listDeliveryLog, getEvent } from "@/lib/sandbox/webhooks";
import { maskMsisdn } from "@/lib/mask";
import { errorEnvelope, HoscooApiError } from "@/lib/errors";

const MSISDN_PATTERN = /^\+\d{9,15}$/;

/** Masks any MSISDN-shaped string anywhere in a payload before it reaches the inspector display. */
function maskPayload(value: unknown): unknown {
  if (typeof value === "string") return MSISDN_PATTERN.test(value) ? maskMsisdn(value) : value;
  if (Array.isArray(value)) return value.map(maskPayload);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, maskPayload(v)]));
  }
  return value;
}

/** Webhook delivery inspector: attempt history with MSISDNs masked in every payload preview. */
export async function GET(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    const logs = listDeliveryLog(apiKey).map((entry) => {
      const event = getEvent(entry.eventId);
      return {
        ...entry,
        eventType: event?.type ?? null,
        payloadPreview: event ? maskPayload(event.payload) : null,
      };
    });
    return NextResponse.json({ logs });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error fetching delivery log"), { status: 500 });
  }
}
