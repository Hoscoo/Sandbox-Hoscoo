import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SPEC_PATH = join(process.cwd(), "openapi", "generated", "v1.json");

/** Unversioned alias for the latest spec version — currently v1. */
export async function GET() {
  const spec = readFileSync(SPEC_PATH, "utf-8");
  return new NextResponse(spec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
