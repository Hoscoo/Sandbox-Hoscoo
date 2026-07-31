import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireSandboxApiKey } from "@/lib/sandbox/auth";
import { validatePaymentRequest } from "@/lib/validation";
import { isCrossNetwork, CHANNEL_RAILS } from "@/lib/providers";
import { assertMarketLive, selectRoute, MarketNotLiveError, type Rail, type RailHealth } from "@/lib/corridors";
import { resolveTipsAlias } from "@/lib/tips";
import { resolveSimulationOutcome } from "@/lib/sandbox/simulation";
import { ensureTenant } from "@/lib/sandbox/ledger";
import { settleAndProgress } from "@/lib/sandbox/progression";
import { putSandboxTransaction, getSandboxTransaction, type SandboxTransaction } from "@/lib/sandbox/transactions";
import { emitEvent, LIFECYCLE_EVENT_NAMES } from "@/lib/sandbox/webhooks";
import { HoscooApiError, errorEnvelope, type ErrorCode } from "@/lib/errors";
import type { LifecycleState } from "@/lib/lifecycle";
import type { PaymentInstruction } from "@/lib/validation";

function allHealthy(rails: Rail[]): Record<Rail, RailHealth> {
  return Object.fromEntries(rails.map((r) => [r, "HEALTHY" as RailHealth])) as Record<Rail, RailHealth>;
}

