# Developer Handoff — Hoscoo Sandbox

This is the continuation guide. [README.md](README.md) is the quick-start;
[PARITY.md](PARITY.md) is the sandbox/production contract. This document is
the third piece: what exists, why it's built the way it is, what's
deliberately not done, and what to build next, in order.

Read it once before touching the code. It will save you from re-deriving
decisions that were already made on purpose.

---

## 1. What this actually is

Hoscoo is a payment orchestration API for East Africa (wallet-to-wallet,
bank-to-wallet, card checkout, cross-border corridors) plus a **public
developer sandbox** — an isolated, deterministic environment third parties
can integrate against before touching live rails.

The critical thing to understand: **the sandbox is not a separate toy app.**
It shares its validation, signing, error codes, lifecycle states, and
routing logic with the production code path. A payments sandbox that drifts
from production teaches integrators the wrong shape and then blames them for
it — that constraint shaped almost every architectural decision below.

There is currently **no real rail integration anywhere in this repo.**
Production and sandbox both exist, but "production" today means "the same
validated, signed, correctly-routed instruction, with no actual bank/telco
call at the end of it." That is the single biggest thing left to build, and
everything in this document is scoped around getting you there without
breaking what's already solid.

---

## 2. What's built, and where

### The shared core (both planes import this — never fork it)

| Concern | File | Notes |
|---|---|---|
| Currencies, markets, FX math, routing | `lib/corridors.ts` | All money is `bigint` minor units. `formatCurrency` derives decimal places from `CURRENCY_META` — never assumes 2 decimals (UGX/RWF are zero-decimal). `selectRoute` gates eligibility *before* comparing cost. |
| Channels, providers, MSISDN/card handling | `lib/providers.ts` | 6 channels, 6 MNOs, 5 banks, 2 gateways — all data, not code. `detectMnoFromMsisdn` is explicitly a UX hint, never a correctness control (see the comment in that file for why). |
| Validation | `lib/validation.ts` | One validator, both planes call it. |
| Signing | `lib/signature.ts` | HMAC-SHA256 with canonical JSON. Webhook delivery reuses this too. |
| Lifecycle state machine | `lib/lifecycle.ts` | `TRANSITIONS` is the source of truth. Webhook event names are *derived* from this table (`lib/webhooks/events.ts`), not hand-maintained — a state with no transition can't accidentally get an event. |
| Error taxonomy | `lib/errors.ts` | `ERROR_CODES` + `HoscooApiError`. The SDK's error class uses the same type. |
| TIPS alias directory | `lib/tips.ts` | Simulated — a small seeded list, not a real switch query. |

### Pillar 1 — Gateway & environment isolation

- `lib/sandbox/environment.ts` — **one function**, `resolveEnvironment()`,
  decides sandbox vs. production from hostname (primary signal) with API-key
  prefix as a fail-closed cross-check. Never two independent switches that
  could disagree.
- `proxy.ts` — enforces this at the edge, before any route handler runs.
  Has a narrow, explicitly-commented `localhost`/`127.0.0.1` exception so
  local dev isn't blocked (real deployments never hit that hostname).
- `vercel.json` — host-based rewrites, security headers, and the cron
  schedule for webhook dispatch (currently once-daily — **see §4, this is a
  Hobby-plan constraint, raise it before you need faster delivery**).

### Pillar 2 — Mock ledger

- `lib/sandbox/store.ts` defines the `SandboxStore` interface.
  `lib/sandbox/db/postgres-store.ts` is a real, live-tested Drizzle/Postgres
  implementation (works against Neon — see §5). Falls back to an in-memory
  `InMemorySandboxStore` when `DATABASE_URL` is unset.
- `lib/sandbox/ledger.ts` — double-entry, one WALLET + one CLEARING account
  per tenant per currency, seeded on first use. `assertCurrencyBalanced`
  checks balance **per currency**, never after an implicit conversion.
- Deterministic FX: `SANDBOX_FX_RATES` (fixed) and `ADVERSE_SANDBOX_FX_RATES`
  (opt-in, for the adverse-rate-movement fixture) in the same file.

### Pillar 3 — Simulation engine

