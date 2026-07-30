import type { ErrorCode } from "../errors";

/** Typed SDK error matching the public reason-code taxonomy exactly — see lib/errors.ts. */
export class HoscooSdkError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "HoscooSdkError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Thrown synchronously by hoscoo.init() when `mode` and the publicKey prefix
 * disagree. This is the catastrophic case the SDK exists to make impossible:
 * a developer believing they are live while a test key (or vice versa) is
 * silently accepted. There is no code path in this SDK that resolves such a
 * mismatch to either environment — init() always throws instead.
 */
export class HoscooModeKeyMismatchError extends Error {
  constructor(mode: "sandbox" | "live", keyPrefix: string | null) {
    super(
      `hoscoo.init() was called with mode: '${mode}' but publicKey has prefix ` +
        `'${keyPrefix ?? "(unrecognized)"}'. A ${mode === "sandbox" ? "hsc_test_" : "hsc_live_"} key is required ` +
        `for mode: '${mode}'. Refusing to initialize into either environment.`,
    );
    this.name = "HoscooModeKeyMismatchError";
  }
}