/**
 * Sandbox mirror of app/api/initiate-payment, sharing validation, market
 * gating, provider resolution, and routing with production — the only
 * sandbox-specific pieces are the simulation outcome lookup and the ledger
 * posting against the deterministic mock ledger instead of a real rail.
 *
 * Actual settlement (debit/credit, cross-border postings, ROUTING/SETTLING
 * event emission) happens in lib/sandbox/progression.ts's
 * settleAndProgress() — never inline here — so this route and
 * app/api/v1/sandbox/payments/challenge/route.ts (which resumes a
 * transaction after a 3-DS challenge) can never settle a transaction two
 * different ways.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    const body = await req.json();

    const result = validatePaymentRequest(body);
    if (!result.ok) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "Request failed validation", { errors: result.errors }), { status: 400 });
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
      return NextResponse.json(errorEnvelope("SAME_PROVIDER_ON_US", "Same-provider wallet transfers are on-us book transfers, not a routed instruction"), { status: 422 });
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

    await ensureTenant(apiKey);
    const now = new Date();
    const transactionId = `hsc_sbx_tx_${randomUUID()}`;

    const outcome = resolveSimulationOutcome({
      apiKey,
      accountIdentifier: instruction.destination.identifier,
      sourceIdentifier: instruction.source.identifier,
      destinationIdentifier: instruction.destination.identifier,
      quoteId: instruction.quoteId,
      headerDirective: req.headers.get("x-hoscoo-simulate"),
      now,
    });

    const persist = (state: LifecycleState, opts: { rail?: Rail | null; reasonCode?: ErrorCode; requiresAction?: boolean }): SandboxTransaction => {
      const tx: SandboxTransaction = {
        transactionId,
        apiKey,
        instruction,
        state,
        reasonCode: opts.reasonCode,
        rail: opts.rail ?? null,
        quoteId: instruction.quoteId,
        requiresAction: opts.requiresAction,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      putSandboxTransaction(tx);
      return tx;
    };

    const persistAndEmit = (state: LifecycleState, opts: { rail?: Rail | null; reasonCode?: ErrorCode; requiresAction?: boolean }): SandboxTransaction => {
      const tx = persist(state, opts);
      const eventType = LIFECYCLE_EVENT_NAMES[state];
      if (eventType) {
        emitEvent(
          apiKey,
          transactionId,
          eventType,
          {
            transactionId,
            status: state,
            rail: tx.rail,
            reasonCode: tx.reasonCode,
            channel: instruction.channel,
            amountMinor: instruction.amountMinor.toString(),
            currency: instruction.currency,
            destinationIdentifier: instruction.destination.identifier,
          },
          now,
        );
      }
      return tx;
    };

    const toResponse = (tx: SandboxTransaction, status: number) =>
      NextResponse.json({ transactionId: tx.transactionId, status: tx.state, rail: tx.rail, reasonCode: tx.reasonCode, requiresAction: tx.requiresAction ?? false }, { status });

    // Pre-authorization rejections: the instruction never reaches AUTHORIZED, so no settlement, no AUTHORIZED event.
    if (outcome?.kind === "RAIL_UNAVAILABLE") {
      return toResponse(persistAndEmit("FAILED", { reasonCode: "RAIL_UNAVAILABLE" }), 503);
    }
    if (outcome?.kind === "QUOTE_EXPIRED_MID_FLIGHT") {
      return NextResponse.json(errorEnvelope("QUOTE_EXPIRED", "The FX quote expired before execution"), { status: 422 });
    }
    if (outcome?.kind === "ADVERSE_RATE_MOVEMENT") {
      return NextResponse.json(errorEnvelope("RATE_MOVED", "Rate moved against the customer between quote and execution"), { status: 422 });
    }
    if (outcome?.kind === "CORRIDOR_LIQUIDITY_EXHAUSTED") {
      return NextResponse.json(errorEnvelope("CORRIDOR_LIQUIDITY_EXHAUSTED", "Corridor settlement window liquidity is exhausted"), { status: 422 });
    }
    if (outcome?.kind === "OUTSIDE_CUTOFF") {
      return NextResponse.json(errorEnvelope("OUTSIDE_CUTOFF", "Request arrived after the corridor's daily cut-off"), { status: 422 });
    }
    if (!decision.selected) {
      return toResponse(persistAndEmit("FAILED", { reasonCode: "RAIL_UNAVAILABLE" }), 503);
    }

    // A pending 3-DS challenge: AUTHORIZED, no settlement yet. Resolved later
    // via app/api/v1/sandbox/payments/challenge/route.ts, which is the only
    // other caller of settleAndProgress.
    if (outcome?.kind === "THREE_DS_CHALLENGE") {
      return toResponse(persistAndEmit("AUTHORIZED", { rail: decision.selected.rail, requiresAction: true }), 200);
    }
    if (outcome?.kind === "THREE_DS_FAILURE") {
      return toResponse(persistAndEmit("FAILED", { reasonCode: "THREE_DS_CHALLENGE_FAILED" }), 402);
    }

    // A simulated pre-settlement failure/expiry (e.g. the insufficient-funds
    // or timeout magic MSISDNs): the whole point of these fixtures is that
    // NO money moves, so this must short-circuit before settleAndProgress,
    // not after it — settling first and overriding the reported status
    // afterward would leave the ledger showing a successful transfer for a
    // magic value whose entire purpose is to simulate a failure.
    if (outcome?.kind === "LIFECYCLE_STATE" && (outcome.state === "FAILED" || outcome.state === "EXPIRED")) {
      return toResponse(persistAndEmit(outcome.state, { rail: decision.selected.rail, reasonCode: outcome.reasonCode }), outcome.state === "FAILED" ? 402 : 410);
    }

    persistAndEmit("AUTHORIZED", { rail: decision.selected.rail });

    const settlement = await settleAndProgress({
      apiKey,
      transactionId,
      instruction: instruction as PaymentInstruction,
      rail: decision.selected.rail,
      now,
      forcedDebitOnlyFailure: outcome?.kind === "DEBIT_SUCCEEDED_CREDIT_FAILED" ? "DEBIT_SUCCEEDED_CREDIT_FAILED" : undefined,
    });

    // settleAndProgress already emitted the terminal event — persist only, never re-emit.
    const finalTx = persist(settlement.state, { rail: decision.selected.rail, reasonCode: settlement.reasonCode });
    return toResponse(finalTx, settlement.state === "COMPLETED" ? 201 : 402);
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error initiating sandbox payment"), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    requireSandboxApiKey(req);
    const transactionId = req.nextUrl.searchParams.get("transactionId");
    const tx = transactionId ? getSandboxTransaction(transactionId) : undefined;
    if (!tx) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", `No sandbox transaction found for ${transactionId}`), { status: 404 });
    }
    return NextResponse.json({
      transactionId: tx.transactionId,
      status: tx.state,
      rail: tx.rail,
      reasonCode: tx.reasonCode,
      requiresAction: tx.requiresAction ?? false,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    });
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error fetching sandbox transaction"), { status: 500 });
  }
}
