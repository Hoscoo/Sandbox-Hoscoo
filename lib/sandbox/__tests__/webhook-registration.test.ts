/**
 * Regression test: the sandbox console's "Use local echo" button fills in
 * http://localhost:3000/... for self-testing without an external URL, but
 * registration required https:// unconditionally, so that button silently
 * failed every single time in local dev. Caught by actually clicking it.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as registerWebhook, GET as getWebhook } from "@/app/api/v1/sandbox/webhooks/route";

function req(url: string, apiKey = "hsc_test_webhook_registration_suite") {
  return new NextRequest("http://localhost:3000/api/v1/sandbox/webhooks", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ url }),
  });
}

describe("webhook URL registration", () => {
  it("accepts a real https:// URL", async () => {
    const res = await registerWebhook(req("https://example.com/webhooks"));
    expect(res.status).toBe(200);
  });

  it("accepts http://localhost — the local echo receiver's URL", async () => {
    const res = await registerWebhook(req("http://localhost:3000/api/v1/sandbox/webhooks/echo"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toBe("http://localhost:3000/api/v1/sandbox/webhooks/echo");
  });

  it("accepts http://127.0.0.1", async () => {
    const res = await registerWebhook(req("http://127.0.0.1:3000/api/v1/sandbox/webhooks/echo"));
    expect(res.status).toBe(200);
  });

  it("rejects plain http:// for a real hostname", async () => {
    const res = await registerWebhook(req("http://example.com/webhooks"));
    expect(res.status).toBe(400);
  });

  it("rejects a non-URL string", async () => {
    const res = await registerWebhook(req("not-a-url"));
    expect(res.status).toBe(400);
  });

  it("a registered URL is actually retrievable via GET", async () => {
    const apiKey = "hsc_test_webhook_get_suite";
    await registerWebhook(req("https://example.com/hook", apiKey));
    const res = await getWebhook(new NextRequest("http://localhost:3000/api/v1/sandbox/webhooks", { headers: { Authorization: `Bearer ${apiKey}` } }));
    const json = await res.json();
    expect(json.url).toBe("https://example.com/hook");
  });
});
