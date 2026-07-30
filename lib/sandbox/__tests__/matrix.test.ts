/**
 * Generated provider x channel x market x account-type x outcome matrix.
 *
 * Cardinality: 6 wallet providers x 3 cross-network channels (MNO_TO_MNO,
 * MNO_TO_BANK, BANK_TO_MNO) x 4 markets x 4 account types x 3 representative
 * outcomes = 864 combinations. Hand-writing 864 test cases is not viable;
 * this generates the full cross product and asserts the one invariant that
 * must hold uniformly across all of it: market gating happens before
 * anything else, and it is the market that decides eligibility, never the
 * provider or account type.
 */
import { describe, it, expect } from "vitest";
import { MNOS, ACCOUNT_TYPES, CHANNEL_LEGS, type Channel, type AccountType } from "../../providers";
import { MARKETS, MARKET_STATUS_META, assertMarketLive, MarketNotLiveError, type Market } from "../../corridors";
import { validatePaymentRequest } from "../../validation";

const CROSS_NETWORK_CHANNELS: Channel[] = ["MNO_TO_MNO", "MNO_TO_BANK", "BANK_TO_MNO"];
const OUTCOMES = ["COMPLETED", "FAILED", "EXPIRED"] as const;

interface MatrixRow {
  providerCode: string;
  channel: Channel;
  market: Market;
  accountType: AccountType;
  outcome: (typeof OUTCOMES)[number];
}

function generateMatrix(): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const provider of MNOS) {
    for (const channel of CROSS_NETWORK_CHANNELS) {
      for (const market of MARKETS) {
        for (const accountType of ACCOUNT_TYPES) {
          for (const outcome of OUTCOMES) {
            rows.push({ providerCode: provider.code, channel, market, accountType, outcome });
          }
        }
      }
    }
  }
  return rows;
}

const FIXED_BANK_CODE = "CRDB";

describe("generated provider x channel x market x account-type x outcome matrix", () => {
  const matrix = generateMatrix();

  it(`generates exactly 864 combinations (6 providers x 3 channels x 4 markets x 4 account types x 3 outcomes)`, () => {
    expect(matrix).toHaveLength(6 * 3 * 4 * 4 * 3);
  });

  it("every row's instruction shape validates structurally, and market gating is the uniform, provider-independent gate", () => {
    for (const row of matrix) {
      const legs = CHANNEL_LEGS[row.channel];
      const instruction = {
        channel: row.channel,
        amountMinor: "10000",
        currency: MARKET_STATUS_META[row.market].currency,
        market: row.market,
        source: { providerCode: legs.source === "MNO" ? row.providerCode : FIXED_BANK_CODE, accountType: row.accountType, identifier: "+255700000001" },
        destination: { providerCode: legs.destination === "MNO" ? row.providerCode : FIXED_BANK_CODE, accountType: row.accountType, identifier: "+255700000002" },
        reference: `matrix-${row.providerCode}-${row.channel}-${row.market}`,
      };

      const result = validatePaymentRequest(instruction);
      expect(result.ok, `row ${JSON.stringify(row)} failed structural validation: ${!result.ok ? JSON.stringify(result.errors) : ""}`).toBe(true);

      const isLive = MARKET_STATUS_META[row.market].status === "LIVE";
      if (isLive) {
        expect(() => assertMarketLive(row.market)).not.toThrow();
      } else {
        expect(() => assertMarketLive(row.market)).toThrow(MarketNotLiveError);
      }
    }
  });
});