- `lib/sandbox/simulation.ts` — three outcome-control mechanisms in
  documented precedence order: **header directive > registered rule > magic
  value**. Rules are scoped per API key so parallel CI runs can't interfere.
- `lib/sandbox/fixtures.ts` — the full magic-value table, rendered live at
  `/sandbox/fixtures` so the docs page and the actual behavior can never
  drift (it reads the same constant the simulation engine reads).

### Pillar 4 — SDK & Test Bank UI

- `lib/sdk/client.ts` — `hoscoo.init({ publicKey, mode })`. Throws a named
  error at `init()` if `mode` and the key prefix disagree — this is the one
  case explicitly designed to be impossible to misuse silently (a developer
  shipping a test key into what they believe is live mode is the
  catastrophic failure mode this guards against).
- `components/sandbox/test-bank-modal.tsx` — provider-capability-driven
  authorization UI (USSD PIN / app-push / agent-assisted / card OTP), plus a
  cross-border variant showing rate/spread/expiry. Unmistakably "sandbox"
  styled; cannot render under a live key by construction (it's only ever
  invoked from sandbox-only components).

### Pillar 5 — Webhooks & replay

- `lib/webhooks/core.ts` — `createWebhookDispatcher(namespace)` is the
  **entire** implementation (event model, durable pending-delivery queue,
  signing, backoff+jitter retry, delivery log, replay). `lib/webhooks.ts`
  (production) and `lib/sandbox/webhooks.ts` (sandbox) are ~10-line
  instantiations of it with isolated state — read the module comment at the
  top of `core.ts`, it explains why in-request dispatch is rejected by
  design.
- **Replay is structurally isolated from the ledger** — it does not import
  any ledger write path. Enforced by
  `lib/sandbox/__tests__/replay-isolation.test.ts`, which asserts a replayed
  event reuses the original event ID and mutates nothing.
- `app/api/v1/sandbox/webhooks/echo/route.ts` — a local self-test receiver
  so the console's Webhooks tab is demoable without an external URL.

### Pillar 6 — OpenAPI & portal

- `lib/openapi/build.ts` generates `openapi/generated/v1.json`.
  `scripts/check-openapi-drift.ts` fails CI if the committed spec is stale —
  **this is the only thing that makes "generated" actually mean generated.**
- `/sandbox/portal` — endpoint reference with real curl examples, links to
  the spec and Postman collection.
- `/sandbox/try` — **the full sandbox console.** Every channel (wallet,
  cross-border, bank, card) plus simulation rules, webhooks, and key
  issuance, all live against `/api/v1/sandbox/*`. This is what you should
  demo, not the individual API routes. `/sandbox/console` redirects here —
  there used to be two separate pages; they were consolidated on purpose,
  don't re-split them.

### Beyond the six pillars

