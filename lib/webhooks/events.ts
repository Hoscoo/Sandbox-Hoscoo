/**
 * Event names — mechanically derived from the canonical transition table in
 * lib/lifecycle.ts. A state with no incoming transition (PENDING_AUTHORIZATION,
 * the initial state) gets no lifecycle event, by construction, not by
 * omission. Shared by both planes so a production dispatcher can never
 * invent its own event name for the same state transition.
 */
import { TRANSITIONS, type LifecycleState } from "../lifecycle";

const STATES_WITH_INCOMING_TRANSITION = new Set<LifecycleState>(TRANSITIONS.map((t) => t.to));

export type LifecycleEventName = `payment.${Lowercase<LifecycleState>}`;

export const LIFECYCLE_EVENT_NAMES: Partial<Record<LifecycleState, LifecycleEventName>> = Object.fromEntries(
  Array.from(STATES_WITH_INCOMING_TRANSITION).map((state) => [state, `payment.${state.toLowerCase() as Lowercase<LifecycleState>}`]),
);

/**
 * Cross-border domain events. These are NOT lifecycle-state transitions —
 * quoting and FX application are sub-steps inside a single AUTHORIZED ->
 * ROUTING span, not states of their own — so they are declared explicitly
 * here rather than derived from TRANSITIONS. Each is only ever emitted from
 * the one call site that actually performs that step.
 */
export const CROSS_BORDER_EVENT_NAMES = {
  QUOTE_ISSUED: "fx.quote_issued",
  QUOTE_EXPIRED: "fx.quote_expired",
  FX_APPLIED: "fx.applied",
  CORRIDOR_SETTLEMENT_COMPLETED: "corridor.settlement_completed",
} as const;

export type WebhookEventType = LifecycleEventName | (typeof CROSS_BORDER_EVENT_NAMES)[keyof typeof CROSS_BORDER_EVENT_NAMES];
