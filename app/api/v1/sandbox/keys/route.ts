import { NextRequest, NextResponse } from "next/server";
import { issueSandboxApiKey } from "@/lib/sandbox/keys";
import { errorEnvelope } from "@/lib/errors";

/**
 * Issues a fresh, cryptographically random hsc_test_ key. No auth required —
 * this is the bootstrap endpoint; you can't have a key to authenticate with
 * yet. Not required to use the sandbox (any hsc_test_-prefixed string works,
 * auto-registering on first use — see lib/sandbox/keys.ts) but recommended
 * over hand-typing one.
 */
export async function POST(req: NextRequest) {
  let label: string | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { label?: string };
    label = body.label;
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "Request body must be valid JSON"), { status: 400 });
  }

  const record = issueSandboxApiKey(label);
  return NextResponse.json({ key: record.key, label: record.label, createdAt: record.createdAt }, { status: 201 });
}