- `lib/sandbox/keys.ts` — real key registry (auto-registers on first use;
  never rejects, since gatekeeping the sandbox contradicts "integrate before
  touching live rails"). `POST /v1/sandbox/keys` is the recommended way to
  get a proper random key.
- A generated provider × channel × market × account-type × outcome test
  matrix (`lib/sandbox/__tests__/matrix.test.ts`) — the brief that scoped
  this project called out that hand-writing this cardinality isn't viable,
  so it's generated.
- Real brand assets pulled from the live hoscoo.com (logo, colors, Geist
  font) — see `components/logo.tsx` and `app/globals.css`.

---

## 3. Decisions worth knowing the "why" on

These aren't arbitrary. If you're about to change one, re-read the
reasoning first.

**Money is `bigint`, always, no exceptions.** Not `number`, not a decimal
library. JSON has no bigint, so the wire format is a decimal-string integer
of minor units (`"amountMinor": "500000"`). Every money-handling function in
this repo takes and returns `bigint`. If you find a `number` holding a money
value, that's a bug, not a style choice.

**One rounding point.** `quoteFx` in `lib/corridors.ts` applies spread and
rounds exactly once, at the very end, via integer division. Don't round
anywhere else in the FX path — that's how you get an unexplained residual
minor unit.

**Sandbox settles synchronously; production doesn't (yet), and that's
fine.** `lib/sandbox/progression.ts`'s `settleAndProgress()` walks
AUTHORIZED → ROUTING → SETTLING → a terminal state in one function call,
emitting the mechanically-correct webhook event at each step even though
status polling can't catch the transaction mid-flight. This is a documented
simplification, not an oversight — real settlement will be genuinely async
once a rail exists, and the event *sequence* a merchant's webhook handler
sees is already correct today.

**Prefix inference from MSISDN is never a correctness control.**
`detectMnoFromMsisdn` exists purely as a UX hint (pre-filling a selector).
Selcom Pesa is a payments company with no dedicated number range, and
numbers port between telcos — `providerCode`, declared by the caller, is the
only authoritative signal. There's a fixture (`wallet-ported-number-
disagreement` in `lib/sandbox/fixtures.ts`) specifically proving prefix and
declared provider can disagree and the system still routes correctly. If you
ever see code branch on a detected prefix instead of the declared
`providerCode`, that's a bug to fix immediately, not a pattern to extend.

**Eligibility gates before cost, unconditionally.** `selectRoute` in
`lib/corridors.ts` filters every rail candidate to `ELIGIBLE` before any
cost comparison happens. A cheaper ineligible rail must never win. This is
tested (`lib/__tests__/routing.test.ts`) precisely because it's the kind of
invariant a "small" refactor accidentally breaks.

**Webhook dispatch never happens inside the request that triggers it.** A
serverless function's execution ends when it returns a response — an
unawaited dispatch can vanish, and an awaited one couples your API latency
to the merchant's endpoint reliability. `emitEvent()` only ever writes an
immutable event + a queued delivery row; a separate cron-invoked
`drainPendingDeliveries()` does the actual HTTP call.

---

## 4. Known gaps (don't rediscover these the hard way)

The full list with reasoning lives in [PARITY.md](PARITY.md)'s "Known gaps"
section. Summary, ranked by how much they'll bite you:

1. **No real rail integration exists.** This is the actual product. Every
   route currently ends at "validated, signed, correctly routed" — see §6
   for how to add the first one.
2. **Production's transaction store (`lib/transactions.ts`) is still an
   in-memory `Map`.** The sandbox's durable-store pattern
   (`SandboxStore`/`PostgresSandboxStore`) is proven and ready to copy, but
   production transactions are a different shape (lifecycle-state records,
   not double-entry ledger entries) and need their own interface.
3. **Production's webhook dispatcher has no live call site.** It's fully
   built and tested (`lib/webhooks.ts`), but nothing in
   `app/api/initiate-payment` calls `emitEvent()` yet, because there's
   nothing legitimate to emit — production has no process that drives a
   transaction past `PENDING_AUTHORIZATION`. This resolves itself
   automatically once gap #1 exists.
4. **The Vercel cron for webhook dispatch runs once daily, not every
   minute.** Vercel's Hobby plan caps cron frequency at once per 24h. Fixed
   pragmatically for now (`vercel.json`) — see the comment in
   `lib/webhooks/core.ts`. The console's "Deliver now" button bypasses this
   for demos by calling dispatch directly. **Move to a paid plan (or Vercel
   Workflow, which doesn't have this limitation) before relying on
   automatic near-real-time delivery.**
5. **API keys aren't tied to real accounts.** `lib/sandbox/keys.ts` tracks
   keys but doesn't gate on them — any `hsc_test_`-prefixed string works.
   This is intentional for the sandbox (zero-friction self-serve) but
   production has no account/auth system at all yet.
6. **Nothing is deployed.** Everything above has been verified locally
   (including against real Postgres via `docker compose`) but never against
   an actual Vercel + Neon deployment. See §5.

---

## 5. Deploying (the immediate next step)

Nothing here has touched real infrastructure yet. To get this live:

1. **Neon**: create a Postgres database, copy the connection string (a
   standard `postgres://...` URL — the adapter uses the wire protocol via
   `pg`/Drizzle, not Neon's HTTP driver, so any Postgres-compatible
   connection string works).
2. **Vercel**: create the project from this repo, set `DATABASE_URL` to the
   Neon string, set `HOSCOO_SIGNING_SECRET` to a real secret (currently
   falls back to a hardcoded local-dev value — see
   `app/api/initiate-payment/route.ts`, **do not ship that fallback to a
   real deployment**).
