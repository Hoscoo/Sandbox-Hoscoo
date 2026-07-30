import { resolveEnvironment, extractApiKeyPrefix, PRODUCTION_HOST, SANDBOX_HOST } from "../sandbox/environment";
import { HoscooModeKeyMismatchError, HoscooSdkError } from "./errors";
import { maskMsisdn } from "../mask";
import type { Channel, AccountType } from "../providers";
import type { CurrencyCode } from "../corridors";
import type { LifecycleState } from "../lifecycle";
import type { ErrorEnvelope } from "../errors";

export type SdkMode = "sandbox" | "live";

export interface InitOptions {
  publicKey: string;
  mode: SdkMode;
  /** Override for non-browser environments (tests, SSR); defaults to window.location.hostname. */
  hostname?: string;
}

export interface LegInput {
  providerCode: string;
  accountType: AccountType;
  identifier: string;
}

export interface InitiatePaymentInput {
  channel: Channel;
  amountMinor: string;
  currency: CurrencyCode;
  market: string;
  source: LegInput;
  destination: LegInput;
  reference: string;
  destinationCurrency?: CurrencyCode;
  quoteId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  transactionId: string;
  status: LifecycleState;
  rail: string | null;
  reasonCode?: string;
  requiresAction: boolean;
}

export interface FxQuoteResult {
  quoteId: string;
  corridorId: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  amountMinor: string;
  midRateNumerator: string;
  midRateDenominator: string;
  creditedMinor: string;
  spreadBps: number;
  issuedAt: string;
  expiresAt: string;
}

function randomIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export class HoscooClient {
  readonly mode: SdkMode;
  private readonly publicKey: string;
  private readonly baseUrl: string;
  private readonly logSink: string;

  private constructor(publicKey: string, mode: SdkMode, baseUrl: string, logSink: string) {
    this.publicKey = publicKey;
    this.mode = mode;
    this.baseUrl = baseUrl;
    this.logSink = logSink;
  }

  static init(options: InitOptions): HoscooClient {
    const keyPrefix = extractApiKeyPrefix(options.publicKey);
    if (!keyPrefix) {
      throw new HoscooSdkError("VALIDATION_FAILED", "publicKey must start with hsc_test_ or hsc_live_");
    }
    // Named error, thrown synchronously, before any request path/telemetry/widget is retargeted.
    if (options.mode === "sandbox" && keyPrefix !== "hsc_test_") {
      throw new HoscooModeKeyMismatchError("sandbox", keyPrefix);
    }
    if (options.mode === "live" && keyPrefix !== "hsc_live_") {
      throw new HoscooModeKeyMismatchError("live", keyPrefix);
    }

    const hostname =
      options.hostname ??
      (typeof window !== "undefined" ? window.location.hostname : options.mode === "sandbox" ? SANDBOX_HOST : PRODUCTION_HOST);

    // All three of API base URL, telemetry sink, and widget mode come out of
    // this one call — they cannot independently disagree.
    const resolution = resolveEnvironment({ hostname, apiKey: options.publicKey });

    return new HoscooClient(options.publicKey, options.mode, resolution.apiBaseUrl, resolution.logSink);
  }

  private telemetry(event: string, data: Record<string, unknown>) {
    // Never log PAN, PIN, or full MSISDN client-side.
    void this.logSink;
    void event;
    void data;
  }

  private headers(idempotencyKey?: string): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.publicKey}`,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    };
  }

  private endpoint(path: string): string {
    return this.mode === "sandbox" ? `${this.baseUrl}/api/v1/sandbox${path}` : `${this.baseUrl}/api${path}`;
  }

  async initiatePayment(input: InitiatePaymentInput, opts?: { idempotencyKey?: string }): Promise<PaymentResult> {
    const idempotencyKey = opts?.idempotencyKey ?? randomIdempotencyKey();
    this.telemetry("payment.initiate", { channel: input.channel, destination: maskMsisdn(input.destination.identifier) });

    const path = this.mode === "sandbox" ? "/payments" : "/initiate-payment";
    const res = await fetch(this.endpoint(path), { method: "POST", headers: this.headers(idempotencyKey), body: JSON.stringify(input) });
    const json = await res.json();
    if (!res.ok) throw this.toSdkError(json);
    return json as PaymentResult;
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
    const path = this.mode === "sandbox" ? `/payments?transactionId=${transactionId}` : `/payment-status?transactionId=${transactionId}`;
    const res = await fetch(this.endpoint(path), { headers: this.headers() });
    const json = await res.json();
    if (!res.ok) throw this.toSdkError(json);
    return json as PaymentResult;
  }

  /** Resolves a pending 3-DS/step-up challenge (sandbox only) — see components/sandbox/test-bank-modal.tsx. */
  async resolveChallenge(transactionId: string, decision: "approved" | "denied"): Promise<PaymentResult> {
    if (this.mode !== "sandbox") {
      throw new HoscooSdkError("VALIDATION_FAILED", "resolveChallenge is only available in sandbox mode");
    }
    const res = await fetch(this.endpoint("/payments/challenge"), { method: "POST", headers: this.headers(), body: JSON.stringify({ transactionId, decision }) });
    const json = await res.json();
    if (!res.ok) throw this.toSdkError(json);
    return json as PaymentResult;
  }

  async getFxQuote(input: { corridorId: string; amountMinor: string; adverse?: boolean }): Promise<FxQuoteResult> {
    if (this.mode !== "sandbox") {
      throw new HoscooSdkError("VALIDATION_FAILED", "getFxQuote is only available in sandbox mode in this SDK build");
    }
    const res = await fetch(this.endpoint("/fx-quote"), { method: "POST", headers: this.headers(), body: JSON.stringify(input) });
    const json = await res.json();
    if (!res.ok) throw this.toSdkError(json);
    return json as FxQuoteResult;
  }

  async refreshFxQuote(quoteId: string): Promise<FxQuoteResult> {
    if (this.mode !== "sandbox") {
      throw new HoscooSdkError("VALIDATION_FAILED", "refreshFxQuote is only available in sandbox mode in this SDK build");
    }
    const res = await fetch(this.endpoint(`/fx-quote?quoteId=${quoteId}`), { headers: this.headers() });
    const json = await res.json();
    if (!res.ok) throw this.toSdkError(json);
    return json as FxQuoteResult;
  }

  private toSdkError(envelope: ErrorEnvelope): HoscooSdkError {
    return new HoscooSdkError(envelope.error.code, envelope.error.message, envelope.error.details);
  }
}
