/**
 * Deterministic fixture table: every magic identifier a developer can use to
 * force a specific outcome, plus the special-case fixtures called out
 * explicitly in the sandbox spec (on-us rejection, ported numbers, multi-
 * provider MSISDNs, cross-border edge cases). This is documentation-as-code —
 * app/sandbox/fixtures/page.tsx renders this table directly, so the docs and
 * the actual magic values can never drift apart.
 *
 * The full provider x channel x market x account-type x outcome combination
 * matrix (6 providers x 3 cross-network channels x 4 markets x 4 account
 * types x ~9 outcomes) is generated, not hand-written — see
 * lib/sandbox/__tests__/matrix.test.ts for the generator and its documented
 * cardinality.
 */
import { MNOS, BANKS, CARD_SCHEMES } from "../providers";

export type FixtureCategory =
  | "WALLET_TO_WALLET"
  | "BANK_TO_BANK"
  | "GATEWAY_CHECKOUT"
  | "CROSS_BORDER";

export interface Fixture {
  id: string;
  category: FixtureCategory;
  label: string;
  description: string;
  /** The value to place in the relevant field (MSISDN, account number, PAN, or quoteId) to trigger this fixture. */
  magicValue: string;
  expectedOutcome: string;
}

// ---------------------------------------------------------------------------
// Wallet-to-wallet: one designated MSISDN per provider producing a clean
// success, so every provider has at least one working end-to-end fixture.
// ---------------------------------------------------------------------------

export const WALLET_SUCCESS_FIXTURES: Fixture[] = MNOS.map((mno, i) => ({
  id: `wallet-success-${mno.code.toLowerCase()}`,
  category: "WALLET_TO_WALLET",
  label: `${mno.displayName} — success`,
  description: `Designated MSISDN for ${mno.displayName} that always completes successfully.`,
  magicValue: `+255700000${(200 + i).toString()}`,
  expectedOutcome: "COMPLETED",
}));

export const WALLET_LIFECYCLE_FIXTURES: Fixture[] = [
  { id: "wallet-insufficient-funds", category: "WALLET_TO_WALLET", label: "Insufficient funds", description: "Source wallet balance is too low.", magicValue: "+255700000101", expectedOutcome: "FAILED: INSUFFICIENT_FUNDS" },
  { id: "wallet-timeout", category: "WALLET_TO_WALLET", label: "Timeout", description: "Destination provider never responds within the SLA window.", magicValue: "+255700000102", expectedOutcome: "FAILED: TIMEOUT" },
  { id: "wallet-expiry", category: "WALLET_TO_WALLET", label: "Authorization expiry", description: "Customer never completes authorization before the window closes.", magicValue: "+255700000103", expectedOutcome: "EXPIRED" },
  { id: "wallet-alias-unmapped", category: "WALLET_TO_WALLET", label: "Alias unmapped", description: "Destination identifier has no resolvable account.", magicValue: "+255700000104", expectedOutcome: "FAILED: ALIAS_UNMAPPED" },
  { id: "wallet-3ds-challenge", category: "WALLET_TO_WALLET", label: "3-DS challenge", description: "Forces a step-up authorization challenge (app-push/USSD PIN prompt).", magicValue: "+255700000105", expectedOutcome: "CHALLENGE_ISSUED" },
  { id: "wallet-3ds-failure", category: "WALLET_TO_WALLET", label: "3-DS challenge failure", description: "Customer fails the step-up challenge.", magicValue: "+255700000106", expectedOutcome: "FAILED: THREE_DS_CHALLENGE_FAILED" },
  { id: "wallet-rail-unavailable", category: "WALLET_TO_WALLET", label: "Rail unavailable", description: "Simulates the MNO interconnect being down for this instruction.", magicValue: "+255700000107", expectedOutcome: "FAILED: RAIL_UNAVAILABLE" },
  { id: "wallet-debit-credit-fail", category: "WALLET_TO_WALLET", label: "Debit succeeded, credit failed", description: "Source debit clears, destination credit fails — the exact case merchant reconciliation must catch.", magicValue: "+255700000108", expectedOutcome: "FAILED: DEBIT_SUCCEEDED_CREDIT_FAILED" },
];

