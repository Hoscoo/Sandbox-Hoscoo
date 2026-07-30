/**
 * Public reason-code taxonomy. Shared verbatim between the production error
 * envelope, the sandbox, and the SDK's typed error classes so the two planes
 * cannot drift on error codes.
 */

export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "MARKET_NOT_LIVE",
  "UNKNOWN_PROVIDER",
  "SAME_PROVIDER_ON_US",
  "INSUFFICIENT_FUNDS",
  "ALIAS_UNMAPPED",
  "RAIL_UNAVAILABLE",
  "TIMEOUT",
  "THREE_DS_CHALLENGE_FAILED",
  "DEBIT_SUCCEEDED_CREDIT_FAILED",
  "QUOTE_EXPIRED",
  "RATE_MOVED",
  "CORRIDOR_LIQUIDITY_EXHAUSTED",
  "OUTSIDE_CUTOFF",
  "IDEMPOTENCY_KEY_REUSED",
  "SIGNATURE_INVALID",
  "ENVIRONMENT_MISMATCH",
  "UNAUTHORIZED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function errorEnvelope(code: ErrorCode, message: string, details?: Record<string, unknown>): ErrorEnvelope {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

export class HoscooApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly httpStatus: number;

  constructor(code: ErrorCode, message: string, httpStatus = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = "HoscooApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }

  toEnvelope(): ErrorEnvelope {
    return errorEnvelope(this.code, this.message, this.details);
  }
}
