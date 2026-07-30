import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument } from "../lib/openapi/build";
import { buildPostmanCollection } from "../lib/openapi/postman";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "openapi", "generated", "v1.json");
const POSTMAN_PATH = join(__dirname, "..", "public", "postman", "hoscoo-sandbox.postman_collection.json");

function main() {
  const doc = buildOpenApiDocument();
  const json = JSON.stringify(doc, null, 2) + "\n";
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, json, "utf-8");
  console.log(`Wrote ${OUTPUT_PATH}`);

  const collection = buildPostmanCollection();
  mkdirSync(dirname(POSTMAN_PATH), { recursive: true });
  writeFileSync(POSTMAN_PATH, JSON.stringify(collection, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${POSTMAN_PATH}`);
}

main();
