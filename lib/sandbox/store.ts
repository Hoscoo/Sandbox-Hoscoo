/**
 * SandboxStore: the narrow persistence boundary lib/sandbox/ledger.ts is
 * written against. lib/sandbox/db/postgres-store.ts implements this
 * interface against a real Postgres/Neon database via Drizzle — see the
 * store selection at the bottom of this file. InMemorySandboxStore below
 * remains as the fallback when DATABASE_URL is unset (local dev without a
 * database, or a deployment that hasn't provisioned one yet): a serverless
 * function's in-memory state does not survive between invocations, so a
 * multi-step sandbox lifecycle test (initiate -> poll -> webhook -> replay)
 * can silently reset mid-sequence under that fallback. No call site outside
 * this file and lib/sandbox/db/ should ever touch storage directly —
 * everything else imports the `sandboxStore` singleton exported below.
 */
import type { CurrencyCode } from "../corridors";
import { PostgresSandboxStore } from "./db/postgres-store";

export interface SandboxAccount {
  apiKey: string;
  currency: CurrencyCode;
  accountId: string;
  createdAt: string;
  expiresAt: string;
}

export type EntryDirection = "DEBIT" | "CREDIT";

export interface LedgerEntry {
  id: string;
  apiKey: string;
  accountId: string;
  currency: CurrencyCode;
  direction: EntryDirection;
  amountMinor: bigint;
  transactionId: string;
  postedAt: string;
}

export interface SandboxStore {
  putAccount(account: SandboxAccount): Promise<void>;
  listAccounts(apiKey: string): Promise<SandboxAccount[]>;
  appendEntries(entries: LedgerEntry[]): Promise<void>;
  listEntries(apiKey: string, currency?: CurrencyCode): Promise<LedgerEntry[]>;
  deleteTenant(apiKey: string): Promise<void>;
  /** Removes all tenant data past its TTL. Returns the number of tenants swept. */
  sweepExpired(now: Date): Promise<number>;
  listTenantKeys(): Promise<string[]>;
}

export class InMemorySandboxStore implements SandboxStore {
  // Keyed by the account's own accountId (already globally unique:
  // `${apiKey}:${currency}:${kind}`, see lib/sandbox/ledger.ts's
  // accountId()). A previous version keyed this Map by `${apiKey}:${currency}`
  // alone, which silently collapsed a tenant's WALLET and CLEARING accounts
  // for the same currency into one Map slot — each putAccount() call
  // overwrote the other, so ensureTenant()'s "does the wallet already
  // exist" check kept failing and reseeded the wallet balance on every
  // single call. Caught by lib/sandbox/__tests__/challenge.test.ts.
  private accounts = new Map<string, SandboxAccount>();
  private entries = new Map<string, LedgerEntry[]>(); // key: apiKey

  async putAccount(account: SandboxAccount) {
    this.accounts.set(account.accountId, account);
  }

  async listAccounts(apiKey: string) {
    return Array.from(this.accounts.values()).filter((a) => a.apiKey === apiKey);
  }

  async appendEntries(entries: LedgerEntry[]) {
    for (const entry of entries) {
      const existing = this.entries.get(entry.apiKey) ?? [];
      existing.push(entry);
      this.entries.set(entry.apiKey, existing);
    }
  }

  async listEntries(apiKey: string, currency?: CurrencyCode) {
    const all = this.entries.get(apiKey) ?? [];
    return currency ? all.filter((e) => e.currency === currency) : all;
  }

  async deleteTenant(apiKey: string) {
    this.entries.delete(apiKey);
    for (const [key, account] of Array.from(this.accounts.entries())) {
      if (account.apiKey === apiKey) this.accounts.delete(key);
    }
  }

  async sweepExpired(now: Date) {
    const expiredKeys = new Set<string>();
    for (const account of this.accounts.values()) {
      if (new Date(account.expiresAt).getTime() <= now.getTime()) {
        expiredKeys.add(account.apiKey);
      }
    }
    for (const apiKey of expiredKeys) {
      await this.deleteTenant(apiKey);
    }
    return expiredKeys.size;
  }

  async listTenantKeys() {
    return Array.from(new Set(Array.from(this.accounts.values()).map((a) => a.apiKey)));
  }
}

/**
 * Store selection: DATABASE_URL present -> durable PostgresSandboxStore
 * (Neon-compatible, see lib/sandbox/db/client.ts). Otherwise falls back to
 * the in-memory stopgap above, with the durability caveat that implies. This
 * is the only place that decides which adapter backs `sandboxStore` — every
 * ledger.ts function defaults its `store` parameter to this singleton, so
 * switching backends is a one-line change here, not a call-site change.
 * Constructing PostgresSandboxStore does not eagerly connect (the
 * underlying `pg.Pool` connects lazily on first query), so this is safe to
 * evaluate at module load even before any request has read DATABASE_URL.
 */
export const sandboxStore: SandboxStore = process.env.DATABASE_URL
  ? new PostgresSandboxStore(process.env.DATABASE_URL)
  : new InMemorySandboxStore();
