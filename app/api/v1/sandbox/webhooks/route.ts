import { NextRequest, NextResponse } from "next/server";
import { requireSandboxApiKey } from "@/lib/sandbox/auth";
import { registerWebhookEndpoint, getWebhookEndpoint } from "@/lib/sandbox/webhooks";
import { errorEnvelope, HoscooApiError } from "@/lib/errors";

// Real webhook URLs must be https:// — plaintext http delivery of payment
// events is not something to ever allow. The one narrow exception is
// http://localhost / http://127.0.0.1, which never occurs in a real
// deployment (see proxy.ts's identical local-dev exception) and is what
// makes the sandbox console's local echo receiver — the only way to
// self-test the whole webhook flow without standing up an external URL —
// actually usable in local dev.
function isAllowedWebhookUrl(url: string): boolean {
  if (/^https:\/\//.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

/** Registers this tenant's webhook delivery URL. */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    const body = (await req.json()) as { url?: string };
    if (!body.url || !isAllowedWebhookUrl(body.url)) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "url must be an https:// URL (or http://localhost in local dev)"), { status: 400 });
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
    const apiKey = requireSandboxApiKey(req);
    return NextResponse.json({ url: getWebhookEndpoint(apiKey) ?? null });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error fetching webhook endpoint"), { status: 500 });
  }
}
