import { NextRequest, NextResponse } from "next/server";
import { requireSandboxApiKey } from "@/lib/sandbox/auth";
import { resetTenant, getWalletBalance } from "@/lib/sandbox/ledger";
import { CURRENCIES } from "@/lib/corridors";
import { HoscooApiError, errorEnvelope } from "@/lib/errors";

/** Documented reset endpoint: wipes this tenant's ledger and reseeds starting balances. */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    await resetTenant(apiKey);
    const balances = Object.fromEntries(
      await Promise.all(CURRENCIES.map(async (c) => [c, (await getWalletBalance(apiKey, c)).toString()])),
    );
    return NextResponse.json({ reset: true, balances });
  } catch (e) {
    if (e instanceof HoscooApiError) {
      return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    }
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error during reset"), { status: 500 });
  }
}
