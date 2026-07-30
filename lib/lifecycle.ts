/**
 * Canonical transaction lifecycle. This is the single source of truth for
 * state names — webhook event names in lib/sandbox/webhooks.ts are derived
 * mechanically from TRANSITIONS so no event can exist without a
 * corresponding transition.
 */

export const LIFECYCLE_STATES = [
  "PENDING_AUTHORIZATION",
  "AUTHORIZED",
  "ROUTING",
  "SETTLING",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export interface Transition {
  from: LifecycleState;
  to: LifecycleState;
}

export const TRANSITIONS: Transition[] = [
  { from: "PENDING_AUTHORIZATION", to: "AUTHORIZED" },
  { from: "AUTHORIZED", to: "ROUTING" },
  { from: "ROUTING", to: "SETTLING" },
  { from: "SETTLING", to: "COMPLETED" },
  { from: "PENDING_AUTHORIZATION", to: "FAILED" },
  { from: "AUTHORIZED", to: "FAILED" },
  { from: "ROUTING", to: "FAILED" },
  { from: "SETTLING", to: "FAILED" },
  { from: "PENDING_AUTHORIZATION", to: "EXPIRED" },
  { from: "AUTHORIZED", to: "EXPIRED" },
];

export function isValidTransition(from: LifecycleState, to: LifecycleState): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to);
}

const TERMINAL: ReadonlySet<LifecycleState> = new Set(["COMPLETED", "FAILED", "EXPIRED"]);
export function isTerminalState(state: LifecycleState): boolean {
  return TERMINAL.has(state);
}
