/**
 * Standard Postgres wire-protocol connection via `pg`, not the Neon
 * serverless HTTP driver — this is a deliberate choice, not an oversight.
 * Neon fully supports normal Postgres connections in addition to its HTTP
 * proxy, and `pg` works identically against a local Postgres (used in
 * lib/sandbox/db/__tests__ against a Docker container) and a real Neon
 * database, so the exact same code path is what actually gets tested. If
 * this ever needs to run on the Vercel Edge runtime specifically, swap this
 * client for `@neondatabase/serverless` + `drizzle-orm/neon-http` — the
 * PostgresSandboxStore in postgres-store.ts is written against the Drizzle
 * query builder, not this file's connection details, so that swap does not
 * touch call sites.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Keyed by connection string so distinct PostgresSandboxStore instances
// pointed at different databases (e.g. two tests against two containers)
// never silently share a pool — each connection string gets its own.
const pools = new Map<string, Pool>();

export function getDb(connectionString: string = requireDatabaseUrl()) {
  let pool = pools.get(connectionString);
  if (!pool) {
    pool = new Pool({ connectionString });
    pools.set(connectionString, pool);
  }
  return drizzle(pool, { schema });
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to use the Postgres-backed SandboxStore");
  return url;
}

export async function closeDb(): Promise<void> {
  await Promise.all(Array.from(pools.values()).map((p) => p.end()));
  pools.clear();
}
