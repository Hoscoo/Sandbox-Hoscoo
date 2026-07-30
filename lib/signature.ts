/**
 * HMAC-SHA256 instruction signing with deterministic canonicalisation, so
 * verification code a merchant writes against sandbox payloads is portable
 * to production payloads unchanged. Webhook delivery (lib/sandbox/webhooks.ts)
 * reuses this exact module rather than re-deriving a signing scheme.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Deterministic JSON canonicalisation: recursively sorted object keys, stable array order. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}

export function sign(payload: unknown, secret: string): string {
  return createHmac("sha256", secret).update(canonicalize(payload)).digest("hex");
}

export function verify(payload: unknown, signature: string, secret: string): boolean {
  const expected = sign(payload, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
