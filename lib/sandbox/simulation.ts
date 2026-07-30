/**
 * Programmable outcome simulation. Three mechanisms, in explicit precedence
 * order (highest first):
 *
 *   1. Per-request header directive (X-Hoscoo-Simulate) — the escape hatch,
 *      scoped to exactly the one request that carries it.
 *   2. Programmable rule (registered via POST /api/v1/sandbox/simulate) —
 *      scoped per API key so concurrent CI runs on different keys can never
 *      interfere with each other. Rules are matched by scope (next-call,
 *      per-account, per-key, time-boxed) and, among matches, the most
 *      specific + most recently created rule wins.
 *   3. Magic value — stateless and derived purely from the request payload
 *      (e.g. a magic MSISDN or account identifier), so it is shareable across
 *      a whole team and safe to run in parallel without any registration
 *      step.
 *
 * A header directive always overrides a matching rule; a rule always
 * overrides a magic value. This lets a single CI run drop a header to force
 * one specific call to misbehave without touching a shared rule any other
 * parallel test might depend on.
 */
import { randomUUID } from "node:crypto";
import type { ErrorCode } from "../errors";
import type { LifecycleState } from "../lifecycle";

export type SimulationOutcome =
  | { kind: "LIFECYCLE_STATE"; state: LifecycleState; reasonCode?: ErrorCode }
  | { kind: "THREE_DS_CHALLENGE" }
  | { kind: "THREE_DS_FAILURE" }
  | { kind: "RAIL_UNAVAILABLE"; providerCode: string }
  | { kind: "DEBIT_SUCCEEDED_CREDIT_FAILED" }
  | { kind: "TIME_FAST_FORWARD"; toIso: string }
  | { kind: "QUOTE_EXPIRED_MID_FLIGHT" }
  | { kind: "ADVERSE_RATE_MOVEMENT" }
  | { kind: "CORRIDOR_LIQUIDITY_EXHAUSTED" }
  | { kind: "OUTSIDE_CUTOFF" };

export type RuleScope =
  | { type: "NEXT_CALL" }
  | { type: "PER_ACCOUNT"; identifier: string }
  | { type: "PER_KEY" }
  | { type: "TIME_BOXED"; expiresAt: string };

export interface SimulationRule {
  id: string;
  apiKey: string;
  scope: RuleScope;
  outcome: SimulationOutcome;
  createdAt: string;
  /** NEXT_CALL rules are consumed after one match; all other scopes persist until expiry/deletion. */
  consumed: boolean;
}

const RULES: SimulationRule[] = []; // per-key scoping is enforced by filtering on apiKey at read time, never a shared global match.

export function registerRule(apiKey: string, scope: RuleScope, outcome: SimulationOutcome, now: Date = new Date()): SimulationRule {
  const rule: SimulationRule = { id: `hsc_rule_${randomUUID()}`, apiKey, scope, outcome, createdAt: now.toISOString(), consumed: false };
  RULES.push(rule);
  return rule;
}

export function listRules(apiKey: string): SimulationRule[] {
  return RULES.filter((r) => r.apiKey === apiKey && !r.consumed);
}

export function clearRules(apiKey: string): void {
  for (let i = RULES.length - 1; i >= 0; i--) {
    if (RULES[i]!.apiKey === apiKey) RULES.splice(i, 1);
  }
}

function ruleMatches(rule: SimulationRule, apiKey: string, accountIdentifier: string | undefined, now: Date): boolean {
  if (rule.apiKey !== apiKey || rule.consumed) return false;
  switch (rule.scope.type) {
    case "NEXT_CALL":
    case "PER_KEY":
      return true;
    case "PER_ACCOUNT":
      return rule.scope.identifier === accountIdentifier;
    case "TIME_BOXED":
      return new Date(rule.scope.expiresAt).getTime() > now.getTime();
  }
}

/** Rule specificity for precedence among multiple matching rules: narrower scopes win over broader ones. */
function scopeSpecificity(scope: RuleScope): number {
  switch (scope.type) {
    case "NEXT_CALL":
      return 3;
    case "PER_ACCOUNT":
      return 2;
    case "TIME_BOXED":
      return 1;
    case "PER_KEY":
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Magic values — stateless, derived purely from request content.
// ---------------------------------------------------------------------------

const MAGIC_MSISDN_OUTCOMES: Record<string, SimulationOutcome> = {
  "+255700000100": { kind: "LIFECYCLE_STATE", state: "COMPLETED" },
  "+255700000101": { kind: "LIFECYCLE_STATE", state: "FAILED", reasonCode: "INSUFFICIENT_FUNDS" },
  "+255700000102": { kind: "LIFECYCLE_STATE", state: "FAILED", reasonCode: "TIMEOUT" },
  "+255700000103": { kind: "LIFECYCLE_STATE", state: "EXPIRED" },
  "+255700000104": { kind: "LIFECYCLE_STATE", state: "FAILED", reasonCode: "ALIAS_UNMAPPED" },
  "+255700000105": { kind: "THREE_DS_CHALLENGE" },
  "+255700000106": { kind: "THREE_DS_FAILURE" },
  "+255700000107": { kind: "RAIL_UNAVAILABLE", providerCode: "*" },
  "+255700000108": { kind: "DEBIT_SUCCEEDED_CREDIT_FAILED" },
};

const MAGIC_QUOTE_ID_OUTCOMES: Record<string, SimulationOutcome> = {
  hsc_quote_expired: { kind: "QUOTE_EXPIRED_MID_FLIGHT" },
  hsc_quote_adverse: { kind: "ADVERSE_RATE_MOVEMENT" },
  hsc_quote_illiquid: { kind: "CORRIDOR_LIQUIDITY_EXHAUSTED" },
  hsc_quote_after_cutoff: { kind: "OUTSIDE_CUTOFF" },
};

function magicOutcome(input: { msisdn?: string; quoteId?: string }): SimulationOutcome | undefined {
  if (input.msisdn && MAGIC_MSISDN_OUTCOMES[input.msisdn]) return MAGIC_MSISDN_OUTCOMES[input.msisdn];
  if (input.quoteId && MAGIC_QUOTE_ID_OUTCOMES[input.quoteId]) return MAGIC_QUOTE_ID_OUTCOMES[input.quoteId];
  return undefined;
}

// ---------------------------------------------------------------------------
// Header directive parsing
// ---------------------------------------------------------------------------

export function parseHeaderDirective(headerValue: string | null): SimulationOutcome | undefined {
  if (!headerValue) return undefined;
  try {
    const parsed = JSON.parse(headerValue) as SimulationOutcome;
    return parsed;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export function resolveSimulationOutcome(input: {
  apiKey: string;
  accountIdentifier?: string;
  msisdn?: string;
  quoteId?: string;
  headerDirective: string | null;
  now?: Date;
}): SimulationOutcome | undefined {
  const now = input.now ?? new Date();

  const headerOutcome = parseHeaderDirective(input.headerDirective);
  if (headerOutcome) return headerOutcome;

  const matching = RULES.filter((r) => ruleMatches(r, input.apiKey, input.accountIdentifier, now));
  if (matching.length > 0) {
    matching.sort((a, b) => scopeSpecificity(b.scope) - scopeSpecificity(a.scope) || b.createdAt.localeCompare(a.createdAt));
    const winner = matching[0]!;
    if (winner.scope.type === "NEXT_CALL") winner.consumed = true;
    return winner.outcome;
  }

  return magicOutcome({ msisdn: input.msisdn, quoteId: input.quoteId });
}
