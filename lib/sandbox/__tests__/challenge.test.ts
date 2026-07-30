/**
 * The challenge flow end to end: initiate against a THREE_DS_CHALLENGE
 * magic MSISDN, confirm nothing settles yet, then resolve it both ways and
 * confirm the ledger only moves on approval.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as initiate } from "@/app/api/v1/sandbox/payments/route";
import { POST as resolveChallenge } from "@/app/api/v1/sandbox/payments/challenge/route";
import { ensureTenant, getWalletBalance } from "@/lib/sandbox/ledger";
import { sandboxStore } from "@/lib/sandbox/store";

const AUTH = { Authorization: "Bearer hsc_test_challenge_suite" };

function initiateRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    body: JSON.stringify({
      channel: "MNO_TO_MNO",
      amountMinor: "50000",
      currency: "TZS",
      market: "TZ",
      source: { providerCode: "MPESA_TZ", accountType: "WALLET", identifier: "+255740000001" },
      destination: { providerCode: "AIRTEL_MONEY", accountType: "WALLET", identifier: "+255700000105" }, // magic 3-DS challenge MSISDN
      reference: `challenge-test-${Date.now()}-${Math.random()}`,
      ...overrides,
    }),
  });
}

describe("3-DS challenge flow", () => {
  it("issues AUTHORIZED with requiresAction and does not touch the ledger yet", async () => {
    // Isolate the tenant's one-time auto-provisioning seed deposit from
    // this assertion by ensuring the tenant already exists before
    // capturing "before" — a fresh key's very first call legitimately
    // changes its balance from 0 via seeding, which is correct product
    // behavior, not something this test is about.
    await ensureTenant("hsc_test_challenge_suite");
    const before = await getWalletBalance("hsc_test_challenge_suite", "TZS");

    const res = await initiate(initiateRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("AUTHORIZED");
    expect(json.requiresAction).toBe(true);

    const after = await getWalletBalance("hsc_test_challenge_suite", "TZS");
    expect(after).toBe(before);
  });

  it("approving the challenge settles the ledger and reaches COMPLETED", async () => {
    const initiateRes = await initiate(initiateRequest());
    const initiateJson = await initiateRes.json();

    const resolveRes = await resolveChallenge(
      new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH },
        body: JSON.stringify({ transactionId: initiateJson.transactionId, decision: "approved" }),
      }),
    );
    const resolveJson = await resolveRes.json();

    expect(resolveRes.status).toBe(200);
    expect(resolveJson.status).toBe("COMPLETED");
    expect(resolveJson.requiresAction).toBe(false);

    // MNO_TO_MNO debits and credits the same tenant wallet, so net balance is
    // unchanged by design — the real proof settlement happened is that
    // balanced ledger entries were actually posted for this transactionId.
    const entries = await sandboxStore.listEntries("hsc_test_challenge_suite", "TZS");
    const forThisTx = entries.filter((e) => e.transactionId === initiateJson.transactionId);
    expect(forThisTx.length).toBeGreaterThanOrEqual(2);
    const net = forThisTx.reduce((sum, e) => sum + (e.direction === "CREDIT" ? e.amountMinor : -e.amountMinor), 0n);
    expect(net).toBe(0n);
  });

  it("denying the challenge fails the transaction and never touches the ledger", async () => {
    const before = await getWalletBalance("hsc_test_challenge_suite", "TZS");

    const initiateRes = await initiate(initiateRequest());
    const initiateJson = await initiateRes.json();

    const resolveRes = await resolveChallenge(
      new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH },
        body: JSON.stringify({ transactionId: initiateJson.transactionId, decision: "denied" }),
      }),
    );
    const resolveJson = await resolveRes.json();

    expect(resolveRes.status).toBe(402);
    expect(resolveJson.status).toBe("FAILED");
    expect(resolveJson.reasonCode).toBe("THREE_DS_CHALLENGE_FAILED");

    const after = await getWalletBalance("hsc_test_challenge_suite", "TZS");
    expect(after).toBe(before);
  });

  it("resolving a challenge twice, or one that doesn't exist, is rejected", async () => {
    const initiateRes = await initiate(initiateRequest());
    const initiateJson = await initiateRes.json();

    const first = await resolveChallenge(
      new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH },
        body: JSON.stringify({ transactionId: initiateJson.transactionId, decision: "approved" }),
      }),
    );
    expect(first.status).toBe(200);

    const second = await resolveChallenge(
      new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH },
        body: JSON.stringify({ transactionId: initiateJson.transactionId, decision: "approved" }),
      }),
    );
    expect(second.status).toBe(409);

    const unknown = await resolveChallenge(
      new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH },
        body: JSON.stringify({ transactionId: "hsc_sbx_tx_does_not_exist", decision: "approved" }),
      }),
    );
    expect(unknown.status).toBe(404);
  });
});

describe("magic LIFECYCLE_STATE failure values never move the ledger", () => {
  it("the insufficient-funds magic MSISDN leaves the wallet balance unchanged", async () => {
    const apiKey = "hsc_test_insufficient_funds_suite";
    await ensureTenant(apiKey);
    const before = await getWalletBalance(apiKey, "TZS");

    const res = await initiate(
      new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          channel: "MNO_TO_MNO",
          amountMinor: "50000",
          currency: "TZS",
          market: "TZ",
          source: { providerCode: "MPESA_TZ", accountType: "WALLET", identifier: "+255740000001" },
          destination: { providerCode: "AIRTEL_MONEY", accountType: "WALLET", identifier: "+255700000101" }, // magic insufficient-funds MSISDN
          reference: `insufficient-funds-test-${Date.now()}`,
        }),
      }),
    );
    const json = await res.json();
    expect(json.status).toBe("FAILED");
    expect(json.reasonCode).toBe("INSUFFICIENT_FUNDS");

    const after = await getWalletBalance(apiKey, "TZS");
    expect(after).toBe(before);
  });
});