3. Run `npm run db:push` once against the Neon URL to create the schema
   (`lib/sandbox/db/schema.ts`).
4. Point `sandbox-api.hoscoo.com` at the deployment; `vercel.json`'s
   rewrites already assume that exact hostname (see `lib/sandbox/
   environment.ts` — `SANDBOX_HOST`/`PRODUCTION_HOST` constants if you need
   to change it).
5. Verify with the same checklist CI runs: `npm run typecheck && npm run
   test && npm run build && npm run openapi:check`.

---

## 6. Roadmap — what to build, in order

**Now (unblocks everything else):**
- Wire the first real rail. Recommended first target: `MNO_TO_MNO` via one
  telco's actual API (the brief that shaped this repo calls this out as the
  wedge path for a reason — no bank fixture, no FX, smallest possible
  surface). This single integration will force the real design questions
  (webhook call site, production transaction durability, retry/timeout
  handling against a real flaky API) that are currently deferred.
- Migrate `lib/transactions.ts` to a durable store, copying the
  `SandboxStore` adapter pattern. Don't reuse the sandbox's Postgres tables
  — production transactions are a different shape; give them their own
  schema and interface.

**Next (once one rail is real):**
- Wire `emitEvent()` into the production payment flow once there's a real
  state transition to report.
- Real API key issuance + account system for production (`hsc_live_` keys
  need to mean something beyond a prefix check).
- Move webhook dispatch off a cron poll onto Vercel Workflow or a proper
  queue — the cron's daily-max ceiling on Hobby, and its inherent latency
  even on a paid plan, won't hold up for real merchant traffic.

**Later (breadth, once the pattern is proven once):**
- Second and third rail integrations (bank, card gateway, then cross-border
  corridor settlement) — by this point the pattern from the first
  integration should mostly repeat.
- Split the sandbox into its own Vercel project/database. The residual-risk
  comment in `lib/sandbox/environment.ts` names the trigger explicitly:
  **do this at the same time as gap #1**, i.e. the moment a live rail
  exists, isolation stops being "enforced in code" and needs to be enforced
  in infrastructure.
- Mobile/responsive pass on the console — never explicitly verified beyond
  desktop viewport.

---

## 7. Working in this codebase

**Before changing shared code** (`lib/corridors.ts`, `lib/providers.ts`,
`lib/validation.ts`, `lib/signature.ts`, `lib/lifecycle.ts`, `lib/errors.ts`,
`lib/webhooks/core.ts`): both planes import these directly. A change here is
a change to both production and sandbox simultaneously — that's the point,
but it means you should run `lib/__tests__/conformance.test.ts` and think
about whether the change needs a new conformance assertion, not just make
the change and move on.

**Adding a provider, currency, or market:** these registries are explicitly
data-driven — see the module comment at the top of `lib/providers.ts`. It
should be a new array entry, never a validator/router code change. If you
find yourself writing an `if (providerCode === 'NEW_PROVIDER')` branch
anywhere outside the registry file itself, stop — that's the exact drift
this design prevents.

**Adding a lifecycle event:** add the transition to `lib/lifecycle.ts`'s
`TRANSITIONS` first. Event names in `lib/webhooks/events.ts` are derived
from that table — you cannot add an event for a transition that doesn't
exist, by design.

**Testing:** `npm run test` runs Vitest. `lib/sandbox/db/__tests__/postgres-
store.test.ts` self-skips without `DATABASE_URL` — CI always sets it (see
`.github/workflows/ci.yml`'s Postgres service), so run
`docker compose up -d && DATABASE_URL=postgres://postgres:hoscoo@localhost:55432/hoscoo npm run test`
locally before trusting a change that touches the ledger or store.

**Before merging anything that touches an API route or the OpenAPI-relevant
parts of `lib/`:** run `npm run openapi:generate` and commit the diff, or
`npm run openapi:check` will fail CI.

---

## 8. If you get stuck

Read, in this order: this file → `PARITY.md` → the module-level comment at
the top of whichever file you're touching (they're written to explain *why*,
not just *what* — the code review this repo has been through repeatedly
found real bugs specifically in things that weren't clicked through live,
so trust the comments enough to keep them updated when you change behavior).
