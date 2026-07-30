/**
 * Sandbox auth: the shared prefix-check core from lib/auth.ts, plus
 * auto-registration into lib/sandbox/keys.ts's real key registry. Production
 * (lib/auth.ts's requireProductionApiKey) does NOT get this — auto-
 * registering an arbitrary live key would be a very different, much worse
 * decision than doing it for a sandbox key. See PARITY.md's auth row for
 * why this is an intentional asymmetry, not drift.
 */
import { requireSandboxApiKey as requireSandboxApiKeyCore } from "../auth";
import { touchSandboxApiKey } from "./keys";

export function requireSandboxApiKey(req: Request): string {
  const key = requireSandboxApiKeyCore(req);
  touchSandboxApiKey(key);
  return key;
}
