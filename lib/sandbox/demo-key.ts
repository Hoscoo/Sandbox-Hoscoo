/**
 * Shared API key for the in-app sandbox console demo pages
 * (components/checkout/*-panel.tsx, components/sandbox/*-console.tsx).
 * Deliberately ONE key across every demo panel — a real merchant tests
 * multiple channels under one key too, and it's what makes the webhook
 * console's delivery log actually show events emitted by the other panels
 * in the same browsing session.
 */
export const DEMO_SANDBOX_KEY = "hsc_test_demo_console";
export const DEMO_AUTH_HEADERS = { Authorization: `Bearer ${DEMO_SANDBOX_KEY}` };
