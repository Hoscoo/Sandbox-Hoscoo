/**
 * Sandbox instantiation of the shared webhook dispatcher core
 * (lib/webhooks/core.ts). This file owns nothing about signing, retry, or
 * delivery HTTP mechanics itself — it only creates an isolated dispatcher
 * scoped to the sandbox plane, so a sandbox tenant's events, endpoints, and
 * delivery log are namespaced apart from production's (see lib/webhooks.ts).
 */
import { createWebhookDispatcher, ReplayRateLimitedError, ReplayNotFoundError } from "../webhooks/core";
import type { WebhookEvent, PendingDelivery, DeliveryLogEntry, DeliveryStatus } from "../webhooks/core";
import { LIFECYCLE_EVENT_NAMES, CROSS_BORDER_EVENT_NAMES, type WebhookEventType } from "../webhooks/events";

export { LIFECYCLE_EVENT_NAMES, CROSS_BORDER_EVENT_NAMES, ReplayRateLimitedError, ReplayNotFoundError };
export type { WebhookEvent, PendingDelivery, DeliveryLogEntry, DeliveryStatus, WebhookEventType };

const dispatcher = createWebhookDispatcher("sandbox");

export const registerWebhookEndpoint = dispatcher.registerWebhookEndpoint;
export const getWebhookEndpoint = dispatcher.getWebhookEndpoint;
export const emitEvent = dispatcher.emitEvent;
export const getEvent = dispatcher.getEvent;
export const drainPendingDeliveries = dispatcher.drainPendingDeliveries;
export const replayDelivery = dispatcher.replayDelivery;
export const listDeliveryLog = dispatcher.listDeliveryLog;
