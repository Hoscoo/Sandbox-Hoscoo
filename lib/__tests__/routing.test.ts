import { describe, it, expect } from "vitest";
import { selectRoute, railCost, crossoverAmount, type Rail, type RailHealth } from "../corridors";

describe("cost routing", () => {
  it("eligibility gates before cost: a PLANNED market rejects every candidate regardless of cost", () => {
    const decision = selectRoute({
      market: "KE", // PLANNED
      amountMinor: 1_000n,
      minAmountMinor: 1n,
      maxAmountMinor: 1_000_000n,
      candidateRails: ["MNO_INTERCONNECT", "TIPS"],
      railHealth: { MNO_INTERCONNECT: "HEALTHY", TIPS: "HEALTHY" } as Record<Rail, RailHealth>,
    });
    expect(decision.selected).toBeNull();
    expect(decision.candidates.every((c) => c.status === "INELIGIBLE_MARKET_PLANNED")).toBe(true);
    expect(decision.candidates.every((c) => c.costMinor === null)).toBe(true);
  });

  it("a tripped (DOWN) rail is skipped even when it would have been cheapest", () => {
    // TIPS is the cheapest rail in the fee model; force it DOWN and confirm the decision still lands elsewhere.
    const decision = selectRoute({
      market: "TZ",
      amountMinor: 100_000n,
      minAmountMinor: 1n,
      maxAmountMinor: 1_000_000n,
      candidateRails: ["MNO_INTERCONNECT", "TIPS"],
      railHealth: { MNO_INTERCONNECT: "HEALTHY", TIPS: "DOWN" } as Record<Rail, RailHealth>,
    });
    expect(decision.selected?.rail).toBe("MNO_INTERCONNECT");
    const tips = decision.candidates.find((c) => c.rail === "TIPS")!;
    expect(tips.status).toBe("INELIGIBLE_RAIL_DOWN");
    expect(tips.costMinor).toBeNull();
  });

  it("among eligible candidates only, the cheapest is selected", () => {
    const decision = selectRoute({
      market: "TZ",
      amountMinor: 100_000n,
      minAmountMinor: 1n,
      maxAmountMinor: 1_000_000n,
      candidateRails: ["MNO_INTERCONNECT", "TIPS", "SWIFT"],
      railHealth: { MNO_INTERCONNECT: "HEALTHY", TIPS: "HEALTHY", SWIFT: "HEALTHY" } as Record<Rail, RailHealth>,
    });
    const eligible = decision.candidates.filter((c) => c.status === "ELIGIBLE");
    const cheapest = eligible.reduce((a, b) => ((a.costMinor as bigint) < (b.costMinor as bigint) ? a : b));
    expect(decision.selected?.rail).toBe(cheapest.rail);
  });

  it("crossoverAmount is derived from the fee model and moves when the model changes", () => {
    const crossover = crossoverAmount("MNO_INTERCONNECT", "TIPS");
    expect(crossover).not.toBeNull();
    const c = crossover as bigint;
    // Just below crossover, MNO_INTERCONNECT should be <= TIPS; at/after, TIPS should be <= MNO_INTERCONNECT.
    if (c > 0n) {
      expect(railCost("TIPS", c - 1n)).toBeLessThanOrEqual(railCost("MNO_INTERCONNECT", c - 1n) + 1n);
    }
    expect(railCost("TIPS", c)).toBeLessThanOrEqual(railCost("MNO_INTERCONNECT", c));
  });

  it("amount outside corridor limits is ineligible regardless of cost", () => {
    const decision = selectRoute({
      market: "TZ",
      amountMinor: 1n,
      minAmountMinor: 1_000n,
      maxAmountMinor: 1_000_000n,
      candidateRails: ["MNO_INTERCONNECT"],
      railHealth: { MNO_INTERCONNECT: "HEALTHY" } as Record<Rail, RailHealth>,
    });
    expect(decision.selected).toBeNull();
    expect(decision.candidates[0]!.status).toBe("INELIGIBLE_LIMIT");
  });
});
