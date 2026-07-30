/**
 * Durable SandboxStore implementation, satisfying the exact interface
 * lib/sandbox/ledger.ts is written against — no call site outside
 * lib/sandbox/store.ts needs to change to use this instead of
 * InMemorySandboxStore. See lib/sandbox/db/__tests__/postgres-store.test.ts
 * for a live test proving state survives across separate store instances
 * (i.e. survives what a serverless cold start would do to an in-memory Map).
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { sandboxAccounts, sandboxLedgerEntries } from "./schema";
import type { CurrencyCode } from "../../corridors";
import type { SandboxAccount, SandboxStore, LedgerEntry } from "../store";

export class PostgresSandboxStore implements SandboxStore {
  private db: ReturnType<typeof getDb>;

  constructor(connectionString?: string) {
    this.db = getDb(connectionString);
  }

  async putAccount(account: SandboxAccount): Promise<void> {
    await this.db
      .insert(sandboxAccounts)
      .values({
        accountId: account.accountId,
        apiKey: account.apiKey,
        currency: account.currency,
        createdAt: new Date(account.createdAt),
        expiresAt: new Date(account.expiresAt),
      })
      .onConflictDoUpdate({
        target: sandboxAccounts.accountId,
        set: { expiresAt: new Date(account.expiresAt) },
      });
  }

  async listAccounts(apiKey: string): Promise<SandboxAccount[]> {
    const rows = await this.db.select().from(sandboxAccounts).where(eq(sandboxAccounts.apiKey, apiKey));
    return rows.map(toSandboxAccount);
  }

  async appendEntries(entries: LedgerEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.db.insert(sandboxLedgerEntries).values(
      entries.map((e) => ({
        id: e.id,
        apiKey: e.apiKey,
        accountId: e.accountId,
        currency: e.currency,
        direction: e.direction,
        amountMinor: e.amountMinor,
        transactionId: e.transactionId,
        postedAt: new Date(e.postedAt),
      })),
    );
  }

  async listEntries(apiKey: string, currency?: CurrencyCode): Promise<LedgerEntry[]> {
    const rows = await this.db
      .select()
      .from(sandboxLedgerEntries)
      .where(currency ? and(eq(sandboxLedgerEntries.apiKey, apiKey), eq(sandboxLedgerEntries.currency, currency)) : eq(sandboxLedgerEntries.apiKey, apiKey));
    return rows.map(toLedgerEntry);
  }

  async deleteTenant(apiKey: string): Promise<void> {
    await this.db.delete(sandboxLedgerEntries).where(eq(sandboxLedgerEntries.apiKey, apiKey));
    await this.db.delete(sandboxAccounts).where(eq(sandboxAccounts.apiKey, apiKey));
  }

  async sweepExpired(now: Date): Promise<number> {
    const rows = await this.db.select().from(sandboxAccounts);
    const expiredKeys = new Set<string>();
    for (const row of rows) {
      if (row.expiresAt.getTime() <= now.getTime()) expiredKeys.add(row.apiKey);
    }
    for (const apiKey of expiredKeys) {
      await this.deleteTenant(apiKey);
    }
    return expiredKeys.size;
  }

  async listTenantKeys(): Promise<string[]> {
    const rows = await this.db.selectDistinct({ apiKey: sandboxAccounts.apiKey }).from(sandboxAccounts);
    return rows.map((r) => r.apiKey);
  }
}

function toSandboxAccount(row: typeof sandboxAccounts.$inferSelect): SandboxAccount {
  return {
    accountId: row.accountId,
    apiKey: row.apiKey,
    currency: row.currency as CurrencyCode,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

function toLedgerEntry(row: typeof sandboxLedgerEntries.$inferSelect): LedgerEntry {
  return {
    id: row.id,
    apiKey: row.apiKey,
    accountId: row.accountId,
    currency: row.currency as CurrencyCode,
    direction: row.direction as "DEBIT" | "CREDIT",
    amountMinor: row.amountMinor,
    transactionId: row.transactionId,
    postedAt: row.postedAt.toISOString(),
  };
}