export const WALLET_SPECIAL_CASE_FIXTURES: Fixture[] = [
  {
    id: "wallet-same-provider-on-us",
    category: "WALLET_TO_WALLET",
    label: "Same-provider transfer rejected",
    description: `Two ${MNOS[0]!.displayName} numbers on a MNO_TO_MNO instruction. This is an on-us book transfer, never a cross-network route — must be rejected with SAME_PROVIDER_ON_US before any routing decision.`,
    magicValue: "+255740000001 -> +255740000002 (both MPESA_TZ)",
    expectedOutcome: "REJECTED: SAME_PROVIDER_ON_US",
  },
  {
    id: "wallet-ported-number-disagreement",
    category: "WALLET_TO_WALLET",
    label: "Ported number: prefix disagrees with declared provider",
    description:
      "MSISDN +255650009999 carries a TIGO_PESA prefix (65) but the request declares providerCode AIRTEL_MONEY (the number ported). detectMnoFromMsisdn returns TIGO_PESA; the instruction must still route on the declared AIRTEL_MONEY code, proving prefix is never used as a correctness control.",
    magicValue: "+255650009999 declared as AIRTEL_MONEY",
    expectedOutcome: "COMPLETED (routed on declared provider, not detected prefix)",
  },
  {
    id: "wallet-multi-provider-msisdn",
    category: "WALLET_TO_WALLET",
    label: "MSISDN resolves at two providers",
    description:
      "MSISDN +255740005555 matches MPESA_TZ by prefix (74) and can also be legitimately declared as SELCOM_PESA (which owns no prefix range and therefore never conflicts by construction). Both requests are valid; the declared providerCode alone decides.",
    magicValue: "+255740005555 declared as MPESA_TZ or SELCOM_PESA",
    expectedOutcome: "COMPLETED (either provider, per declared providerCode)",
  },
  {
    id: "wallet-unregistered-destination",
    category: "WALLET_TO_WALLET",
    label: "Unregistered destination",
    description: "Destination MSISDN has no wallet account with the declared provider at all.",
    magicValue: "+255760009999",
    expectedOutcome: "FAILED: ALIAS_UNMAPPED",
  },
  {
    id: "wallet-non-ussd-auth",
    category: "WALLET_TO_WALLET",
    label: "Non-USSD authorization",
    description: `${MNOS.find((m) => !m.capabilities.ussdPush)!.displayName} cannot authorize via USSD — Test Bank must render its app-push/agent-assisted variant, never a generic PIN prompt.`,
    magicValue: "+255700000300 declared as SELCOM_PESA",
    expectedOutcome: "COMPLETED (via app-push authorization variant)",
  },
];

// ---------------------------------------------------------------------------
// Bank-to-bank / gateway
// ---------------------------------------------------------------------------

export const BANK_FIXTURES: Fixture[] = [
  { id: "bank-tips-success", category: "BANK_TO_BANK", label: "TIPS alias resolves", description: `Resolves via the ${BANKS[0]!.displayName} TIPS directory entry.`, magicValue: "+255700000001", expectedOutcome: "COMPLETED" },
  { id: "bank-tips-unmapped", category: "BANK_TO_BANK", label: "TIPS alias unmapped", description: "No TIPS directory entry for this alias.", magicValue: "+255700099999", expectedOutcome: "FAILED: ALIAS_UNMAPPED" },
];

export const GATEWAY_FIXTURES: Fixture[] = [
  { id: "card-success", category: "GATEWAY_CHECKOUT", label: `${CARD_SCHEMES[0]!.displayName} success`, description: "Passes Luhn and authorizes cleanly.", magicValue: "4242424242424242", expectedOutcome: "COMPLETED" },
  { id: "card-3ds-challenge", category: "GATEWAY_CHECKOUT", label: "3-DS challenge", description: "Card requires step-up authentication.", magicValue: "4000000000003220", expectedOutcome: "CHALLENGE_ISSUED" },
  { id: "card-3ds-failure", category: "GATEWAY_CHECKOUT", label: "3-DS failure", description: "Card fails step-up authentication.", magicValue: "4000000000003063", expectedOutcome: "FAILED: THREE_DS_CHALLENGE_FAILED" },
  { id: "card-insufficient-funds", category: "GATEWAY_CHECKOUT", label: "Insufficient funds", description: "Issuer declines for insufficient funds.", magicValue: "4000000000009995", expectedOutcome: "FAILED: INSUFFICIENT_FUNDS" },
];

