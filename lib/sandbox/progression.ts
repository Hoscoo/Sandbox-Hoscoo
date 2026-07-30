/**
 * Shared settlement/event-emission walk from AUTHORIZED through ROUTING and
 * SETTLING to a terminal state. This is the ONE place that actually moves
 * ledger funds and emits the mechanically-derived events for those states —
 * both the immediate-success path in app/api/v1/sandbox/payments/route.ts
 * and the challenge-resolution path in
 * app/api/v1/sandbox/payments/challenge/route.ts call this, so a
 * transaction can never reach COMPLETED by two different routes with two
 * different eventing or settlement behaviors.
 *
 * Every hop is checked against isValidTransition rather than assumed, so a
 * change to lib/lifecycle.ts's TRANSITIONS table that removed one of these
 * edges would fail loudly here instead of silently emitting an event for a
 * transition that no longer exists.
 */
import { isValidTransition, type LifecycleState } from "../lifecycle";
import { HoscooApiError, type ErrorCode } from "../errors";
import type { PaymentInstruction } from "../validation";
import type { Rail } from "../corridors";
import { railCost } from "../corridors";
import { getQuote, isQuoteExpired } from "./quotes";
import { debitWallet, creditWallet, postCrossBorderSettlement } from "./ledger";
import { emitEvent, LIFECYCLE_EVENT_NAMES, CROSS_BORDER_EVENT_NAMES } from "./webhooks";

export interface SettlementResult {
  state: "COMPLETED" | "FAILED";
  reasonCode?: ErrorCode;
}

export interface SettleParams {
  apiKey: string;
  transactionId: string;
  instruction: PaymentInstruction;
  rail: Rail;
  now: Date;
  /**
   * The DEBIT_SUCCEEDED_CREDIT_FAILED simulation outcome: the source debit
   * genuinely posts (a developer's reconciliation code must catch this),
   * but the destination credit never happens.
   */
  forcedDebitOnlyFailure?: ErrorCode;
}

function assertTransitionsExist(...pairs: Array<[LifecycleState, LifecycleState]>): void {
  for (const [from, to] of pairs) {
    if (!isValidTransition(from, to)) {
      throw new Error(`lib/lifecycle.ts TRANSITIONS is missing ${from} -> ${to}, which lib/sandbox/progression.ts depends on`);
    }
  }
}

export async function settleAndProgress(params: SettleParams): Promise<SettlementResult> {
  const { apiKey, transactionId, instruction, rail, now } = params;

  assertTransitionsExist(["AUTHORIZED", "ROUTING"], ["ROUTING", "SETTLING"], ["SETTLING", "COMPLETED"], ["SETTLING", "FAILED"]);

  const emitFor = (state: LifecycleState, extra?: Record<string, unknown>) => {
    const type = LIFECYCLE_EVENT_NAMES[state];
    if (!type) return;
    emitEvent(
      apiKey,
      transactionId,
      type,
      {
        transactionId,
        status: state,
        rail,
        channel: instruction.channel,
        amountMinor: instruction.amountMinor.toString(),
        currency: instruction.currency,
        ...extra,
      },
      now,
    );
  };

  // The synchronous sandbox never exposes ROUTING/SETTLING as an observable
  // polled status (GET .../payments jumps straight from AUTHORIZED to the
  // terminal state), but it still emits the webhook events for both — a
  // developer's webhook handler sees the same event sequence a real
  // asynchronous settlement would produce, even though status polling
  // would not catch the transaction mid-flight.
  emitFor("ROUTING");
  emitFor("SETTLING");

  if (params.forcedDebitOnlyFailure) {
    await debitWallet(apiKey, instruction.currency, instruction.amountMinor, transactionId, now);
    emitFor("FAILED", { reasonCode: params.forcedDebitOnlyFailure });
    return { state: "FAILED", reasonCode: params.forcedDebitOnlyFailure };
  }

  try {
    if (instruction.channel === "CROSS_BORDER") {
      if (!instruction.quoteId) throw new HoscooApiError("VALIDATION_FAILED", "quoteId is required for CROSS_BORDER", 400);
      const quote = getQuote(instruction.quoteId);
      if (!quote) throw new HoscooApiError("VALIDATION_FAILED", `No quote found for ${instruction.quoteId}`, 404);
      if (isQuoteExpired(quote, now)) throw new HoscooApiError("QUOTE_EXPIRED", "The FX quote has expired", 422);

      const fee = railCost(rail, quote.amountMinor);
      await postCrossBorderSettlement(apiKey, quote, fee, transactionId, now);

      emitEvent(apiKey, quote.quoteId, CROSS_BORDER_EVENT_NAMES.FX_APPLIED, { quoteId: quote.quoteId, corridorId: quote.corridorId, creditedMinor: quote.creditedMinor.toString(), toCurrency: quote.toCurrency }, now);
      emitEvent(apiKey, transactionId, CROSS_BORDER_EVENT_NAMES.CORRIDOR_SETTLEMENT_COMPLETED, { transactionId, corridorId: quote.corridorId }, now);
    } else {
      await debitWallet(apiKey, instruction.currency, instruction.amountMinor, transactionId, now);
      await creditWallet(apiKey, instruction.currency, instruction.amountMinor, transactionId, now);
    }
  } catch (e) {
    if (e instanceof HoscooApiError) {
      emitFor("FAILED", { reasonCode: e.code });
      return { state: "FAILED", reasonCode: e.code };
    }
    throw e;
  }

  emitFor("COMPLETED");
  return { state: "COMPLETED" };
}
