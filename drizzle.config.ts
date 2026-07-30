import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/sandbox/db/schema.ts",
  out: "./lib/sandbox/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
} satisfies Config;
