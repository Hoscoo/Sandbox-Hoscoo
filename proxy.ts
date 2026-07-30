/**
 * Next.js 16 proxy (formerly middleware.ts). Runs the environment gate at the
 * edge, before any route handler executes, so a mismatched key/host pair is
 * rejected before it can reach ledger, routing, or signing code.
 *
 * LOCAL DEV EXCEPTION: `localhost`/`127.0.0.1` never occur in a real
 * deployment — only `api.hoscoo.com` and `sandbox-api.hoscoo.com` do, per
 * vercel.json's rewrites. Enforcing the hostname/prefix mismatch check
 * against a local dev server would make it impossible to exercise the
 * sandbox routes at all locally (there is no way to make `localhost` BE
 * `sandbox-api.hoscoo.com`), which defeats the entire purpose of a
 * sandbox anyone can develop against before touching live rails. So this
 * one narrow, hostname-literal exception skips the gate; lib/sandbox/
 * environment.ts's resolveEnvironment() itself is completely unchanged —
 * still strict, still what actually runs (and is tested) in every real
 * deployment. Each route handler's own requireSandboxApiKey/
 * requireProductionApiKey still independently enforces the correct key
 * prefix for whichever route you actually call, so nothing about the
 * mismatch protection is weakened for real traffic — only local dev
 * convenience is affected.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveEnvironment, EnvironmentMismatchError } from "@/lib/sandbox/environment";
import { errorEnvelope } from "@/lib/errors";

const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

function extractApiKey(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice("Bearer ".length);
  return req.headers.get("x-api-key");
}

export function proxy(req: NextRequest) {
  const hostname = req.nextUrl.hostname;
  const apiKey = extractApiKey(req);

  if (LOCAL_DEV_HOSTS.has(hostname)) {
    return NextResponse.next();
  }

  try {
    const resolution = resolveEnvironment({ hostname, apiKey });
    const res = NextResponse.next();
    res.headers.set("x-hoscoo-environment", resolution.environment);
    res.headers.set("x-hoscoo-widget-mode", resolution.widgetMode);
    return res;
  } catch (e) {
    if (e instanceof EnvironmentMismatchError) {
      return NextResponse.json(errorEnvelope("ENVIRONMENT_MISMATCH", e.message), { status: 400 });
    }
    throw e;
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
