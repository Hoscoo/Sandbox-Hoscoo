/**
 * Single authoritative environment resolution.
 *
 * PRIMARY SIGNAL: hostname. It is chosen over the API key prefix because it is
 * infrastructure-level truth — it is what Vercel's edge routes on (see
 * vercel.json) before any application code, including the key parser, ever
 * runs. A key is caller-supplied data and can be wrong, stale, or malicious;
 * the hostname the request actually arrived on cannot be spoofed by a client
 * choosing a different key.
 *
 * The key prefix is then used as a CROSS-CHECK, not a second primary signal.
 * A mismatch fails closed: it throws EnvironmentMismatchError rather than
 * picking one signal and silently routing. This is the one function every
 * caller (proxy.ts, every API route, the SDK) must go through, so the base
 * URL, the log sink, and the widget mode are always derived from the same
 * single decision and can never disagree with one another.
 *
 * RESIDUAL RISK: this app is a single Vercel project with a single shared
 * datastore behind both hostnames today. Isolation is therefore enforced in
 * code (this function, the SandboxStore key-namespacing in
 * lib/sandbox/store.ts, and the proxy fail-closed check), not by
 * infrastructure boundaries. That is an acceptable posture for a sandbox that
 * moves no real money, but it stops being acceptable the moment a live rail
 * exists — the trigger for splitting sandbox into its own Vercel
 * project/datastore is "first live rail integration ships," not before.
 */

export type Environment = "production" | "sandbox";

export const PRODUCTION_HOST = "api.hoscoo.com";
export const SANDBOX_HOST = "sandbox-api.hoscoo.com";

export type ApiKeyPrefix = "hsc_test_" | "hsc_live_";

export function extractApiKeyPrefix(apiKey: string | null | undefined): ApiKeyPrefix | null {
  if (!apiKey) return null;
  if (apiKey.startsWith("hsc_test_")) return "hsc_test_";
  if (apiKey.startsWith("hsc_live_")) return "hsc_live_";
  return null;
}

export interface EnvironmentResolution {
  environment: Environment;
  apiBaseUrl: string;
  logSink: string;
  widgetMode: "live" | "sandbox";
}

export const ENVIRONMENT_MISMATCH_CODE = "ENVIRONMENT_MISMATCH" as const;

export class EnvironmentMismatchError extends Error {
  readonly code = ENVIRONMENT_MISMATCH_CODE;
  readonly hostEnvironment: Environment;
  readonly keyPrefix: ApiKeyPrefix;

  constructor(hostEnvironment: Environment, keyPrefix: ApiKeyPrefix) {
    super(
      `A ${keyPrefix} key was presented at the ${hostEnvironment} origin. Test keys only work against ` +
        `${SANDBOX_HOST}; live keys only work against ${PRODUCTION_HOST}. Refusing to route.`,
    );
    this.name = "EnvironmentMismatchError";
    this.hostEnvironment = hostEnvironment;
    this.keyPrefix = keyPrefix;
  }
}

function environmentForHost(hostname: string): Environment {
  // Anything that isn't explicitly the sandbox hostname resolves to
  // production. This is deliberate fail-closed behavior: an unrecognized or
  // spoofed hostname must never be treated as sandbox, because sandbox mode
  // relaxes nothing about auth but does relax where money can move from —
  // treating an unknown host as production is the safer default.
  return hostname === SANDBOX_HOST ? "sandbox" : "production";
}

/**
 * The one function that decides environment for a request. Every downstream
 * concern (base URL, log sink, widget mode) is derived from the same
 * `environment` value in this same call, so they cannot independently drift.
 *
 * Throws EnvironmentMismatchError (fail closed) when the API key prefix
 * disagrees with the hostname-derived environment.
 */
export function resolveEnvironment(input: { hostname: string; apiKey?: string | null }): EnvironmentResolution {
  const environment = environmentForHost(input.hostname);
  const keyPrefix = extractApiKeyPrefix(input.apiKey);

  if (keyPrefix === "hsc_test_" && environment === "production") {
    throw new EnvironmentMismatchError(environment, keyPrefix);
  }
  if (keyPrefix === "hsc_live_" && environment === "sandbox") {
    throw new EnvironmentMismatchError(environment, keyPrefix);
  }

  if (environment === "sandbox") {
    return {
      environment,
      apiBaseUrl: `https://${SANDBOX_HOST}`,
      logSink: "sandbox",
      widgetMode: "sandbox",
    };
  }
  return {
    environment,
    apiBaseUrl: `https://${PRODUCTION_HOST}`,
    logSink: "production",
    widgetMode: "live",
  };
}
