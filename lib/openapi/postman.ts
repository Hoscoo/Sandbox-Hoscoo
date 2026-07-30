/**
 * Postman collection (v2.1) generated directly from the same OpenAPI
 * document, not maintained by hand — so "Run in Postman" can never point at
 * a stale request shape.
 */
import { buildOpenApiDocument } from "./build";

type OpenApiPaths = ReturnType<typeof buildOpenApiDocument>["paths"];

export function buildPostmanCollection() {
  const doc = buildOpenApiDocument();
  const sandboxServer = doc.servers.find((s) => s.url.includes("sandbox"))!.url;

  const items = Object.entries(doc.paths as OpenApiPaths).flatMap(([path, methods]) =>
    Object.entries(methods as Record<string, { summary?: string; tags?: string[] }>)
      .filter(([, op]) => op.tags?.includes("sandbox-only"))
      .map(([method, op]) => ({
        name: op.summary ?? `${method.toUpperCase()} ${path}`,
        request: {
          method: method.toUpperCase(),
          header: [
            { key: "Authorization", value: "Bearer {{hoscoo_test_key}}" },
            { key: "Content-Type", value: "application/json" },
          ],
          url: { raw: `${sandboxServer}${path}`, host: [sandboxServer], path: path.split("/").filter(Boolean) },
        },
      })),
  );

  return {
    info: { name: "Hoscoo Sandbox", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
    variable: [{ key: "hoscoo_test_key", value: "hsc_test_your_key_here" }],
    item: items,
  };
}
