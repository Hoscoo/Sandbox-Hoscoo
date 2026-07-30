CREATE TABLE "sandbox_accounts" (
	"account_id" text PRIMARY KEY NOT NULL,
	"api_key" text NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"api_key" text NOT NULL,
	"account_id" text NOT NULL,
	"currency" text NOT NULL,
	"direction" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"transaction_id" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sandbox_accounts_api_key_idx" ON "sandbox_accounts" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "sandbox_ledger_entries_api_key_idx" ON "sandbox_ledger_entries" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "sandbox_ledger_entries_api_key_currency_idx" ON "sandbox_ledger_entries" USING btree ("api_key","currency");