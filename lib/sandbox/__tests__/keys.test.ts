import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { issueSandboxApiKey, getSandboxApiKey, touchSandboxApiKey } from "../keys";
import { requireSandboxApiKey } from "../auth";
import { POST as issueKeyRoute } from "@/app/api/v1/sandbox/keys/route";

describe("sandbox API key registry", () => {
  it("issueSandboxApiKey produces a real, unique, prefix-correct key", () => {
    const a = issueSandboxApiKey("my app");
    const b = issueSandboxApiKey("my app");
    expect(a.key).toMatch(/^hsc_test_[0-9a-f]{48}$/);
    expect(a.key).not.toBe(b.key);
    expect(getSandboxApiKey(a.key)?.label).toBe("my app");
  });

  it("does not gate access: an unissued, hand-typed hsc_test_ key still authenticates and gets a real registry entry", () => {
    const handTyped = "hsc_test_someone_just_typed_this";
    expect(getSandboxApiKey(handTyped)).toBeUndefined();

    const req = new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/payments", { headers: { Authorization: `Bearer ${handTyped}` } });
    const key = requireSandboxApiKey(req);

    expect(key).toBe(handTyped);
    expect(getSandboxApiKey(handTyped)).toBeDefined();
    expect(getSandboxApiKey(handTyped)?.label).toBe("auto-registered");
  });

  it("touching an already-registered key updates lastUsedAt without changing its label", () => {
    const issued = issueSandboxApiKey("stable label");
    const laterTouch = touchSandboxApiKey(issued.key, new Date(Date.now() + 60_000));
    expect(laterTouch.label).toBe("stable label");
    expect(new Date(laterTouch.lastUsedAt).getTime()).toBeGreaterThan(new Date(issued.createdAt).getTime());
  });

  it("the issuance endpoint requires no auth and returns a usable key", async () => {
    const res = await issueKeyRoute(new NextRequest("https://sandbox-api.hoscoo.com/api/v1/sandbox/keys", { method: "POST", body: JSON.stringify({ label: "from-endpoint" }) }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.key).toMatch(/^hsc_test_/);
    expect(json.label).toBe("from-endpoint");
  });
});
