import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySandboxStore } from "../store";
import { ensureTenant, getWalletBalance, debitWallet, creditWallet, postCrossBorderSettlement, assertCurrencyBalanced, quoteSandboxFx } from "../ledger";
import { CURRENCIES } from "../../corridors";
import { railCost } from "../../corridors";

describe("double-entry mock ledger", () => {
  let store: InMemorySandboxStore;
  const apiKey = "hsc_test_ledger_suite";
  const now = new Date("2026-01-01T00:00:00Z");

  beforeEach(() => {
    store = new InMemorySandboxStore();
  });

  it("seeds balances for every currency via a balanced posting", async () => {
    await ensureTenant(apiKey, now, store);
    for (const currency of CURRENCIES) {
      const balance = await getWalletBalance(apiKey, currency, store);
      expect(balance).toBeGreaterThan(0n);
      await assertCurrencyBalanced(apiKey, currency, store); // must not throw
    }
  });

  it("ensureTenant is idempotent: calling it repeatedly never reseeds an already-provisioned wallet", async () => {
    // Regression test for a bug where InMemorySandboxStore keyed its account
    // Map by `${apiKey}:${currency}` alone, colliding a tenant's WALLET and
    // CLEARING accounts for the same currency into one slot — each
    // putAccount() call overwrote the other, so ensureTenant()'s
    // already-exists check kept failing and reseeded the balance on every
    // single call instead of only the first.
    await ensureTenant(apiKey, now, store);
    const afterFirst = await getWalletBalance(apiKey, "TZS", store);

    await ensureTenant(apiKey, now, store);
    await ensureTenant(apiKey, now, store);
    const afterRepeat = await getWalletBalance(apiKey, "TZS", store);

    expect(afterRepeat).toBe(afterFirst);

    const accounts = await store.listAccounts(apiKey);
    const tzsWallets = accounts.filter((a) => a.currency === "TZS" && a.accountId.endsWith(":WALLET"));
    expect(tzsWallets).toHaveLength(1);
  });

  it("debit + credit of the same amount nets to the original balance, and stays balanced per currency", async () => {
    await ensureTenant(apiKey, now, store);
    const before = await getWalletBalance(apiKey, "TZS", store);
    await debitWallet(apiKey, "TZS", 100_00n, "tx1", now, store);
    await creditWallet(apiKey, "TZS", 100_00n, "tx1", now, store);
    const after = await getWalletBalance(apiKey, "TZS", store);
    expect(after).toBe(before);
    await assertCurrencyBalanced(apiKey, "TZS", store);
  });

  it("rejects a debit that would overdraw the wallet", async () => {
    await ensureTenant(apiKey, now, store);
    const balance = await getWalletBalance(apiKey, "RWF", store);
    await expect(debitWallet(apiKey, "RWF", balance + 1n, "tx-overdraw", now, store)).rejects.toThrow();
  });

  it("a cross-currency settlement balances independently in EACH currency, never only in aggregate", async () => {
    await ensureTenant(apiKey, now, store);
    const quote = quoteSandboxFx({ corridorId: "TZ-KE", amountMinor: 200_000n, now });
    const fee = railCost("CORRIDOR_SETTLEMENT", quote.amountMinor);

    await postCrossBorderSettlement(apiKey, quote, fee, "tx-xborder", now, store);

    await assertCurrencyBalanced(apiKey, "TZS", store);
    await assertCurrencyBalanced(apiKey, "KES", store);

    // A ledger bug that only "balances" by summing TZS and KES entries together (nonsensical, but a
    // real class of bug) would not be caught by asserting each currency separately unless we also
    // confirm the two currencies' entries are actually disjoint postings.
    const tzsEntries = await store.listEntries(apiKey, "TZS");
    const kesEntries = await store.listEntries(apiKey, "KES");
    const overlap = tzsEntries.filter((e) => kesEntries.some((k) => k.id === e.id));
    expect(overlap).toHaveLength(0);
  });

  it("resetTenant wipes entries and reseeds starting balances", async () => {
    await ensureTenant(apiKey, now, store);
    await debitWallet(apiKey, "TZS", 500_00n, "tx-before-reset", now, store);
    const seeded = await getWalletBalance(apiKey, "TZS", store);

    await store.deleteTenant(apiKey);
    await ensureTenant(apiKey, now, store);
    const afterReset = await getWalletBalance(apiKey, "TZS", store);

    expect(afterReset).not.toBe(seeded);
    expect(afterReset).toBeGreaterThan(0n);
  });
});
