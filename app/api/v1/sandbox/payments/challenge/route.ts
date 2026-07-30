import { NextRequest, NextResponse } from "next/server";
import { requireSandboxApiKey } from "@/lib/sandbox/auth";
import { getSandboxTransaction, putSandboxTransaction, type SandboxTransaction } from "@/lib/sandbox/transactions";
import { settleAndProgress } from "@/lib/sandbox/progression";
import { emitEvent, LIFECYCLE_EVENT_NAMES } from "@/lib/sandbox/webhooks";
import { HoscooApiError, errorEnvelope } from "@/lib/errors";

/**
 * Resolves a pending 3-DS/step-up challenge issued by initiating a payment
 * against a THREE_DS_CHALLENGE magic MSISDN. This is the endpoint the Test
 * Bank modal (components/sandbox/test-bank-modal.tsx) calls when the
 * customer approves or denies the challenge — without this route, a
 * challenge-issued transaction had no way to ever leave AUTHORIZED.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = requireSandboxApiKey(req);
    const body = (await req.json()) as { transactionId?: string; decision?: "approved" | "denied" };

    if (!body.transactionId || (body.decision !== "approved" && body.decision !== "denied")) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "transactionId and decision ('approved' | 'denied') are required"), { status: 400 });
    }

    const tx = getSandboxTransaction(body.transactionId);
    if (!tx || tx.apiKey !== apiKey) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", `No sandbox transaction found for ${body.transactionId}`), { status: 404 });
    }
    if (tx.state !== "AUTHORIZED" || !tx.requiresAction) {
      return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "This transaction has no pending challenge to resolve"), { status: 409 });
    }
    if (!tx.rail) {
      return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Transaction is missing its routed rail"), { status: 500 });
    }

    const now = new Date();

    if (body.decision === "denied") {
      const updated: SandboxTransaction = { ...tx, state: "FAILED", reasonCode: "THREE_DS_CHALLENGE_FAILED", requiresAction: false, updatedAt: now.toISOString() };
      putSandboxTransaction(updated);
      const eventType = LIFECYCLE_EVENT_NAMES.FAILED;
      if (eventType) {
        emitEvent(apiKey, tx.transactionId, eventType, { transactionId: tx.transactionId, status: "FAILED", reasonCode: "THREE_DS_CHALLENGE_FAILED", rail: tx.rail }, now);
      }
      return NextResponse.json({ transactionId: tx.transactionId, status: "FAILED", reasonCode: "THREE_DS_CHALLENGE_FAILED", requiresAction: false }, { status: 402 });
    }

    const settlement = await settleAndProgress({ apiKey, transactionId: tx.transactionId, instruction: tx.instruction, rail: tx.rail, now });
    const updated: SandboxTransaction = { ...tx, state: settlement.state, reasonCode: settlement.reasonCode, requiresAction: false, updatedAt: now.toISOString() };
    putSandboxTransaction(updated);

    return NextResponse.json(
      { transactionId: tx.transactionId, status: settlement.state, reasonCode: settlement.reasonCode, requiresAction: false },
      { status: settlement.state === "COMPLETED" ? 200 : 402 },
    );
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    return NextResponse.json(errorEnvelope("INTERNAL_ERROR", "Unexpected error resolving challenge"), { status: 500 });
  }
}
