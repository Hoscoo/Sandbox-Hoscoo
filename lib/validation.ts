/**
 * Field-level validation for the dual-leg payment payload. Shared verbatim
 * between the production initiate-payment route and the sandbox — a second
 * validator is exactly the kind of drift this codebase cannot tolerate.
 */
import { CHANNEL_LEGS, CHANNELS, ACCOUNT_TYPES, providerCodesForLeg, type AccountType, type Channel, type LegKind } from "./providers";
import { CURRENCIES, MARKETS, type CurrencyCode, type Market } from "./corridors";
import { ERROR_CODES, type ErrorCode } from "./errors";

export interface LegInput {
  providerCode: string;
  accountType: AccountType;
  identifier: string;
}

export interface PaymentInstructionInput {
  channel: Channel;
  /** Minor units as a decimal-string integer — bigint has no JSON wire form. */
  amountMinor: string;
  currency: CurrencyCode;
  market: Market;
  source: LegInput;
  destination: LegInput;
  reference: string;
  /** CROSS_BORDER only. */
  destinationCurrency?: CurrencyCode;
  quoteId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentInstruction extends Omit<PaymentInstructionInput, "amountMinor"> {
  amountMinor: bigint;
}

export interface ValidationError {
  field: string;
  code: ErrorCode;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: PaymentInstruction }
  | { ok: false; errors: ValidationError[] };

const AMOUNT_PATTERN = /^[1-9][0-9]*$|^0$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function err(field: string, code: ErrorCode, message: string): ValidationError {
  return { field, code, message };
}

function isKnownErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code);
}

function validateLeg(field: "source" | "destination", leg: unknown, legKind: LegKind): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof leg !== "object" || leg === null) {
    return [err(field, "VALIDATION_FAILED", `${field} is required`)];
  }
  const l = leg as Record<string, unknown>;

  if (typeof l.providerCode !== "string" || l.providerCode.length === 0) {
    errors.push(err(`${field}.providerCode`, "VALIDATION_FAILED", "providerCode is required"));
  } else if (!providerCodesForLeg(legKind).includes(l.providerCode)) {
    errors.push(err(`${field}.providerCode`, "UNKNOWN_PROVIDER", `Unknown ${legKind} provider code: ${l.providerCode}`));
  }

  if (typeof l.accountType !== "string" || !(ACCOUNT_TYPES as readonly string[]).includes(l.accountType)) {
    errors.push(err(`${field}.accountType`, "VALIDATION_FAILED", "accountType is invalid"));
  }

  if (typeof l.identifier !== "string" || l.identifier.trim().length === 0) {
    errors.push(err(`${field}.identifier`, "VALIDATION_FAILED", "identifier is required"));
  }

  return errors;
}

export function validatePaymentRequest(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: [err("$", "VALIDATION_FAILED", "Request body must be a JSON object")] };
  }
  const body = input as Record<string, unknown>;

  if (typeof body.channel !== "string" || !(CHANNELS as readonly string[]).includes(body.channel)) {
    errors.push(err("channel", "VALIDATION_FAILED", `channel must be one of ${CHANNELS.join(", ")}`));
  }

  let amountMinor: bigint | undefined;
  if (typeof body.amountMinor !== "string" || !AMOUNT_PATTERN.test(body.amountMinor)) {
    errors.push(err("amountMinor", "VALIDATION_FAILED", "amountMinor must be a non-negative integer string"));
  } else {
    amountMinor = BigInt(body.amountMinor);
    if (amountMinor <= 0n) {
      errors.push(err("amountMinor", "VALIDATION_FAILED", "amountMinor must be greater than zero"));
    }
  }

  if (typeof body.currency !== "string" || !(CURRENCIES as readonly string[]).includes(body.currency)) {
    errors.push(err("currency", "VALIDATION_FAILED", `currency must be one of ${CURRENCIES.join(", ")}`));
  }

  if (typeof body.market !== "string" || !(MARKETS as readonly string[]).includes(body.market)) {
    errors.push(err("market", "VALIDATION_FAILED", `market must be one of ${MARKETS.join(", ")}`));
  }

  const channel = typeof body.channel === "string" && (CHANNELS as readonly string[]).includes(body.channel) ? (body.channel as Channel) : undefined;
  if (channel) {
    const legs = CHANNEL_LEGS[channel];
    errors.push(...validateLeg("source", body.source, legs.source));
    errors.push(...validateLeg("destination", body.destination, legs.destination));

    if (channel === "CROSS_BORDER") {
      if (typeof body.destinationCurrency !== "string" || !(CURRENCIES as readonly string[]).includes(body.destinationCurrency)) {
        errors.push(err("destinationCurrency", "VALIDATION_FAILED", "destinationCurrency is required for CROSS_BORDER"));
      }
      if (typeof body.quoteId !== "string" || body.quoteId.length === 0) {
        errors.push(err("quoteId", "VALIDATION_FAILED", "quoteId is required for CROSS_BORDER"));
      }
    }
  } else {
    errors.push(err("source", "VALIDATION_FAILED", "source is required"));
    errors.push(err("destination", "VALIDATION_FAILED", "destination is required"));
  }

  if (typeof body.reference !== "string" || !REFERENCE_PATTERN.test(body.reference)) {
    errors.push(err("reference", "VALIDATION_FAILED", "reference must match ^[A-Za-z0-9._-]{1,64}$"));
  }

  if (body.metadata !== undefined) {
    if (typeof body.metadata !== "object" || body.metadata === null || Array.isArray(body.metadata)) {
      errors.push(err("metadata", "VALIDATION_FAILED", "metadata must be a flat string-keyed object"));
    }
  }

  if (errors.length > 0 || amountMinor === undefined || !channel) {
    return { ok: false, errors: errors.filter((e) => isKnownErrorCode(e.code)) };
  }

  return {
    ok: true,
    value: {
      channel,
      amountMinor,
      currency: body.currency as CurrencyCode,
      market: body.market as Market,
      source: body.source as LegInput,
      destination: body.destination as LegInput,
      reference: body.reference as string,
      destinationCurrency: body.destinationCurrency as CurrencyCode | undefined,
      quoteId: body.quoteId as string | undefined,
      metadata: body.metadata as Record<string, string> | undefined,
    },
  };
}
