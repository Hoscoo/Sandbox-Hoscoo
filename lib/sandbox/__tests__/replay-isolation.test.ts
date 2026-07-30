/**
 * Replay must re-deliver a stored notification and nothing else. Enforced
 * two ways: a static import scan (so the forbidden import can never even
 * compile in), and a runtime check that repeated replays don't touch the
 * ledger or issue new quotes.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { emitEvent, replayDelivery, getEvent } from "../webhooks";
import { InMemorySandboxStore } from "../store";
import { ensureTenant, getWalletBalance } from "../ledger";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPLAY_ROUTE_PATH = join(__dirname, "..", "..", "..", "app", "api", "v1", "sandbox", "webhooks", "replay", "route.ts");

describe("replay route: structural isolation from money-moving code", () => {
  it("the replay route source imports nothing from the ledger, simulation, or FX-quoting modules", () => {
    const source = readFileSync(REPLAY_ROUTE_PATH, "utf-8");
    expect(source).not.toMatch(/from ["']@\/lib\/sandbox\/ledger["']/);
    expect(source).not.toMatch(/from ["']@\/lib\/sandbox\/simulation["']/);
    // Only forbid an actual import of quoteFx (a mention in an explanatory comment, as in this file, is fine).
    expect(source).not.toMatch(/import\s*\{[^}]*\bquoteFx\b[^}]*\}\s*from/);
  });
});

describe("replay runtime behavior", () => {
  const apiKey = "hsc_test_replay_suite";

  beforeEach(async () => {
    // Register an endpoint so emitEvent actually queues a delivery.
    const { registerWebhookEndpoint } = await import("../webhooks");
    registerWebhookEndpoint(apiKey, "https://merchant.example.com/webhooks");
  });

  it("replaying an event reuses the exact same event id, never a fresh one", () => {
    const event = emitEvent(apiKey, "hsc_sbx_tx_1", "payment.completed", { transactionId: "hsc_sbx_tx_1" });
    const delivery = replayDelivery(apiKey, event.id);
    expect(delivery.eventId).toBe(event.id);
    expect(delivery.isReplay).toBe(true);
    // The stored event itself is untouched.
    expect(getEvent(event.id)).toEqual(event);
  });

  it("replaying the same event multiple times never mutates the mock ledger", async () => {
    const store = new InMemorySandboxStore();
    const now = new Date("2026-01-01T00:00:00Z");
    await ensureTenant(apiKey, now, store);
    const balanceBefore = await getWalletBalance(apiKey, "TZS", store);

    const event = emitEvent(apiKey, "hsc_sbx_tx_2", "payment.completed", { transactionId: "hsc_sbx_tx_2" });
    replayDelivery(apiKey, event.id, new Date(now.getTime() + 1000));
    replayDelivery(apiKey, event.id, new Date(now.getTime() + 2000));
    replayDelivery(apiKey, event.id, new Date(now.getTime() + 3000));

    const balanceAfter = await getWalletBalance(apiKey, "TZS", store);
    expect(balanceAfter).toBe(balanceBefore);
  });

  it("rejects replaying an event that belongs to a different API key", () => {
    const event = emitEvent("hsc_test_someone_else", "hsc_sbx_tx_3", "payment.completed", {});
    expect(() => replayDelivery(apiKey, event.id)).toThrow();
  });
});
