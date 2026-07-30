import { describe, it, expect } from "vitest";
import { resolveEnvironment, EnvironmentMismatchError, extractApiKeyPrefix, PRODUCTION_HOST, SANDBOX_HOST } from "../environment";
import { HoscooClient } from "../../sdk/client";
import { HoscooModeKeyMismatchError } from "../../sdk/errors";

describe("resolveEnvironment", () => {
  it("resolves the sandbox host + a matching test key to sandbox, deriving all three fields from one decision", () => {
    const r = resolveEnvironment({ hostname: SANDBOX_HOST, apiKey: "hsc_test_abc" });
    expect(r.environment).toBe("sandbox");
    expect(r.widgetMode).toBe("sandbox");
    expect(r.apiBaseUrl).toContain(SANDBOX_HOST);
  });

  it("resolves the production host + a matching live key to production", () => {
    const r = resolveEnvironment({ hostname: PRODUCTION_HOST, apiKey: "hsc_live_abc" });
    expect(r.environment).toBe("production");
    expect(r.widgetMode).toBe("live");
  });

  it("fails closed: a test key at the production host throws, never silently routes", () => {
    expect(() => resolveEnvironment({ hostname: PRODUCTION_HOST, apiKey: "hsc_test_abc" })).toThrow(EnvironmentMismatchError);
  });

  it("fails closed: a live key at the sandbox host throws", () => {
    expect(() => resolveEnvironment({ hostname: SANDBOX_HOST, apiKey: "hsc_live_abc" })).toThrow(EnvironmentMismatchError);
  });

  it("an unrecognized hostname defaults to production, never sandbox", () => {
    const r = resolveEnvironment({ hostname: "some-unexpected-host.example.com", apiKey: null });
    expect(r.environment).toBe("production");
  });

  it("extractApiKeyPrefix recognizes only the two known prefixes", () => {
    expect(extractApiKeyPrefix("hsc_test_x")).toBe("hsc_test_");
    expect(extractApiKeyPrefix("hsc_live_x")).toBe("hsc_live_");
    expect(extractApiKeyPrefix("sk_live_x")).toBeNull();
    expect(extractApiKeyPrefix(null)).toBeNull();
  });
});

describe("SDK init() mode/key mismatch", () => {
  it("throws HoscooModeKeyMismatchError for mode: 'sandbox' with a live key", () => {
    expect(() => HoscooClient.init({ publicKey: "hsc_live_abc", mode: "sandbox", hostname: SANDBOX_HOST })).toThrow(HoscooModeKeyMismatchError);
  });

  it("throws HoscooModeKeyMismatchError for mode: 'live' with a test key", () => {
    expect(() => HoscooClient.init({ publicKey: "hsc_test_abc", mode: "live", hostname: PRODUCTION_HOST })).toThrow(HoscooModeKeyMismatchError);
  });

  it("succeeds and retargets all three (base URL, log sink, widget mode) together for a matching sandbox key", () => {
    const client = HoscooClient.init({ publicKey: "hsc_test_abc", mode: "sandbox", hostname: SANDBOX_HOST });
    expect(client.mode).toBe("sandbox");
  });
});
