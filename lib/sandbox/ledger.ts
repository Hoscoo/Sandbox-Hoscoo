/**
 * Double-entry mock ledger. Every posting is a balanced DEBIT/CREDIT pair
 * within a single currency — cross-currency movements (cross-border) are
 * always two separate same-currency-balanced postings, never one posting
 * that "balances" only after an implicit conversion. This is what makes
 * per-currency balance assertions meaningful (see assertCurrencyBalanced).
 *
 * FX arithmetic itself is NOT reimplemented here — quoteSandboxFx supplies a
 * fixed, deterministic rate to lib/corridors.ts's quoteFx, which owns the
 * actual spread/rounding math shared with production.
 */
import { randomUUID } from "node:crypto";
import { CURRENCIES, CURRENCY_META, quoteFx, type CurrencyCode, type FxQuote } from "../corridors";
import { HoscooApiError } from "../errors";
import { sandboxStore, type LedgerEntry, type SandboxStore } from "./store";

export const SANDBOX_TENANT_TTL_MS = 24 * 60 * 60 * 1000; // 24h — documented reset/expiry policy for sandbox tenants.

const SEED_BALANCES_MINOR: Record<CurrencyCode, bigint> = {
  TZS: 10_000_000_00n, // TSh 10,000,000.00
  KES: 5_000_000_00n, // KSh 5,000,000.00
  UGX: 20_000_000n, // USh 20,000,000 (zero-decimal)
  RWF: 15_000_000n, // FRw 15,000,000 (zero-decimal)
};

/**
 * Fixed, documented sandbox rates as integer ratios (never floats), keyed by
 * corridor id. Reproducible: the same corridor + amount always quotes the
 * same credited amount. Adverse-movement scenarios use a second, separate
 * table rather than perturbing this one, so the default path stays stable.
 */
export const SANDBOX_FX_RATES: Record<string, { numerator: bigint; denominator: bigint }> = {
  "TZ-KE": { numerator: 555n, denominator: 100_000n }, // 1 TZS ~= 0.00555 KES
  "TZ-UG": { numerator: 148n, denominator: 10_000n }, // 1 TZS ~= 0.0148 UGX
  "TZ-RW": { numerator: 52n, denominator: 1_000n }, // 1 TZS ~= 0.052 RWF
};

export const ADVERSE_SANDBOX_FX_RATES: Record<string, { numerator: bigint; denominator: bigint }> = {
  "TZ-KE": { numerator: 500n, denominator: 100_000n },
  "TZ-UG": { numerator: 130n, denominator: 10_000n },
  "TZ-RW": { numerator: 46n, denominator: 1_000n },
};

export function sandboxBaseRate(corridorId: string, opts?: { adverse?: boolean }) {
  const table = opts?.adverse ? ADVERSE_SANDBOX_FX_RATES : SANDBOX_FX_RATES;
  const rate = table[corridorId];
  if (!rate) throw new Error(`No deterministic sandbox rate configured for corridor ${corridorId}`);
  return rate;
}

/** Deterministic sandbox FX quote. `adverse: true` is the deliberate opt-in for rate-movement test scenarios. */
export function quoteSandboxFx(input: {
  corridorId: string;
  amountMinor: bigint;
  now: Date;
  adverse?: boolean;
  ttlSeconds?: number;
}): FxQuote {
  const rate = sandboxBaseRate(input.corridorId, { adverse: input.adverse });
  return quoteFx({
    corridorId: input.corridorId,
    amountMinor: input.amountMinor,
    baseRateNumerator: rate.numerator,
    baseRateDenominator: rate.denominator,
    quoteId: `hsc_quote_${randomUUID()}`,
    now: input.now,
    ttlSeconds: input.ttlSeconds,
  });
}

// ---------------------------------------------------------------------------
// Account model: one WALLET (customer-facing) and one CLEARING (counterparty)
// account per tenant per currency. Every posting balances within one of
// these currency's two accounts.
// ---------------------------------------------------------------------------

function accountId(apiKey: string, currency: CurrencyCode, kind: "WALLET" | "CLEARING" | "FEE_INCOME" | "CORRIDOR_OUT") {
  return `${apiKey}:${currency}:${kind}`;
}

async function ensureAccount(
  store: SandboxStore,
  apiKey: string,
  currency: CurrencyCode,
  kind: "WALLET" | "CLEARING" | "FEE_INCOME" | "CORRIDOR_OUT",
  now: Date,
) {
  const id = accountId(apiKey, currency, kind);
  const existing = (await store.listAccounts(apiKey)).find((a) => a.accountId === id);
  if (existing) return existing;
  const account = {
    apiKey,
    currency,
    accountId: id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SANDBOX_TENANT_TTL_MS).toISOString(),
  };
  await store.putAccount(account);
  return account;
}

async function post(
  store: SandboxStore,
  apiKey: string,
  currency: CurrencyCode,
  debitAccountId: string,
  creditAccountId: string,
  amountMinor: bigint,
  transactionId: string,
  now: Date,
) {
  if (amountMinor < 0n) throw new Error("amountMinor must be non-negative");
  const postedAt = now.toISOString();
  const entries: LedgerEntry[] = [
    { id: randomUUID(), apiKey, accountId: debitAccountId, currency, direction: "DEBIT", amountMinor, transactionId, postedAt },
    { id: randomUUID(), apiKey, accountId: creditAccountId, currency, direction: "CREDIT", amountMinor, transactionId, postedAt },
  ];
  await store.appendEntries(entries);
}

