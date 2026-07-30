/**
 * Drizzle schema for the durable SandboxStore adapter. Mirrors the
 * SandboxAccount/LedgerEntry shapes in lib/sandbox/store.ts exactly —
 * amountMinor is a Postgres bigint mapped to a JS bigint (mode: "bigint"),
 * not a number, so the no-float-money invariant holds all the way to the
 * database column type, not just in application code.
 */
import { pgTable, text, bigint, timestamp, index } from "drizzle-orm/pg-core";

export const sandboxAccounts = pgTable(
  "sandbox_accounts",
  {
    accountId: text("account_id").primaryKey(),
    apiKey: text("api_key").notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sandbox_accounts_api_key_idx").on(table.apiKey)],
);

export const sandboxLedgerEntries = pgTable(
  "sandbox_ledger_entries",
  {
    id: text("id").primaryKey(),
    apiKey: text("api_key").notNull(),
    accountId: text("account_id").notNull(),
    currency: text("currency").notNull(),
    direction: text("direction").notNull(), // "DEBIT" | "CREDIT"
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    transactionId: text("transaction_id").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sandbox_ledger_entries_api_key_idx").on(table.apiKey), index("sandbox_ledger_entries_api_key_currency_idx").on(table.apiKey, table.currency)],
);
