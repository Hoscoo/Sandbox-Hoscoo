/**
 * CI drift gate: regenerates the OpenAPI document in-memory and fails the
 * build if it differs from the committed openapi/generated/v1.json. This is
 * what actually prevents the spec from silently going stale — run it as a
 * required CI step, not just on release.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument } from "../lib/openapi/build";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMITTED_PATH = join(__dirname, "..", "openapi", "generated", "v1.json");

function main() {
  const fresh = JSON.stringify(buildOpenApiDocument(), null, 2) + "\n";

  if (!existsSync(COMMITTED_PATH)) {
    console.error(`Missing ${COMMITTED_PATH}. Run \`npm run openapi:generate\` and commit the result.`);
    process.exit(1);
  }

  const committed = readFileSync(COMMITTED_PATH, "utf-8");
  if (committed !== fresh) {
    console.error(
      "OpenAPI spec drift detected: openapi/generated/v1.json does not match what the source-of-truth modules " +
        "(lib/providers.ts, lib/corridors.ts, lib/errors.ts, lib/lifecycle.ts, lib/sandbox/webhooks.ts) currently " +
        "generate. Run `npm run openapi:generate` and commit the updated file.",
    );
    process.exit(1);
  }

  console.log("OpenAPI spec is up to date.");
}

main();
