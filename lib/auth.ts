/**
 * Shared API-key auth core for both planes. Each plane calls this with the
 * one key prefix it accepts — sandbox routes require hsc_test_, production
 * routes require hsc_live_ — so a key can never authorize the wrong plane
 * even if proxy.ts's hostname gate were somehow bypassed.
 */
import { extractApiKeyPrefix, type ApiKeyPrefix } from "./sandbox/environment";
import { HoscooApiError } from "./errors";

function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice("Bearer ".length);
  return req.headers.get("x-api-key");
}

function requireApiKeyWithPrefix(req: Request, expectedPrefix: ApiKeyPrefix): string {
  const key = extractApiKey(req);
  if (!key || extractApiKeyPrefix(key) !== expectedPrefix) {
    throw new HoscooApiError("UNAUTHORIZED", `A valid ${expectedPrefix} API key is required for this route`, 401);
  }
  return key;
}

export function requireProductionApiKey(req: Request): string {
  return requireApiKeyWithPrefix(req, "hsc_live_");
}

export function requireSandboxApiKey(req: Request): string {
  return requireApiKeyWithPrefix(req, "hsc_test_");
}
