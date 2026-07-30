/**
 * Production instantiation of the shared webhook dispatcher core
 * (lib/webhooks/core.ts) — the same event names, signing, retry-with-backoff,
 * and delivery-log mechanics as the sandbox (lib/sandbox/webhooks.ts), in a
 * completely separate, isolated dispatcher instance so a production
 * merchant's events and delivery log can never mix with sandbox traffic.
 *
 * Deliberately does not expose replayDelivery via a public route today —
 * replay was scoped as a sandbox testing primitive. The underlying core
 * supports it identically for production if that's ever needed; only the
 * route surface differs.
 */
import { createWebhookDispatcher } from "./webhooks/core";
import type { WebhookEvent, PendingDelivery, DeliveryLogEntry, DeliveryStatus } from "./webhooks/core";
import { LIFECYCLE_EVENT_NAMES, CROSS_BORDER_EVENT_NAMES, type WebhookEventType } from "./webhooks/events";

export { LIFECYCLE_EVENT_NAMES, CROSS_BORDER_EVENT_NAMES };
export type { WebhookEvent, PendingDelivery, DeliveryLogEntry, DeliveryStatus, WebhookEventType };

const dispatcher = createWebhookDispatcher("production");

export const registerWebhookEndpoint = dispatcher.registerWebhookEndpoint;
export const getWebhookEndpoint = dispatcher.getWebhookEndpoint;
export const emitEvent = dispatcher.emitEvent;
export const getEvent = dispatcher.getEvent;
export const drainPendingDeliveries = dispatcher.drainPendingDeliveries;
export const listDeliveryLog = dispatcher.listDeliveryLog;