async function accountBalance(store: SandboxStore, apiKey: string, accountId: string, currency: CurrencyCode): Promise<bigint> {
  const entries = await store.listEntries(apiKey, currency);
  let balance = 0n;
  for (const e of entries) {
    if (e.accountId !== accountId) continue;
    balance += e.direction === "CREDIT" ? e.amountMinor : -e.amountMinor;
  }
  return balance;
}

/** Creates all four currency wallets for a tenant, seeded via a balanced double-entry posting, if they don't already exist. */
export async function ensureTenant(apiKey: string, now: Date = new Date(), store: SandboxStore = sandboxStore): Promise<void> {
  for (const currency of CURRENCIES) {
    const wallet = accountId(apiKey, currency, "WALLET");
    const existing = (await store.listAccounts(apiKey)).find((a) => a.accountId === wallet);
    if (existing) continue;
    await ensureAccount(store, apiKey, currency, "WALLET", now);
    await ensureAccount(store, apiKey, currency, "CLEARING", now);
    await post(store, apiKey, currency, accountId(apiKey, currency, "CLEARING"), wallet, SEED_BALANCES_MINOR[currency], `seed_${apiKey}_${currency}`, now);
  }
}

export async function getWalletBalance(apiKey: string, currency: CurrencyCode, store: SandboxStore = sandboxStore): Promise<bigint> {
  return accountBalance(store, apiKey, accountId(apiKey, currency, "WALLET"), currency);
}

export async function debitWallet(
  apiKey: string,
  currency: CurrencyCode,
  amountMinor: bigint,
  transactionId: string,
  now: Date = new Date(),
  store: SandboxStore = sandboxStore,
): Promise<void> {
  const balance = await getWalletBalance(apiKey, currency, store);
  if (balance < amountMinor) {
    throw new HoscooApiError("INSUFFICIENT_FUNDS", `Wallet balance ${balance} is insufficient for debit of ${amountMinor} ${currency}`, 422);
  }
  await ensureAccount(store, apiKey, currency, "CLEARING", now);
  await post(store, apiKey, currency, accountId(apiKey, currency, "WALLET"), accountId(apiKey, currency, "CLEARING"), amountMinor, transactionId, now);
}

export async function creditWallet(
  apiKey: string,
  currency: CurrencyCode,
  amountMinor: bigint,
  transactionId: string,
  now: Date = new Date(),
  store: SandboxStore = sandboxStore,
): Promise<void> {
  await ensureAccount(store, apiKey, currency, "CLEARING", now);
  await post(store, apiKey, currency, accountId(apiKey, currency, "CLEARING"), accountId(apiKey, currency, "WALLET"), amountMinor, transactionId, now);
}

/**
 * Cross-border settlement: two independent same-currency-balanced postings.
 * The source-currency leg debits the wallet for the principal plus the rail
 * fee; the destination-currency leg records the payout via CORRIDOR_OUT.
 * Neither posting "balances" against the other — that is the point.
 */
export async function postCrossBorderSettlement(
  apiKey: string,
  quote: FxQuote,
  feeMinor: bigint,
  transactionId: string,
  now: Date = new Date(),
  store: SandboxStore = sandboxStore,
): Promise<void> {
  await debitWallet(apiKey, quote.fromCurrency, quote.amountMinor, transactionId, now, store);
  if (feeMinor > 0n) {
    await ensureAccount(store, apiKey, quote.fromCurrency, "FEE_INCOME", now);
    await post(
      store,
      apiKey,
      quote.fromCurrency,
      accountId(apiKey, quote.fromCurrency, "WALLET"),
      accountId(apiKey, quote.fromCurrency, "FEE_INCOME"),
      feeMinor,
      transactionId,
      now,
    );
    const balance = await getWalletBalance(apiKey, quote.fromCurrency, store);
    if (balance < 0n) {
      throw new HoscooApiError("INSUFFICIENT_FUNDS", `Wallet balance went negative after fee debit for ${quote.fromCurrency}`, 422);
    }
  }
  await ensureAccount(store, apiKey, quote.toCurrency, "CLEARING", now);
  await ensureAccount(store, apiKey, quote.toCurrency, "CORRIDOR_OUT", now);
  await post(
    store,
    apiKey,
    quote.toCurrency,
    accountId(apiKey, quote.toCurrency, "CLEARING"),
    accountId(apiKey, quote.toCurrency, "CORRIDOR_OUT"),
    quote.creditedMinor,
    transactionId,
    now,
  );
}

/**
 * Per-currency balance invariant: sum of every entry for this tenant in this
 * currency, across ALL accounts (wallet, clearing, fee income, corridor
 * out), must net to exactly zero. A ledger that only balances after
 * cross-currency conversion is not balanced — this check never converts.
 */
export async function assertCurrencyBalanced(apiKey: string, currency: CurrencyCode, store: SandboxStore = sandboxStore): Promise<void> {
  const entries = await store.listEntries(apiKey, currency);
  const net = entries.reduce((sum, e) => sum + (e.direction === "CREDIT" ? e.amountMinor : -e.amountMinor), 0n);
  if (net !== 0n) {
    throw new Error(`Ledger imbalance for ${apiKey} in ${currency}: net ${net} (exponent ${CURRENCY_META[currency].exponent})`);
  }
}

export async function resetTenant(apiKey: string, now: Date = new Date(), store: SandboxStore = sandboxStore): Promise<void> {
  await store.deleteTenant(apiKey);
  await ensureTenant(apiKey, now, store);
}
