import { NextRequest, NextResponse } from "next/server";
import { requireSandboxApiKey } from "@/lib/sandbox/auth";
import { quoteSandboxFx } from "@/lib/sandbox/ledger";
import { putQuote, getQuote } from "@/lib/sandbox/quotes";
import { emitEvent, CROSS_BORDER_EVENT_NAMES } from "@/lib/sandbox/webhooks";
import { CORRIDORS, assertMarketLive, MarketNotLiveError } from "@/lib/corridors";
import { HoscooApiError, errorEnvelope } from "@/lib/errors";

/** Issues a deterministic sandbox FX quote for a corridor. */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    const body = (await req.json()) as { corridorId?: string; amountMinor?: string; adverse?: boolean };

    const corridor = CORRIDORS.find((c) => c.id === body.corridorId);
    if (!corridor) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", `Unknown corridorId: ${body.corridorId}`), { status: 400 });
    }
    if (!body.amountMinor || !/^[1-9][0-9]*$/.test(body.amountMinor)) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "amountMinor must be a positive integer string"), { status: 400 });
    }

    try {
      assertMarketLive(corridor.from);
    } catch (e) {
      if (e instanceof MarketNotLiveError) {
        return NextResponse.json(errorEnvelope("MARKET_NOT_LIVE", e.message), { status: 422 });
      }
      throw e;
    }

    const quote = quoteSandboxFx({ corridorId: corridor.id, amountMinor: BigInt(body.amountMinor), now: new Date(), adverse: body.adverse === true });
    putQuote(quote);

    emitEvent(apiKey, quote.quoteId, CROSS_BORDER_EVENT_NAMES.QUOTE_ISSUED, {
      quoteId: quote.quoteId,
      corridorId: quote.corridorId,
      fromCurrency: quote.fromCurrency,
      toCurrency: quote.toCurrency,
      amountMinor: quote.amountMinor.toString(),
      creditedMinor: quote.creditedMinor.toString(),
      expiresAt: quote.expiresAt,
    });

    return NextResponse.json({
      ...quote,
      amountMinor: quote.amountMinor.toString(),
      midRateNumerator: quote.midRateNumerator.toString(),
      midRateDenominator: quote.midRateDenominator.toString(),
      creditedMinor: quote.creditedMinor.toString(),
    });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error issuing quote"), { status: 500 });
  }
}

/** Refreshes (re-fetches) a previously issued quote by id — read-only, does not mutate it. */
export async function GET(req: NextRequest) {
  try {
    requireSandboxApiKey(req);
    const quoteId = req.nextUrl.searchParams.get("quoteId");
    const quote = quoteId ? getQuote(quoteId) : undefined;
    if (!quote) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", `No quote found for ${quoteId}`), { status: 404 });
    }
    return NextResponse.json({
      ...quote,
      amountMinor: quote.amountMinor.toString(),
      midRateNumerator: quote.midRateNumerator.toString(),
      midRateDenominator: quote.midRateDenominator.toString(),
      creditedMinor: quote.creditedMinor.toString(),
    });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error fetching quote"), { status: 500 });
  }
}
