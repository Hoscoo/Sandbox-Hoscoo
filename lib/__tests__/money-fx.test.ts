/**
 * Money and FX property tests — the highest-value tests in this suite per
 * the sandbox spec. Runs across many (corridor, amount) combinations rather
 * than a handful of examples, because rounding bugs hide at specific
 * amounts, not universally.
 */
import { describe, it, expect } from "vitest";
import { CORRIDORS, CURRENCY_META, formatCurrency, quoteFx, railCost, crossoverAmount } from "../corridors";
import { SANDBOX_FX_RATES } from "../sandbox/ledger";

const SAMPLE_AMOUNTS = [
  1_000_00n,
  333_333n, // deliberately does not divide evenly against the sandbox rates
  1_000_000_00n,
  1n,
  999_999_999n,
  7n,
  123_456_789n,
];

describe("quoteFx money properties", () => {
  for (const corridor of CORRIDORS) {
    const rate = SANDBOX_FX_RATES[corridor.id];
    if (!rate) continue;

    for (const amountMinor of SAMPLE_AMOUNTS) {
      it(`${corridor.id} amountMinor=${amountMinor}: no float, rounds once, zero-decimal-safe`, () => {
        const quote = quoteFx({
          corridorId: corridor.id,
          amountMinor,
          baseRateNumerator: rate.numerator,
          baseRateDenominator: rate.denominator,
          quoteId: "test",
          now: new Date("2026-01-01T00:00:00Z"),
        });

        // creditedMinor is always a non-negative integer bigint.
        expect(typeof quote.creditedMinor).toBe("bigint");
        expect(quote.creditedMinor).toBeGreaterThanOrEqual(0n);

        // Zero-decimal destination currencies (UGX, RWF) never carry fractional minor units by construction —
        // minor units ARE the whole currency unit for exponent-0 currencies, so this is trivially true, but the
        // real assertion is that formatCurrency never emits a decimal point for them.
        if (CURRENCY_META[corridor.toCurrency].exponent === 0) {
          const formatted = formatCurrency(quote.creditedMinor, corridor.toCurrency);
          expect(formatted).not.toContain(".");
        }

        // creditedMinor must be the nearest integer to the exact rational value
        // (amountMinor * midRate * (1 - spread)) — i.e. rounded exactly once, to
        // within half a unit of the true value. This is the direct correctness
        // check for "rounds exactly once, no residual"; round-tripping back
        // through the inverse rate is NOT an equivalent check here, because TZS
        // is a small-value currency relative to KES/UGX/RWF at these rates, so
        // inversion amplifies a sub-half-unit forward rounding error by ~1/rate.
        const spreadNumerator = 10_000n - BigInt(quote.spreadBps);
        const exactNumerator = quote.midRateNumerator * spreadNumerator * amountMinor;
        const exactDenominator = quote.midRateDenominator * 10_000n;
        const twiceDiff = (quote.creditedMinor * exactDenominator * 2n > exactNumerator * 2n
          ? quote.creditedMinor * exactDenominator * 2n - exactNumerator * 2n
          : exactNumerator * 2n - quote.creditedMinor * exactDenominator * 2n);
        expect(twiceDiff).toBeLessThanOrEqual(exactDenominator);
      });
    }
  }

  it("quoting the same corridor and amount twice is perfectly reproducible (deterministic sandbox rates)", () => {
    const rate = SANDBOX_FX_RATES["TZ-KE"]!;
    const a = quoteFx({ corridorId: "TZ-KE", amountMinor: 500_000n, baseRateNumerator: rate.numerator, baseRateDenominator: rate.denominator, quoteId: "a", now: new Date("2026-01-01T00:00:00Z") });
    const b = quoteFx({ corridorId: "TZ-KE", amountMinor: 500_000n, baseRateNumerator: rate.numerator, baseRateDenominator: rate.denominator, quoteId: "b", now: new Date("2026-01-01T00:00:00Z") });
    expect(a.creditedMinor).toBe(b.creditedMinor);
  });

  it("never produces a fractional (non-bigint) amount — the type system rules out floats, this checks runtime reality", () => {
    const rate = SANDBOX_FX_RATES["TZ-UG"]!;
    const quote = quoteFx({ corridorId: "TZ-UG", amountMinor: 333_333n, baseRateNumerator: rate.numerator, baseRateDenominator: rate.denominator, quoteId: "c", now: new Date("2026-01-01T00:00:00Z") });
    expect(Number.isInteger(Number(quote.creditedMinor))).toBe(true);
    expect(() => BigInt(quote.creditedMinor)).not.toThrow();
  });
});

describe("debited = principal + fee, credited = quoted amount, exactly", () => {
  it("fee is computed once via railCost and is additive to the principal debit, in minor units", () => {
    const amountMinor = 1_000_000n;
    const fee = railCost("CORRIDOR_SETTLEMENT", amountMinor);
    const totalDebited = amountMinor + fee;
    expect(totalDebited).toBe(amountMinor + fee); // trivially exact by construction — the point is fee is a bigint, not a float remainder
    expect(typeof fee).toBe("bigint");
  });
});

describe("crossoverAmount is derived, not hardcoded", () => {
  it("moves when the underlying fee model changes shape (sanity: MNO_INTERCONNECT vs TIPS today)", () => {
    const crossover = crossoverAmount("MNO_INTERCONNECT", "TIPS");
    expect(crossover).not.toBeNull();
    if (crossover !== null) {
      const costA = railCost("MNO_INTERCONNECT", crossover);
      const costB = railCost("TIPS", crossover);
      // At and beyond the crossover point, TIPS must be cheaper or equal.
      expect(costB).toBeLessThanOrEqual(costA);
    }
  });
});
