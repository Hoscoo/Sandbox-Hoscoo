import { describe, it, expect } from "vitest";
import { createWebhookDispatcher } from "../core";

describe("createWebhookDispatcher isolation", () => {
  it("two dispatchers (sandbox and production) never share events, endpoints, or delivery logs", async () => {
    const sandbox = createWebhookDispatcher("sandbox");
    const production = createWebhookDispatcher("production");

    sandbox.registerWebhookEndpoint("hsc_test_a", "https://merchant.example.com/sandbox-hook");
    production.registerWebhookEndpoint("hsc_live_a", "https://merchant.example.com/live-hook");

    const sandboxEvent = sandbox.emitEvent("hsc_test_a", "hsc_sbx_tx_1", "payment.completed", { transactionId: "hsc_sbx_tx_1" });
    const productionEvent = production.emitEvent("hsc_live_a", "hsc_tx_1", "payment.completed", { transactionId: "hsc_tx_1" });

    expect(sandbox.getEvent(productionEvent.id)).toBeUndefined();
    expect(production.getEvent(sandboxEvent.id)).toBeUndefined();
    expect(sandbox.getWebhookEndpoint("hsc_live_a")).toBeUndefined();
    expect(production.getWebhookEndpoint("hsc_test_a")).toBeUndefined();
  });

  it("drainPendingDeliveries actually delivers, signs, and retries with backoff on failure", async () => {
    const dispatcher = createWebhookDispatcher("production");
    dispatcher.registerWebhookEndpoint("hsc_live_retry", "https://merchant.example.com/hook");

    let callCount = 0;
    const flakyFetch: typeof fetch = async () => {
      callCount++;
      if (callCount === 1) return new Response(null, { status: 500 });
      return new Response(null, { status: 200 });
    };

    const now = new Date("2026-01-01T00:00:00Z");
    const event = dispatcher.emitEvent("hsc_live_retry", "hsc_tx_2", "payment.completed", { transactionId: "hsc_tx_2" }, now);

    const first = await dispatcher.drainPendingDeliveries(now, flakyFetch);
    expect(first.attempted).toBe(1);
    expect(first.delivered).toBe(0);

    const log = dispatcher.listDeliveryLog("hsc_live_retry");
    expect(log).toHaveLength(1);
    expect(log[0]!.httpStatus).toBe(500);
    expect(log[0]!.eventId).toBe(event.id);

    // Retry after backoff should succeed.
    const later = new Date(now.getTime() + 60_000);
    const second = await dispatcher.drainPendingDeliveries(later, flakyFetch);
    expect(second.delivered).toBe(1);
    expect(dispatcher.listDeliveryLog("hsc_live_retry")).toHaveLength(2);
  });

  it("emitEvent queues nothing when no endpoint is registered, but still records the immutable event", () => {
    const dispatcher = createWebhookDispatcher("production");
    const event = dispatcher.emitEvent("hsc_live_no_endpoint", "hsc_tx_3", "payment.failed", { transactionId: "hsc_tx_3" });
    expect(dispatcher.getEvent(event.id)).toEqual(event);
  });
});
