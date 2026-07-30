# Sandbox / Production Parity Contract

This document is the contract, not a description of good intentions. Every
guarantee below is enforced by [`lib/__tests__/conformance.test.ts`](lib/__tests__/conformance.test.ts),
which runs identical requests against both `app/api/initiate-payment`
(production) and `app/api/v1/sandbox/payments` (sandbox) and asserts
identical results. That test is the only mechanism in this repo that
actually prevents the two planes from drifting apart — everything else here
is enforced by the two routes importing the same modules, which is
necessary but not sufficient on its own (nothing stops someone from adding a
sandbox-only branch inside a shared function). Read this document as: **the
conformance suite is what makes these bullets true tomorrow, not just
today.**

## Guaranteed identical

| Guarantee | Enforced by |
|---|---|
| Lifecycle states and their valid transitions | Both planes import `LIFECYCLE_STATES`/`TRANSITIONS` from [`lib/lifecycle.ts`](lib/lifecycle.ts). Neither plane defines its own state machine. |
| Error codes and the error envelope shape | Both planes import `ERROR_CODES`/`errorEnvelope`/`HoscooApiError` from [`lib/errors.ts`](lib/errors.ts). The SDK's `HoscooSdkError` (`lib/sdk/errors.ts`) uses the same `ErrorCode` type. |
| Signature algorithm and canonicalisation | Both planes, and webhook delivery, call `sign`/`verify`/`canonicalize` from [`lib/signature.ts`](lib/signature.ts). Verification code written against sandbox payloads is portable to production payloads unchanged. |
| Validation rules | Both planes call `validatePaymentRequest` from [`lib/validation.ts`](lib/validation.ts). There is no second validator. |
| Dual-leg payload shape | Same `PaymentInstructionInput` type, same `Leg` shape, same `CHANNEL_LEGS` registry from [`lib/providers.ts`](lib/providers.ts). |
| Webhook event names, signing, retry, and delivery-log mechanics | Both planes instantiate the same generic factory, `createWebhookDispatcher()` in [`lib/webhooks/core.ts`](lib/webhooks/core.ts), from the same shared event-name constants in [`lib/webhooks/events.ts`](lib/webhooks/events.ts). [`lib/sandbox/webhooks.ts`](lib/sandbox/webhooks.ts) and [`lib/webhooks.ts`](lib/webhooks.ts) are both thin instantiations — neither reimplements dispatch, signing, or backoff. Each gets its own isolated event/queue/log state (verified by [`lib/webhooks/__tests__/core.test.ts`](lib/webhooks/__tests__/core.test.ts)), so this is shared code with separated data, not shared state. |
| API-key prefix checking | Both planes call into the same core in [`lib/auth.ts`](lib/auth.ts) — sandbox requires `hsc_test_`, production requires `hsc_live_`. Neither route hand-rolls its own key parsing. **Not identical beyond that:** [`lib/sandbox/auth.ts`](lib/sandbox/auth.ts) wraps the shared core with auto-registration into a real key registry ([`lib/sandbox/keys.ts`](lib/sandbox/keys.ts)) — any prefix-valid sandbox key gets a trackable entry on first use, never rejected (zero-friction self-serve, the whole point of a sandbox). Production gets no such registry; this is a deliberate, documented asymmetry, not drift — auto-registering an arbitrary `hsc_live_` string would be a very different, much worse decision. |
| Rounding and FX arithmetic | Both planes call `quoteFx` from [`lib/corridors.ts`](lib/corridors.ts). Sandbox supplies a fixed, deterministic rate (`lib/sandbox/ledger.ts`'s `SANDBOX_FX_RATES`); it does not reimplement spread application, rounding, or minor-unit handling. |
| Market-gating order of operations | Both planes call `assertMarketLive` before any quote, alias lookup, or ledger/transaction write. |
| Provider/channel/currency registries, and channel-to-rail mapping | Both planes read `CHANNELS`, `MNOS`, `BANKS`, `CURRENCIES`, `MARKETS`, and `CHANNEL_RAILS` directly from `lib/providers.ts` and `lib/corridors.ts` — `CHANNEL_RAILS` was previously copy-pasted into both route files and has been consolidated into `lib/providers.ts`. A seventh provider or fifth market is a data change, not a code change, in either plane. |

## Explicitly NOT identical

- **Real money.** Sandbox ledger postings (`lib/sandbox/ledger.ts`) move
  balances in an isolated mock ledger. No sandbox code path calls a real
  rail, a real bank, or a real mobile money switch.
- **Real rails.** Sandbox settlement is synchronous and deterministic;
  production settlement (once wired to real rails) will be asynchronous and
  subject to real-world latency and failure modes the simulation engine can
  only approximate.
- **Real settlement timing.** Sandbox has no cut-off enforcement beyond the
  `OUTSIDE_CUTOFF` simulation outcome; production cut-off timing depends on
  each rail's actual operating hours.
- **Real alias data.** `lib/tips.ts`'s TIPS directory is a small seeded
  fixture list, not a live query against the national switch.
- **Live FX rates.** Sandbox rates are fixed and documented
  (`SANDBOX_FX_RATES`/`ADVERSE_SANDBOX_FX_RATES`), not sourced from a live
  market feed.

## Enforced by

**`lib/__tests__/conformance.test.ts`** — the shared conformance suite. It
currently covers: missing/wrong-prefix API keys (`UNAUTHORIZED`),
malformed-body validation, `MARKET_NOT_LIVE` gating order, and
`SAME_PROVIDER_ON_US` rejection, run against both route handlers with
identical inputs and asserted to produce identical status codes and error
codes. Extending coverage in this one file is how new shared behavior stays
provably shared — a change that breaks conformance here is a real drift
bug, not a false positive.

## Known gaps (surfaced, not hidden)

- **The sandbox ledger is durable-capable; production's transaction store is
  not, yet.** [`lib/sandbox/db/postgres-store.ts`](lib/sandbox/db/postgres-store.ts)
  implements `SandboxStore` against real Postgres/Neon via Drizzle — live-tested
  in [`lib/sandbox/db/__tests__/postgres-store.test.ts`](lib/sandbox/db/__tests__/postgres-store.test.ts)
  against a local Postgres container (`docker-compose.yml`), and wired in via
  `DATABASE_URL` at [`lib/sandbox/store.ts`](lib/sandbox/store.ts)'s bottom.
  `lib/transactions.ts` — production's transaction store — is still an
  in-memory `Map` and was **not** migrated to this adapter. It is a distinct
  data model (lifecycle-state transactions, not double-entry ledger entries)
  so it needs its own `SandboxStore`-shaped interface and its own Postgres
  adapter before this bullet can be marked closed, and remains today's
  biggest asymmetry between the two planes.
- **Production's webhook dispatcher exists and is tested, but has no live
  call site.** [`lib/webhooks.ts`](lib/webhooks.ts) is a fully working
  instantiation of the same dispatcher core the sandbox uses — registration
  route ([`app/api/webhooks/route.ts`](app/api/webhooks/route.ts)), cron
  dispatch route ([`app/api/webhooks/dispatch/route.ts`](app/api/webhooks/dispatch/route.ts)),
  signing, retry, delivery log, all real. `app/api/initiate-payment/route.ts`
  does not call `emitEvent()`, though, because it has nothing legitimate to
  emit yet: `PENDING_AUTHORIZATION` is the lifecycle's initial state (no
  incoming transition, so no `LIFECYCLE_EVENT_NAMES` entry exists for it —
  see `lib/lifecycle.ts`), and production has no downstream process that
  actually drives a transaction through `AUTHORIZED -> ROUTING -> SETTLING ->
  COMPLETED`, because that requires a real rail integration this repo does
  not have. Emitting an event for a transition that never happens would
  violate the "no event without a real occurrence" rule the whole webhook
  design rests on, so the honest choice was to wire the infrastructure and
  leave the call site until a real settlement path exists to trigger it.
