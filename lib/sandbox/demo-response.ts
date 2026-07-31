/**
 * Shared response interpretation for the sandbox console's demo panels
 * (components/checkout/*-panel.tsx). A FAILED/EXPIRED outcome is not a
 * client error — the server still creates and returns a transaction record
 * for it (see app/api/v1/sandbox/payments/route.ts's persist/persistAndEmit)
 * — so checking `res.ok` alone discards exactly the failure fixtures these
 * panels exist to demonstrate. The presence of `transactionId` is what
 * actually distinguishes "a transaction happened, and it failed" from "this
 * request was rejected before any transaction existed" (validation,
 * MARKET_NOT_LIVE, SAME_PROVIDER_ON_US, an unmapped TIPS alias, ...).
 */
export interface DemoPaymentResponse {
  transactionId?: string;
  status?: string;
  reasonCode?: string;
  requiresAction?: boolean;
  error?: { code: string; message: string };
}

export interface PaymentOutcomeToast {
  type: "success" | "error" | "info";
  message: string;
}

export function describePaymentOutcome(json: DemoPaymentResponse): PaymentOutcomeToast {
  if (json.requiresAction) return { type: "info", message: "Authorization required" };
  if (json.transactionId) {
    if (json.status === "COMPLETED") return { type: "success", message: "Payment initiated" };
    return { type: "error", message: `Payment ${json.status?.toLowerCase() ?? "failed"}${json.reasonCode ? `: ${json.reasonCode}` : ""}` };
  }
  return { type: "error", message: json.error?.message ?? "Payment initiation failed" };
}
