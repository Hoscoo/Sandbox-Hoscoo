import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SPEC_PATH = join(process.cwd(), "openapi", "generated", "v1.json");

/**
 * Serves the CI-checked, committed generated spec verbatim — never a
 * live re-generation — so what's served is exactly what passed the drift
 * check (see scripts/check-openapi-drift.ts).
 */
export async function GET() {
  const spec = readFileSync(SPEC_PATH, "utf-8");
  return new NextResponse(spec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
