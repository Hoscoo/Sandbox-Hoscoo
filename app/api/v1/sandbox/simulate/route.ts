import { NextRequest, NextResponse } from "next/server";
import { requireSandboxApiKey } from "@/lib/sandbox/auth";
import { registerRule, listRules, clearRules, type RuleScope, type SimulationOutcome } from "@/lib/sandbox/simulation";
import { HoscooApiError, errorEnvelope } from "@/lib/errors";

interface RegisterRuleBody {
  scope: RuleScope;
  outcome: SimulationOutcome;
}

function isRuleScope(value: unknown): value is RuleScope {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as Record<string, unknown>).type;
  return type === "NEXT_CALL" || type === "PER_ACCOUNT" || type === "PER_KEY" || type === "TIME_BOXED";
}

/** Registers a programmable simulation rule, scoped to the calling API key. */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    const body = (await req.json()) as Partial<RegisterRuleBody>;

    if (!isRuleScope(body.scope) || typeof body.outcome !== "object" || body.outcome === null) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "Request must include `scope` and `outcome`"), { status: 400 });
    }

    const rule = registerRule(apiKey, body.scope, body.outcome as SimulationOutcome);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error registering rule"), { status: 500 });
  }
}

/** Lists this tenant's active simulation rules. */
export async function GET(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    return NextResponse.json({ rules: listRules(apiKey) });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error listing rules"), { status: 500 });
  }
}

/** Clears all of this tenant's simulation rules. */
export async function DELETE(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    clearRules(apiKey);
    return NextResponse.json({ cleared: true });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error clearing rules"), { status: 500 });
  }
}
