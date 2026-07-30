import { NextRequest, NextResponse } from "next/server";
import { getTransaction } from "@/lib/transactions";
import { requireProductionApiKey } from "@/lib/auth";
import { HoscooApiError, errorEnvelope } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    requireProductionApiKey(req);
  } catch (e) {
    if (e instanceof HoscooApiError) return NextResponse.json(e.toEnvelope(), { status: e.httpStatus });
    throw e;
  }

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) {
    return NextResponse.json(errorEnvelope("VALIDATION_FAILED", "transactionId query parameter is required"), { status: 400 });
  }

  const tx = getTransaction(transactionId);
  if (!tx) {
    return NextResponse.json(errorEnvelope("VALIDATION_FAILED", `No transaction found for ${transactionId}`), { status: 404 });
  }

  return NextResponse.json({
    transactionId: tx.transactionId,
    status: tx.state,
    rail: tx.rail,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  });
}
