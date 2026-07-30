/**
 * Sandbox API key registry. Every hsc_test_-prefixed key that touches the
 * sandbox gets a real, trackable registry entry — not just a passing
 * prefix-format check. This is deliberately additive, not gate-keeping: any
 * syntactically valid hsc_test_ key auto-registers on first use rather than
 * being rejected for not having been "issued" first, so the sandbox stays
 * zero-friction and self-serve (the whole point of "developers integrate
 * against before touching live rails" — no signup wall). POST
 * /api/v1/sandbox/keys is the recommended path for a real, cryptographically
 * random key instead of a hand-typed string, but it is not required.
 *
 * Same in-memory durability caveat as lib/sandbox/store.ts and every other
 * sandbox-only registry (simulation rules, quotes) — this was never part of
 * the durable ledger requirement, only the ledger itself needed that.
 */
import { randomBytes } from "node:crypto";

export interface SandboxApiKeyRecord {
  key: string;
  label: string;
  createdAt: string;
  lastUsedAt: string;
}

const REGISTRY = new Map<string, SandboxApiKeyRecord>();

export function issueSandboxApiKey(label = "unlabeled", now: Date = new Date()): SandboxApiKeyRecord {
  const key = `hsc_test_${randomBytes(24).toString("hex")}`;
  const record: SandboxApiKeyRecord = { key, label, createdAt: now.toISOString(), lastUsedAt: now.toISOString() };
  REGISTRY.set(key, record);
  return record;
}

/** Auto-registers a key on first use, or bumps lastUsedAt if it's already known. Never rejects. */
export function touchSandboxApiKey(key: string, now: Date = new Date()): SandboxApiKeyRecord {
  const existing = REGISTRY.get(key);
  if (existing) {
    existing.lastUsedAt = now.toISOString();
    return existing;
  }
  const record: SandboxApiKeyRecord = { key, label: "auto-registered", createdAt: now.toISOString(), lastUsedAt: now.toISOString() };
  REGISTRY.set(key, record);
  return record;
}

export function getSandboxApiKey(key: string): SandboxApiKeyRecord | undefined {
  return REGISTRY.get(key);
}
