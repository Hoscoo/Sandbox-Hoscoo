/**
 * Live integration test against a real Postgres database (see
 * docker-compose.yml — `docker compose up -d db` then
 * DATABASE_URL=postgres://postgres:hoscoo@localhost:55432/hoscoo npm run
 * db:push before running this file). Skips itself when DATABASE_URL is
 * unset so CI without a provisioned database doesn't fail on this file —
 * every other test in the suite runs against InMemorySandboxStore and does
 * not need a database.
 *
 * The whole point of this test: two SEPARATELY CONSTRUCTED
 * PostgresSandboxStore instances, standing in for two different serverless
 * invocations (a "cold start" between them), must see the same ledger
 * state. That is exactly the property InMemorySandboxStore cannot provide.
 */
import { describe, it, expect, afterAll } from "vitest";
import { PostgresSandboxStore } from "../postgres-store";
import { closeDb } from "../client";
import { ensureTenant, getWalletBalance, debitWallet, assertCurrencyBalanced } from "../../ledger";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("PostgresSandboxStore (live database)", () => {
  const apiKey = `hsc_test_pg_suite_${Date.now()}`;

  afterAll(async () => {
    const cleanup = new PostgresSandboxStore(DATABASE_URL);
    await cleanup.deleteTenant(apiKey);
    await closeDb();
  });

  it("state written by one store instance is visible from a separately constructed instance", async () => {
    const now = new Date("2026-01-01T00:00:00Z");

    const storeA = new PostgresSandboxStore(DATABASE_URL);
    await ensureTenant(apiKey, now, storeA);
    const seeded = await getWalletBalance(apiKey, "TZS", storeA);
    await debitWallet(apiKey, "TZS", 50_00n, "pg-tx-1", now, storeA);

    // A brand-new instance — nothing in-process is shared with storeA except the database itself.
    const storeB = new PostgresSandboxStore(DATABASE_URL);
    const balanceFromB = await getWalletBalance(apiKey, "TZS", storeB);

    expect(balanceFromB).toBe(seeded - 50_00n);
    await assertCurrencyBalanced(apiKey, "TZS", storeB);
  });

  it("listAccounts and listEntries round-trip through real Postgres rows, preserving bigint amounts exactly", async () => {
    const store = new PostgresSandboxStore(DATABASE_URL);
    const accounts = await store.listAccounts(apiKey);
    expect(accounts.length).toBeGreaterThan(0);

    const entries = await store.listEntries(apiKey, "TZS");
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(typeof entry.amountMinor).toBe("bigint");
    }
  });

  it("deleteTenant removes both accounts and entries", async () => {
    const store = new PostgresSandboxStore(DATABASE_URL);
    const tempKey = `hsc_test_pg_delete_${Date.now()}`;
    await ensureTenant(tempKey, new Date(), store);
    expect((await store.listAccounts(tempKey)).length).toBeGreaterThan(0);

    await store.deleteTenant(tempKey);
    expect(await store.listAccounts(tempKey)).toHaveLength(0);
    expect(await store.listEntries(tempKey)).toHaveLength(0);
  });
});