// ---------------------------------------------------------------------------
// Cross-border — one set per corridor, using magic quoteId values (see
// lib/sandbox/simulation.ts MAGIC_QUOTE_ID_OUTCOMES).
// ---------------------------------------------------------------------------

export const CROSS_BORDER_FIXTURES: Fixture[] = [
  { id: "xborder-tz-ke-success", category: "CROSS_BORDER", label: "TZ -> KE success", description: "Standard corridor settlement, two-decimal currencies on both sides.", magicValue: "corridor=TZ-KE, quoteId=<normal>", expectedOutcome: "COMPLETED" },
  { id: "xborder-planned-market", category: "CROSS_BORDER", label: "Originating market not LIVE", description: "Instruction declares market=KE as the originating market. Only TZ is LIVE — rejected before any quote, alias lookup, or ledger posting.", magicValue: "market=KE", expectedOutcome: "REJECTED: MARKET_NOT_LIVE" },
  { id: "xborder-tz-ug-zero-decimal", category: "CROSS_BORDER", label: "Zero-decimal destination (UGX)", description: "Exercises CURRENCY_META.UGX exponent=0 — no fractional units, no naive /100.", magicValue: "corridor=TZ-UG, amountMinor=1250000", expectedOutcome: "COMPLETED" },
  { id: "xborder-tz-rw-zero-decimal", category: "CROSS_BORDER", label: "Zero-decimal destination (RWF)", description: "Exercises CURRENCY_META.RWF exponent=0.", magicValue: "corridor=TZ-RW, amountMinor=980000", expectedOutcome: "COMPLETED" },
  { id: "xborder-quote-expired", category: "CROSS_BORDER", label: "Quote expired mid-flight", description: "Execution attempted after the quote's expiresAt.", magicValue: "quoteId=hsc_quote_expired", expectedOutcome: "REJECTED: QUOTE_EXPIRED" },
  { id: "xborder-adverse-rate", category: "CROSS_BORDER", label: "Adverse rate movement", description: "Rate moved against the customer between quote and execution — reversed rather than silently re-quoted.", magicValue: "quoteId=hsc_quote_adverse", expectedOutcome: "REJECTED: RATE_MOVED" },
  { id: "xborder-liquidity-exhausted", category: "CROSS_BORDER", label: "Corridor liquidity exhausted", description: "Corridor's settlement-window liquidity cap has been used up.", magicValue: "quoteId=hsc_quote_illiquid", expectedOutcome: "REJECTED: CORRIDOR_LIQUIDITY_EXHAUSTED" },
  { id: "xborder-after-cutoff", category: "CROSS_BORDER", label: "Outside cut-off", description: "Request arrives after the corridor's daily cut-off hour.", magicValue: "quoteId=hsc_quote_after_cutoff", expectedOutcome: "REJECTED: OUTSIDE_CUTOFF" },
  {
    id: "xborder-rounding-residual",
    category: "CROSS_BORDER",
    label: "Rounding-residual amount",
    description:
      "amountMinor chosen so the raw rate multiplication does not divide evenly (e.g. 333333 minor units at a TZ-KE rate of 555/100000). quoteFx must round exactly once and leave no unexplained minor unit — see the money property tests.",
    magicValue: "corridor=TZ-KE, amountMinor=333333",
    expectedOutcome: "COMPLETED (creditedMinor rounds once, no residual)",
  },
];

export const ALL_FIXTURES: Fixture[] = [
  ...WALLET_SUCCESS_FIXTURES,
  ...WALLET_LIFECYCLE_FIXTURES,
  ...WALLET_SPECIAL_CASE_FIXTURES,
  ...BANK_FIXTURES,
  ...GATEWAY_FIXTURES,
  ...CROSS_BORDER_FIXTURES,
];
