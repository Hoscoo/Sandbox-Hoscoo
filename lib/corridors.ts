/**
 * Currency, market, corridor, FX, rail cost, and routing model.
 *
 * Money is always represented as bigint minor units. This module never uses
 * `number` or `toFixed` for an amount, and never assumes two decimal places —
 * decimal exponents are looked up from CURRENCY_META (UGX and RWF are zero-decimal).
 */

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

export const MARKETS = ["TZ", "KE", "UG", "RW"] as const;
export type Market = (typeof MARKETS)[number];

export type MarketStatus = "LIVE" | "PLANNED";

export const MARKET_STATUS_META: Record<
  Market,
  { status: MarketStatus; label: string; currency: CurrencyCode; dialCode: string }
> = {
  TZ: { status: "LIVE", label: "Tanzania", currency: "TZS", dialCode: "255" },
  KE: { status: "PLANNED", label: "Kenya", currency: "KES", dialCode: "254" },
  UG: { status: "PLANNED", label: "Uganda", currency: "UGX", dialCode: "256" },
  RW: { status: "PLANNED", label: "Rwanda", currency: "RWF", dialCode: "250" },
};

// ---------------------------------------------------------------------------
// Currencies
// ---------------------------------------------------------------------------

export const CURRENCIES = ["TZS", "KES", "UGX", "RWF"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<
  CurrencyCode,
  { code: CurrencyCode; name: string; symbol: string; exponent: number }
> = {
  TZS: { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", exponent: 2 },
  KES: { code: "KES", name: "Kenyan Shilling", symbol: "KSh", exponent: 2 },
  UGX: { code: "UGX", name: "Ugandan Shilling", symbol: "USh", exponent: 0 },
  RWF: { code: "RWF", name: "Rwandan Franc", symbol: "FRw", exponent: 0 },
};

/**
 * The single gate every entrypoint must call before quoting FX, resolving an
 * alias, or posting to the ledger. Throws rather than returning a boolean so
 * callers cannot accidentally ignore a PLANNED market.
 */
export function assertMarketLive(market: Market): void {
  if (MARKET_STATUS_META[market].status !== "LIVE") {
    throw new MarketNotLiveError(market);
  }
}

export class MarketNotLiveError extends Error {
  readonly market: Market;
  constructor(market: Market) {
    super(`Market ${market} is not LIVE (status: ${MARKET_STATUS_META[market].status})`);
    this.name = "MarketNotLiveError";
    this.market = market;
  }
}

export function marketFor(currency: CurrencyCode): Market {
  const entry = (Object.entries(MARKET_STATUS_META) as [Market, (typeof MARKET_STATUS_META)[Market]][]).find(
    ([, meta]) => meta.currency === currency,
  );
  if (!entry) throw new Error(`No market maps to currency ${currency}`);
  return entry[0];
}

/** Integer-safe minor-unit formatter. Never uses toFixed or float division. */
export function formatCurrency(amountMinor: bigint, currency: CurrencyCode): string {
  const { exponent, symbol } = CURRENCY_META[currency];
  const negative = amountMinor < 0n;
  const abs = negative ? -amountMinor : amountMinor;
  if (exponent === 0) {
    return `${negative ? "-" : ""}${symbol} ${abs.toLocaleString("en-US")}`;
  }
  const scale = 10n ** BigInt(exponent);
  const whole = abs / scale;
  const fraction = (abs % scale).toString().padStart(exponent, "0");
  return `${negative ? "-" : ""}${symbol} ${whole.toLocaleString("en-US")}.${fraction}`;
}

export function formatTzs(amountMinor: bigint): string {
  return formatCurrency(amountMinor, "TZS");
}

// ---------------------------------------------------------------------------
// Corridors (cross-border, always outbound from the sole LIVE market today)
// ---------------------------------------------------------------------------

export interface Corridor {
  id: string;
  from: Market;
  to: Market;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  /** Cut-off hour in UTC after which same-day settlement can no longer be quoted. */
  cutoffHourUtc: number;
  minAmountMinor: bigint;
  maxAmountMinor: bigint;
  /** Corridor liquidity ceiling per settlement window, in destination-currency minor units. */
  liquidityCapMinor: bigint;
}

export const CORRIDORS: Corridor[] = [
  {
    id: "TZ-KE",
    from: "TZ",
    to: "KE",
    fromCurrency: "TZS",
    toCurrency: "KES",
    cutoffHourUtc: 15,
    minAmountMinor: 1_000_00n,
    maxAmountMinor: 500_000_000_00n,
    liquidityCapMinor: 2_000_000_000_00n,
  },
  {
    id: "TZ-UG",
    from: "TZ",
    to: "UG",
    fromCurrency: "TZS",
    toCurrency: "UGX",
    cutoffHourUtc: 15,
    minAmountMinor: 1_000_00n,
    maxAmountMinor: 500_000_000_00n,
    liquidityCapMinor: 800_000_000n,
  },
  {
    id: "TZ-RW",
    from: "TZ",
    to: "RW",
    fromCurrency: "TZS",
    toCurrency: "RWF",
    cutoffHourUtc: 15,
    minAmountMinor: 1_000_00n,
    maxAmountMinor: 500_000_000_00n,
    liquidityCapMinor: 900_000_000n,
  },
];

/** Basis-point spread applied on top of mid rate, per corridor. Derived input to quoteFx, not baked into it. */
export function spreadBpsFor(corridorId: string): number {
  const known: Record<string, number> = { "TZ-KE": 75, "TZ-UG": 90, "TZ-RW": 90 };
  return known[corridorId] ?? 120;
}

// ---------------------------------------------------------------------------
// FX quoting
// ---------------------------------------------------------------------------

export interface FxQuote {
  quoteId: string;
  corridorId: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  amountMinor: bigint;
  /** Mid-market rate as an integer-ratio (numerator/denominator) — never a float. */
  midRateNumerator: bigint;
  midRateDenominator: bigint;
  spreadBps: number;
  /** Amount credited in destination currency after spread, rounded exactly once. */
  creditedMinor: bigint;
  issuedAt: string;
  expiresAt: string;
}

/**
 * Applies spread and rounds exactly once, using bigint arithmetic throughout.
 * `baseRateNumerator`/`baseRateDenominator` are supplied by the caller as an
 * integer ratio — production sources this from its rate provider, sandbox
 * sources it from a fixed deterministic table (lib/sandbox/ledger.ts). This
 * function owns the arithmetic and rounding rule; it does not own where the
 * base rate itself comes from, so both planes share identical FX math.
 */
export function quoteFx(input: {
  corridorId: string;
  amountMinor: bigint;
  baseRateNumerator: bigint;
  baseRateDenominator: bigint;
  quoteId: string;
  now: Date;
  ttlSeconds?: number;
}): FxQuote {
  const corridor = CORRIDORS.find((c) => c.id === input.corridorId);
  if (!corridor) throw new Error(`Unknown corridor ${input.corridorId}`);
  if (input.baseRateDenominator <= 0n) throw new Error("Invalid rate denominator");

  const spreadBps = spreadBpsFor(input.corridorId);
  // customerRate = midRate * (1 - spreadBps/10000), kept as an integer ratio
  // by folding the spread into numerator/denominator before the single
  // rounding step at the very end.
  const spreadNumerator = 10_000n - BigInt(spreadBps);
  const numerator = input.baseRateNumerator * spreadNumerator * input.amountMinor;
  const denominator = input.baseRateDenominator * 10_000n;

  // Single rounding point: half-up on the final integer division.
  const creditedMinor = (numerator + denominator / 2n) / denominator;

  const ttl = input.ttlSeconds ?? 120;
  const expiresAt = new Date(input.now.getTime() + ttl * 1000).toISOString();

  return {
    quoteId: input.quoteId,
    corridorId: input.corridorId,
    fromCurrency: corridor.fromCurrency,
    toCurrency: corridor.toCurrency,
    amountMinor: input.amountMinor,
    midRateNumerator: input.baseRateNumerator,
    midRateDenominator: input.baseRateDenominator,
    spreadBps,
    creditedMinor,
    issuedAt: input.now.toISOString(),
    expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Rails and cost routing
// ---------------------------------------------------------------------------

export const RAILS = ["MNO_INTERCONNECT", "TIPS", "CARD_SCHEME", "SWIFT", "CORRIDOR_SETTLEMENT"] as const;
export type Rail = (typeof RAILS)[number];

export type RailHealth = "HEALTHY" | "DEGRADED" | "DOWN";

export const RAIL_HEALTH_META: Record<RailHealth, { label: string; eligible: boolean }> = {
  HEALTHY: { label: "Healthy", eligible: true },
  DEGRADED: { label: "Degraded", eligible: true },
  DOWN: { label: "Unavailable", eligible: false },
};

interface RailFeeModel {
  flatMinor: bigint;
  bps: number;
}

const RAIL_FEE_MODEL: Record<Rail, RailFeeModel> = {
  MNO_INTERCONNECT: { flatMinor: 100n, bps: 90 },
  TIPS: { flatMinor: 50n, bps: 20 },
  CARD_SCHEME: { flatMinor: 0n, bps: 290 },
  SWIFT: { flatMinor: 2_500n, bps: 10 },
  CORRIDOR_SETTLEMENT: { flatMinor: 300n, bps: 150 },
};

/** Fee for carrying amountMinor over a rail, in the same currency's minor units. Derived, never hardcoded per-amount. */
export function railCost(rail: Rail, amountMinor: bigint): bigint {
  const model = RAIL_FEE_MODEL[rail];
  return model.flatMinor + (amountMinor * BigInt(model.bps)) / 10_000n;
}

/**
 * The amount at which `to` becomes cheaper than `from`, derived algebraically
 * from both fee curves rather than hardcoded. Returns null if `to` is never
 * cheaper (e.g. equal or higher bps with equal or higher flat fee).
 */
export function crossoverAmount(from: Rail, to: Rail): bigint | null {
  const a = RAIL_FEE_MODEL[from];
  const b = RAIL_FEE_MODEL[to];
  if (a.bps === b.bps) {
    return b.flatMinor < a.flatMinor ? 0n : null;
  }
  // flatA + bpsA*x/10000 = flatB + bpsB*x/10000
  // x * (bpsA - bpsB) / 10000 = flatB - flatA
  // x = (flatB - flatA) * 10000 / (bpsA - bpsB)
  const numerator = (b.flatMinor - a.flatMinor) * 10_000n;
  const denominator = BigInt(a.bps - b.bps);
  const x = numerator / denominator;
  return x < 0n ? 0n : x;
}

// ---------------------------------------------------------------------------
// Route selection — eligibility gates before cost, always.
// ---------------------------------------------------------------------------

export type CandidateStatus =
  | "ELIGIBLE"
  | "INELIGIBLE_MARKET_PLANNED"
  | "INELIGIBLE_RAIL_DOWN"
  | "INELIGIBLE_LIMIT";

export interface RouteCandidate {
  rail: Rail;
  status: CandidateStatus;
  costMinor: bigint | null;
}

export interface RouteDecision {
  selected: RouteCandidate | null;
  candidates: RouteCandidate[];
}

/**
 * Selects the cheapest rail among ELIGIBLE candidates only. Eligibility
 * (market status, rail health, amount limits) is evaluated for every
 * candidate before any cost comparison happens — a cheaper rail that is
 * ineligible must never be selected, and cost never participates in the
 * eligibility decision itself.
 */
export function selectRoute(input: {
  market: Market;
  amountMinor: bigint;
  minAmountMinor: bigint;
  maxAmountMinor: bigint;
  candidateRails: Rail[];
  railHealth: Record<Rail, RailHealth>;
}): RouteDecision {
  const marketStatus = MARKET_STATUS_META[input.market].status;

  const candidates: RouteCandidate[] = input.candidateRails.map((rail) => {
    if (marketStatus !== "LIVE") {
      return { rail, status: "INELIGIBLE_MARKET_PLANNED", costMinor: null };
    }
    if (!RAIL_HEALTH_META[input.railHealth[rail]].eligible) {
      return { rail, status: "INELIGIBLE_RAIL_DOWN", costMinor: null };
    }
    if (input.amountMinor < input.minAmountMinor || input.amountMinor > input.maxAmountMinor) {
      return { rail, status: "INELIGIBLE_LIMIT", costMinor: null };
    }
    return { rail, status: "ELIGIBLE", costMinor: railCost(rail, input.amountMinor) };
  });

  const eligible = candidates.filter((c) => c.status === "ELIGIBLE");
  if (eligible.length === 0) return { selected: null, candidates };

  const selected = eligible.reduce((cheapest, c) => ((c.costMinor as bigint) < (cheapest.costMinor as bigint) ? c : cheapest));
  return { selected, candidates };
}
