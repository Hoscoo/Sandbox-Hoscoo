import { NextRequest, NextResponse } from "next/server";
import { requireProductionApiKey } from "@/lib/auth";
import { registerWebhookEndpoint, getWebhookEndpoint } from "@/lib/webhooks";
import { errorEnvelope, HoscooApiError } from "@/lib/errors";

/** Registers this merchant's production webhook delivery URL. */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireProductionApiKey(req);
    const body = (await req.json()) as { url?: string };
    if (!body.url || !/^https:\/\//.test(body.url)) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "url must be an https:// URL"), { status: 400 });
    }
    registerWebhookEndpoint(apiKey, body.url);
    return NextResponse.json({ registered: true, url: body.url });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error registering webhook endpoint"), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = requireProductionApiKey(req);
    return NextResponse.json({ url: getWebhookEndpoint(apiKey) ?? null });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error fetching webhook endpoint"), { status: 500 });
  }
}
