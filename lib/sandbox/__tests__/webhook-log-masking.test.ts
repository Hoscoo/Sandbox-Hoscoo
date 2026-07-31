/**
 * Regression: MSISDN masking in the delivery inspector (app/api/v1/sandbox/
 * webhooks/logs/route.ts) was built but never exercised — event payloads
 * never actually carried an MSISDN, so the masking code path was dead.
 * Fixed by including destinationIdentifier in every emitted event's
 * payload; this asserts the inspector actually masks it.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as initiate } from "@/app/api/v1/sandbox/payments/route";
import { POST as registerWebhook } from "@/app/api/v1/sandbox/webhooks/route";
import { GET as dispatch } from "@/app/api/v1/sandbox/webhooks/dispatch/route";
import { GET as getLogs } from "@/app/api/v1/sandbox/webhooks/logs/route";

describe("webhook delivery log masks MSISDNs", () => {
  it("the destination MSISDN never appears unmasked in a delivery log payload preview", async () => {
    const apiKey = "hsc_test_masking_suite";
    const auth = { Authorization: `Bearer ${apiKey}` };
    const destinationMsisdn = "+255780005555";

    await registerWebhook(
      new NextRequest("http://localhost:3000/api/v1/sandbox/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ url: "http://localhost:3000/api/v1/sandbox/webhooks/echo" }),
      }),
    );

    await initiate(
      new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          channel: "MNO_TO_MNO",
          amountMinor: "10000",
          currency: "TZS",
          market: "TZ",
          source: { providerCode: "MPESA_TZ", accountType: "WALLET", identifier: "+255740005555" },
          destination: { providerCode: "AIRTEL_MONEY", accountType: "WALLET", identifier: destinationMsisdn },
          reference: `masking-test-${Date.now()}`,
        }),
      }),
    );

    await dispatch(new NextRequest("http://localhost:3000/api/v1/sandbox/webhooks/dispatch"));

    const logsRes = await getLogs(new NextRequest("http://localhost:3000/api/v1/sandbox/webhooks/logs", { headers: auth }));
    const { logs } = await logsRes.json();

    expect(logs.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(destinationMsisdn);
    // Confirms the field is actually present (masked), not silently dropped.
    expect(logs[0].payloadPreview.destinationIdentifier).toBeDefined();
    expect(logs[0].payloadPreview.destinationIdentifier).not.toBe(destinationMsisdn);
  });
});
