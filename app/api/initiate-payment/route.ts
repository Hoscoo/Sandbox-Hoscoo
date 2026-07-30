import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { validatePaymentRequest } from "@/lib/validation";
import { isCrossNetwork, CHANNEL_RAILS } from "@/lib/providers";
import { assertMarketLive, selectRoute, MarketNotLiveError, type Rail, type RailHealth } from "@/lib/corridors";
import { resolveTipsAlias } from "@/lib/tips";
import { sign } from "@/lib/signature";
import { requireProductionApiKey } from "@/lib/auth";
import { HoscooApiError, errorEnvelope } from "@/lib/errors";
import { putTransaction, type Transaction } from "@/lib/transactions";

const SIGNING_SECRET = process.env.HOSCOO_SIGNING_SECRET ?? "hoscoo-local-dev-secret";

// No live rail-health feed wired yet; every rail is assumed HEALTHY at the
// eligibility gate until that integration lands.
function allHealthy(rails: Rail[]): Record<Rail, RailHealth> {
  return Object.fromEntries(rails.map((r) => [r, "HEALTHY" as RailHealth])) as Record<Rail, RailHealth>;
}

export async function POST(req: NextRequest) {
  let apiKey: string;
  try {
    apiKey = requireProductionApiKey(req);
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    throw e;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "Request body must be valid JSON"), { status: 400 });
  }

  const result = validatePaymentRequest(body);
  if (!result.ok) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_FAILED", "Request failed validation", { errors: result.errors }),
      { status: 400 },
    );
  }
  const instruction = result.value;

  try {
    assertMarketLive(instruction.market);
  } catch (e) {
    if (e instanceof MarketNotLiveError) {
      return NextResponse.json(errorEnvelope("MARKET_NOT_LIVE", e.message), { status: 422 });
    }
    throw e;
  }

  if (instruction.channel === "MNO_TO_MNO" && !isCrossNetwork(instruction.channel, instruction.source.providerCode, instruction.destination.providerCode)) {
    return NextResponse.json(
      errorEnvelope("SAME_PROVIDER_ON_US", "Same-provider wallet transfers are on-us book transfers, not a routed instruction"),
      { status: 422 },
    );
  }

  if (instruction.channel === "BANK_TO_BANK") {
    const alias = resolveTipsAlias(instruction.destination.identifier);
    if (!alias) {
      return NextResponse.json(errorEnvelope("ALIAS_UNMAPPED", "Destination alias not found in TIPS directory"), { status: 422 });
    }
  }

  const candidateRails = CHANNEL_RAILS[instruction.channel] ?? [];
  const decision = selectRoute({
    market: instruction.market,
    amountMinor: instruction.amountMinor,
    minAmountMinor: 1n,
    maxAmountMinor: 999_999_999_999n,
    candidateRails,
    railHealth: allHealthy(candidateRails),
  });

  if (!decision.selected) {
    return NextResponse.json(errorEnvelope("RAIL_UNAVAILABLE", "No eligible rail for this instruction"), { status: 503 });
  }

  const transactionId = `hsc_tx_${randomUUID()}`;
  const now = new Date().toISOString();
  const signature = sign(instruction, SIGNING_SECRET);

  const tx: Transaction = {
    transactionId,
    instruction,
    state: "PENDING_AUTHORIZATION",
    rail: decision.selected.rail,
    signature,
    createdAt: now,
    updatedAt: now,
  };
  putTransaction(tx);

  // No webhook event is emitted here, deliberately: lib/webhooks.ts's
  // dispatcher (mirroring the sandbox's) is real and tested, but
  // PENDING_AUTHORIZATION is the initial state — it has no incoming
  // transition in lib/lifecycle.ts, so LIFECYCLE_EVENT_NAMES has no entry
  // for it, so there is nothing to mechanically emit yet. Production has no
  // downstream process that actually drives a transaction through
  // AUTHORIZED -> ROUTING -> SETTLING -> COMPLETED (that requires a real
  // rail integration this repo does not have), so wiring emitEvent() here
  // for a state transition that never happens would violate the "no event
  // without a real occurrence" rule this whole webhook design rests on. The
  // first real call site will appear alongside whatever drives that
  // progression — see PARITY.md's Known Gaps.
  void apiKey;

  return NextResponse.json(
    {
      transactionId,
      status: tx.state,
      rail: tx.rail,
      signature: tx.signature,
      createdAt: tx.createdAt,
    },
    { status: 201 },
  );
}
