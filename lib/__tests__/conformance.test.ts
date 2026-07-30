/**
 * Shared conformance suite: the same requests, run against BOTH the
 * production route (app/api/initiate-payment) and the sandbox route
 * (app/api/v1/sandbox/payments), asserting identical validation error
 * codes, identical market-gating behavior, and identical HTTP status
 * shapes. This is the one thing in the repo that actually catches drift
 * between the two planes — see PARITY.md.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as productionInitiate } from "@/app/api/initiate-payment/route";
import { POST as sandboxInitiate } from "@/app/api/v1/sandbox/payments/route";

function makeRequest(url: string, body: unknown, sandbox: boolean) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: sandbox ? "Bearer hsc_test_conformance_suite" : "Bearer hsc_live_conformance_suite",
    },
    body: JSON.stringify(body),
  });
}

describe("production/sandbox conformance", () => {
  it("both planes reject a missing/wrong-prefix API key with UNAUTHORIZED, before touching validation", async () => {
    const body = { channel: "MNO_TO_MNO" };
    const prodReq = new NextRequest("https://api.hoscoo.com/api/initiate-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const sandboxReq = new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    const prodRes = await productionInitiate(prodReq);
    const sandboxRes = await sandboxInitiate(sandboxReq);

    expect(prodRes.status).toBe(401);
    expect(sandboxRes.status).toBe(401);
    expect((await prodRes.json()).error.code).toBe("UNAUTHORIZED");
    expect((await sandboxRes.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("both planes reject a malformed body with VALIDATION_FAILED", async () => {
    const body = { channel: "NOT_A_REAL_CHANNEL" };

    const prodRes = await productionInitiate(makeRequest("https://api.hoscoo.com/api/initiate-payment", body, false));
    const sandboxRes = await sandboxInitiate(makeRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", body, true));

    expect(prodRes.status).toBe(400);
    expect(sandboxRes.status).toBe(400);
    const prodJson = await prodRes.json();
    const sandboxJson = await sandboxRes.json();
    expect(prodJson.error.code).toBe("VALIDATION_FAILED");
    expect(sandboxJson.error.code).toBe("VALIDATION_FAILED");
  });

  it("both planes reject a PLANNED-market instruction with MARKET_NOT_LIVE, before touching routing", async () => {
    const body = {
      channel: "MNO_TO_MNO",
      amountMinor: "10000",
      currency: "KES",
      market: "KE",
      source: { providerCode: "MPESA_TZ", accountType: "WALLET", identifier: "+255740000001" },
      destination: { providerCode: "AIRTEL_MONEY", accountType: "WALLET", identifier: "+255780000001" },
      reference: "conformance-planned-market",
    };

    const prodRes = await productionInitiate(makeRequest("https://api.hoscoo.com/api/initiate-payment", body, false));
    const sandboxRes = await sandboxInitiate(makeRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", body, true));

    expect(prodRes.status).toBe(422);
    expect(sandboxRes.status).toBe(422);
    expect((await prodRes.json()).error.code).toBe("MARKET_NOT_LIVE");
    expect((await sandboxRes.json()).error.code).toBe("MARKET_NOT_LIVE");
  });

  it("both planes reject a same-provider MNO_TO_MNO instruction with SAME_PROVIDER_ON_US", async () => {
    const body = {
      channel: "MNO_TO_MNO",
      amountMinor: "10000",
      currency: "TZS",
      market: "TZ",
      source: { providerCode: "MPESA_TZ", accountType: "WALLET", identifier: "+255740000001" },
      destination: { providerCode: "MPESA_TZ", accountType: "WALLET", identifier: "+255740000002" },
      reference: "conformance-on-us",
    };

    const prodRes = await productionInitiate(makeRequest("https://api.hoscoo.com/api/initiate-payment", body, false));
    const sandboxRes = await sandboxInitiate(makeRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", body, true));

    expect(prodRes.status).toBe(422);
    expect(sandboxRes.status).toBe(422);
    expect((await prodRes.json()).error.code).toBe("SAME_PROVIDER_ON_US");
    expect((await sandboxRes.json()).error.code).toBe("SAME_PROVIDER_ON_US");
  });
});
