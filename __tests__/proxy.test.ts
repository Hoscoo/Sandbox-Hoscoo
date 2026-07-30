import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

function req(url: string, apiKey?: string) {
  return new NextRequest(url, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
}

describe("proxy environment gate", () => {
  it("blocks a test key at a real production hostname", () => {
    const res = proxy(req("https://api.hoscoo.com/api/initiate-payment", "hsc_test_abc"));
    expect(res.status).toBe(400);
  });

  it("blocks a live key at a real sandbox hostname", () => {
    const res = proxy(req("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", "hsc_live_abc"));
    expect(res.status).toBe(400);
  });

  it("allows a matching pair through at real hostnames", () => {
    const res = proxy(req("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", "hsc_test_abc"));
    expect(res.status).toBe(200);
  });

  it("never blocks on localhost, regardless of key prefix — local dev has no real hostname distinction", () => {
    const withTestKey = proxy(req("http://localhost:3000/api/v1/sandbox/payments", "hsc_test_abc"));
    const withLiveKey = proxy(req("http://localhost:3000/api/initiate-payment", "hsc_live_abc"));
    const withNoKey = proxy(req("http://localhost:3000/api/v1/sandbox/payments"));
    expect(withTestKey.status).toBe(200);
    expect(withLiveKey.status).toBe(200);
    expect(withNoKey.status).toBe(200);
  });
});
