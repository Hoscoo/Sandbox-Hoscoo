/**
 * Builds the OpenAPI 3.1 document programmatically from the same source-of-
 * truth modules the API routes import — CHANNELS, MNOS, BANKS, MARKETS,
 * CURRENCIES, ERROR_CODES, and the webhook event names derived from
 * TRANSITIONS. There is no hand-maintained JSON anywhere in this pillar:
 * scripts/generate-openapi.ts calls this function and writes its output;
 * scripts/check-openapi-drift.ts calls it again and diffs against what was
 * committed, so a stale spec fails CI instead of silently misleading an
 * integrator.
 */
import { CHANNELS, CHANNEL_META, CHANNEL_LEGS, MNOS, BANKS, GATEWAY_PROVIDERS, ACCOUNT_TYPES } from "../providers";
import { CURRENCIES, CURRENCY_META, MARKETS, MARKET_STATUS_META } from "../corridors";
import { ERROR_CODES } from "../errors";
import { LIFECYCLE_STATES } from "../lifecycle";
import { LIFECYCLE_EVENT_NAMES, CROSS_BORDER_EVENT_NAMES } from "../sandbox/webhooks";

const OPENAPI_VERSION = "1.0.0";

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Hoscoo Payments API",
      version: OPENAPI_VERSION,
      description:
        "Unified payment orchestration across MNO, bank, gateway, and cross-border rails. " +
        "Routes tagged `sandbox-only` exist only at sandbox-api.hoscoo.com and must never be integrated against in production.",
    },
    servers: [
      { url: "https://api.hoscoo.com", description: "Production" },
      { url: "https://sandbox-api.hoscoo.com", description: "Sandbox" },
    ],
    security: [{ apiKeyAuth: [] }],
    tags: [
      { name: "payments", description: "Domestic and cross-border payment initiation and status." },
      { name: "fx", description: "Cross-border FX quoting." },
      { name: "sandbox-only", description: "Exists only in the sandbox plane. Never call these against production." },
    ],
    paths: {
      "/initiate-payment": {
        post: {
          tags: ["payments"],
          summary: "Initiate a payment instruction",
          description:
            "The first-call integration path is CROSS_MNO_TO_MNO (e.g. M-Pesa to Airtel Money): no bank fixture, no FX. " +
            "The cross-border corridor path (channel: CROSS_BORDER) is the natural second call.",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentInstructionInput" } } } },
          responses: {
            "201": { description: "Instruction accepted", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentResult" } } } },
            "400": errorResponse("Validation failed"),
            "422": errorResponse("Market not live, same-provider on-us, or alias unmapped"),
            "503": errorResponse("No eligible rail"),
          },
        },
      },
      "/payment-status": {
        get: {
          tags: ["payments"],
          summary: "Get payment lifecycle status",
          parameters: [{ name: "transactionId", in: "query", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Current status", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentResult" } } } }, "404": errorResponse("Not found") },
        },
      },
      "/webhooks": {
        post: { tags: ["payments"], summary: "Register this merchant's production webhook delivery URL", responses: { "200": { description: "Registered" } } },
        get: { tags: ["payments"], summary: "Get this merchant's registered webhook URL", responses: { "200": { description: "URL" } } },
      },
      "/v1/sandbox/payments": {
        post: {
          tags: ["sandbox-only", "payments"],
          summary: "Initiate a payment instruction (sandbox)",
          description: "Identical validation, market gating, and routing to /initiate-payment. Settles against the deterministic mock ledger, never a real rail.",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentInstructionInput" } } } },
          responses: { "201": { description: "Instruction accepted", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentResult" } } } } },
        },
        get: {
          tags: ["sandbox-only", "payments"],
          summary: "Get sandbox payment lifecycle status",
          parameters: [{ name: "transactionId", in: "query", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Current status", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentResult" } } } } },
        },
      },
      "/v1/sandbox/fx-quote": {
        post: {
          tags: ["sandbox-only", "fx"],
          summary: "Issue a deterministic sandbox FX quote",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/FxQuoteRequest" } } } },
          responses: { "200": { description: "Quote issued", content: { "application/json": { schema: { $ref: "#/components/schemas/FxQuote" } } } } },
        },
        get: {
          tags: ["sandbox-only", "fx"],
          summary: "Refresh (re-fetch) a previously issued quote",
          parameters: [{ name: "quoteId", in: "query", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Quote", content: { "application/json": { schema: { $ref: "#/components/schemas/FxQuote" } } } } },
        },
      },
      "/v1/sandbox/keys": {
        post: {
          tags: ["sandbox-only"],
          summary: "Issue a fresh, cryptographically random hsc_test_ key",
          description: "No auth required — this is the bootstrap endpoint. Not required to use the sandbox: any hsc_test_-prefixed string auto-registers on first use, but this is the recommended way to get one.",
          responses: { "201": { description: "Key issued" } },
        },
      },
      "/v1/sandbox/payments/challenge": {
        post: {
          tags: ["sandbox-only", "payments"],
          summary: "Resolve a pending 3-DS/step-up challenge",
          description: "Called by the Test Bank modal after the simulated customer approves or denies a challenge issued by initiating a payment against a THREE_DS_CHALLENGE magic MSISDN.",
          responses: { "200": { description: "Resolved" }, "402": { description: "Challenge denied or settlement failed" }, "409": errorResponse("No pending challenge to resolve") },
        },
      },
      "/v1/sandbox/simulate": {
        post: { tags: ["sandbox-only"], summary: "Register a programmable simulation rule", responses: { "201": { description: "Rule registered" } } },
        get: { tags: ["sandbox-only"], summary: "List active simulation rules for this API key", responses: { "200": { description: "Rules" } } },
        delete: { tags: ["sandbox-only"], summary: "Clear all simulation rules for this API key", responses: { "200": { description: "Cleared" } } },
      },
      "/v1/sandbox/reset": {
        post: { tags: ["sandbox-only"], summary: "Reset this tenant's mock ledger to seeded starting balances", responses: { "200": { description: "Reset" } } },
      },
      "/v1/sandbox/webhooks": {
        post: { tags: ["sandbox-only"], summary: "Register this tenant's webhook delivery URL", responses: { "200": { description: "Registered" } } },
        get: { tags: ["sandbox-only"], summary: "Get this tenant's registered webhook URL", responses: { "200": { description: "URL" } } },
      },
      "/v1/sandbox/webhooks/replay": {
        post: {
          tags: ["sandbox-only"],
          summary: "Re-deliver a stored webhook event verbatim",
          description: "Reuses the original event id. Never re-enters routing, the ledger, or FX quoting — see the replay-isolation invariant in the parity contract.",
          responses: { "202": { description: "Replay queued" }, "404": errorResponse("Event not found"), "429": errorResponse("Rate limited") },
        },
      },
      "/v1/sandbox/webhooks/logs": {
        get: { tags: ["sandbox-only"], summary: "Webhook delivery attempt log, with MSISDNs masked in every payload preview", responses: { "200": { description: "Delivery log" } } },
      },
    },
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: "http",
          scheme: "bearer",
          description: "Bearer token. Key prefix `hsc_test_` for sandbox, `hsc_live_` for production — never interchangeable.",
        },
      },
      schemas: {
        Channel: {
          type: "string",
          enum: [...CHANNELS],
          description: CHANNELS.map((c) => `${c}: ${CHANNEL_META[c].label} (${CHANNEL_LEGS[c].source} -> ${CHANNEL_LEGS[c].destination})`).join("; "),
        },
        Market: { type: "string", enum: [...MARKETS] },
        MarketStatus: {
          type: "object",
          description: "Status per market. PLANNED markets must never be presented as available.",
          properties: Object.fromEntries(MARKETS.map((m) => [m, { type: "string", enum: [MARKET_STATUS_META[m].status] }])),
        },
        CurrencyCode: { type: "string", enum: [...CURRENCIES] },
        CurrencyRegistry: {
          type: "object",
          description: "Every currency's true ISO 4217 minor-unit exponent. UGX and RWF are zero-decimal.",
          properties: Object.fromEntries(
            CURRENCIES.map((c) => [c, { type: "object", properties: { exponent: { type: "integer", const: CURRENCY_META[c].exponent }, symbol: { type: "string", const: CURRENCY_META[c].symbol } } }]),
          ),
        },
        WalletProvider: {
          type: "object",
          properties: { code: { type: "string" }, displayName: { type: "string" }, market: { $ref: "#/components/schemas/Market" } },
          examples: MNOS.map((m) => ({ code: m.code, displayName: m.displayName, market: m.market })),
        },
        BankProvider: {
          type: "object",
          properties: { code: { type: "string" }, displayName: { type: "string" } },
          examples: BANKS.map((b) => ({ code: b.code, displayName: b.displayName })),
        },
        GatewayProvider: {
          type: "object",
          properties: { code: { type: "string" }, displayName: { type: "string" } },
          examples: GATEWAY_PROVIDERS.map((g) => ({ code: g.code, displayName: g.displayName })),
        },
        AccountType: { type: "string", enum: [...ACCOUNT_TYPES] },
        Leg: {
          type: "object",
          required: ["providerCode", "accountType", "identifier"],
          properties: {
            providerCode: { type: "string", description: "Authoritative — never inferred from MSISDN prefix." },
            accountType: { $ref: "#/components/schemas/AccountType" },
            identifier: { type: "string", description: "MSISDN, bank account number, or PAN depending on leg kind." },
          },
        },
        PaymentInstructionInput: {
          type: "object",
          description: "The dual-leg payload shared verbatim between production and sandbox.",
          required: ["channel", "amountMinor", "currency", "market", "source", "destination", "reference"],
          properties: {
            channel: { $ref: "#/components/schemas/Channel" },
            amountMinor: { type: "string", description: "Integer minor units as a decimal string. Never a float." },
            currency: { $ref: "#/components/schemas/CurrencyCode" },
            market: { $ref: "#/components/schemas/Market" },
            source: { $ref: "#/components/schemas/Leg" },
            destination: { $ref: "#/components/schemas/Leg" },
            reference: { type: "string", pattern: "^[A-Za-z0-9._-]{1,64}$" },
            destinationCurrency: { $ref: "#/components/schemas/CurrencyCode" },
            quoteId: { type: "string", description: "Required for channel: CROSS_BORDER." },
            metadata: { type: "object", additionalProperties: { type: "string" } },
          },
        },
        LifecycleState: { type: "string", enum: [...LIFECYCLE_STATES] },
        PaymentResult: {
          type: "object",
          properties: {
            transactionId: { type: "string" },
            status: { $ref: "#/components/schemas/LifecycleState" },
            rail: { type: ["string", "null"] },
            reasonCode: { $ref: "#/components/schemas/ErrorCode" },
            requiresAction: { type: "boolean" },
          },
        },
        FxQuoteRequest: {
          type: "object",
          required: ["corridorId", "amountMinor"],
          properties: { corridorId: { type: "string" }, amountMinor: { type: "string" }, adverse: { type: "boolean", description: "Sandbox-only opt-in for adverse-rate-movement scenarios." } },
        },
        FxQuote: {
          type: "object",
          properties: {
            quoteId: { type: "string" },
            corridorId: { type: "string" },
            fromCurrency: { $ref: "#/components/schemas/CurrencyCode" },
            toCurrency: { $ref: "#/components/schemas/CurrencyCode" },
            amountMinor: { type: "string" },
            midRateNumerator: { type: "string" },
            midRateDenominator: { type: "string" },
            spreadBps: { type: "integer" },
            creditedMinor: { type: "string" },
            issuedAt: { type: "string", format: "date-time" },
            expiresAt: { type: "string", format: "date-time", description: "Execution after this timestamp must fail closed with QUOTE_EXPIRED." },
          },
        },
        ErrorCode: { type: "string", enum: [...ERROR_CODES] },
        ErrorEnvelope: {
          type: "object",
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: { code: { $ref: "#/components/schemas/ErrorCode" }, message: { type: "string" }, details: { type: "object" } },
            },
          },
        },
      },
    },
    webhooks: {
      ...Object.fromEntries(
        Object.values(LIFECYCLE_EVENT_NAMES)
          .filter((name): name is NonNullable<typeof name> => Boolean(name))
          .map((name) => [
            name,
            {
              post: {
                requestBody: { content: { "application/json": { schema: { type: "object", properties: { transactionId: { type: "string" }, status: { $ref: "#/components/schemas/LifecycleState" } } } } } },
                responses: { "200": { description: "Merchant endpoint acknowledged delivery" } },
              },
            },
          ]),
      ),
      ...Object.fromEntries(
        Object.values(CROSS_BORDER_EVENT_NAMES).map((name) => [
          name,
          { post: { requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/FxQuote" } } } } }, responses: { "200": { description: "Acknowledged" } } },
        ]),
      ),
    },
  };
}

function errorResponse(description: string) {
  return { description, content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } };
}
