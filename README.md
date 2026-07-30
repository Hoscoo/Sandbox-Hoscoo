# Hoscoo

Payment orchestration across MNO, bank, card gateway, and cross-border rails
for East Africa — plus an isolated, deterministic developer sandbox that
third parties can integrate against before touching live rails.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.7 · Tailwind v4 ·
shadcn-style components on `@base-ui/react` · Drizzle ORM + Postgres (Neon-
compatible) · Vitest

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The sandbox works
without a database (falls back to an in-memory store); to run it against
Postgres:

```bash
docker compose up -d
DATABASE_URL=postgres://postgres:hoscoo@localhost:55432/hoscoo npm run db:push
DATABASE_URL=postgres://postgres:hoscoo@localhost:55432/hoscoo npm run dev
```

## Key paths

| Path | What it is |
|---|---|
| `/` | Marketing homepage — coverage, corridors, live routing engine |
| `/sandbox/portal` | Sandbox docs: endpoint reference, OpenAPI spec, Postman collection |
| `/sandbox/try` | The first-call wedge path: domestic wallet-to-wallet, live |
| `/sandbox/console` | Every channel (wallet, cross-border, bank, card), simulation rules, webhooks, and key issuance — all live |
| `/sandbox/fixtures` | The deterministic magic-value table, rendered from source |
| `lib/corridors.ts`, `lib/providers.ts` | The shared currency/market/channel/provider registries — production and sandbox both import these, never fork them |
| `lib/sandbox/` | Everything sandbox-only: ledger, simulation engine, webhooks, environment resolution |
| `PARITY.md` | What's guaranteed identical between sandbox and production, what isn't, and the known gaps |

## Scripts

```bash
npm run typecheck        # tsc --noEmit
npm run test             # vitest
npm run build            # next build
npm run openapi:generate # regenerate openapi/generated/v1.json + the Postman collection
npm run openapi:check    # CI drift check — fails if generated spec is stale
npm run db:push          # push Drizzle schema to DATABASE_URL
```

CI (`.github/workflows/ci.yml`) runs all of the above against a real
Postgres service on every push and PR.

## Hard invariants

- No sandbox call can reach a live rail or move real money — enforced by
  hostname + API-key-prefix cross-checks that fail closed (`lib/sandbox/environment.ts`, `proxy.ts`).
- Money is always integer minor units (`bigint`), never floats.
- `MNO_TO_MNO` MSISDN prefixes are a UX hint only, never a correctness
  control — `providerCode` is authoritative (see `detectMnoFromMsisdn` in `lib/providers.ts`).
- Webhook replay re-delivers a stored payload and nothing else — it cannot
  re-enter the ledger or re-quote FX (`lib/sandbox/__tests__/replay-isolation.test.ts`).

See [PARITY.md](PARITY.md) for the full parity contract and known gaps.
