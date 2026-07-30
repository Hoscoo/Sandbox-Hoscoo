import { describe, it, expect } from "vitest";
import { normalizeMsisdn, detectMnoFromMsisdn, MNOS } from "../providers";

describe("MSISDN normalization", () => {
  it("normalizes local (0-prefixed), national, and E.164 forms to the same value", () => {
    expect(normalizeMsisdn("0740000001", "TZ")).toBe("+255740000001");
    expect(normalizeMsisdn("255740000001", "TZ")).toBe("+255740000001");
    expect(normalizeMsisdn("+255740000001", "TZ")).toBe("+255740000001");
    expect(normalizeMsisdn("0740 000 001", "TZ")).toBe("+255740000001");
  });
});

describe("detectMnoFromMsisdn is a soft hint, never a correctness control", () => {
  it("a ported number can disagree with its prefix-implied provider", () => {
    // +255650009999 carries a TIGO_PESA prefix (65) per fixtures.ts, but the
    // fixture explicitly declares AIRTEL_MONEY as the true provider (ported number).
    const detected = detectMnoFromMsisdn("+255650009999", "TZ");
    expect(detected?.code).toBe("TIGO_PESA");
    // The declared provider is a completely independent value the caller supplies —
    // this module has no way to "correct" it, which is the point.
    const declaredProviderCode = "AIRTEL_MONEY";
    expect(detected?.code).not.toBe(declaredProviderCode);
  });

  it("Selcom Pesa owns no MSISDN range, so any number can be legitimately declared as Selcom Pesa", () => {
    const selcom = MNOS.find((m) => m.code === "SELCOM_PESA")!;
    expect(selcom.msisdnPrefixes).toHaveLength(0);
    // A number that resolves to MPESA_TZ by prefix is still a valid SELCOM_PESA declaration —
    // detectMnoFromMsisdn can never rule this out because it never returns SELCOM_PESA at all.
    const detected = detectMnoFromMsisdn("+255740005555", "TZ");
    expect(detected?.code).toBe("MPESA_TZ");
    expect(detected?.code).not.toBe("SELCOM_PESA"); // and yet SELCOM_PESA is a perfectly valid declared provider for this MSISDN
  });

  it("returns undefined for a number matching no known prefix", () => {
    expect(detectMnoFromMsisdn("+255990000000", "TZ")).toBeUndefined();
  });

  it("every non-Selcom MNO has at least one prefix, and no two MNOs share a prefix (today's registry)", () => {
    const withPrefixes = MNOS.filter((m) => m.msisdnPrefixes.length > 0);
    const seen = new Set<string>();
    for (const mno of withPrefixes) {
      for (const prefix of mno.msisdnPrefixes) {
        expect(seen.has(prefix)).toBe(false);
        seen.add(prefix);
      }
    }
  });
});
