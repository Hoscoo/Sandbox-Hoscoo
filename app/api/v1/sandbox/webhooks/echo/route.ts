import { NextRequest, NextResponse } from "next/server";

/**
 * Local self-test webhook receiver — lets the sandbox console demonstrate
 * end-to-end delivery (register -> emit -> dispatch -> land here -> show up
 * in the delivery log) without needing a real external URL. Not part of the
 * public API surface; not in the OpenAPI spec.
 */
const RECEIVED: Array<{ receivedAt: string; eventId: string | null; eventType: string | null; isReplay: string | null }> = [];

export async function POST(req: NextRequest) {
  RECEIVED.unshift({
    receivedAt: new Date().toISOString(),
    eventId: req.headers.get("x-hoscoo-event-id"),
    eventType: req.headers.get("x-hoscoo-event-type"),
    isReplay: req.headers.get("x-hoscoo-replay"),
  });
  if (RECEIVED.length > 50) RECEIVED.length = 50;
  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ received: RECEIVED });
}
