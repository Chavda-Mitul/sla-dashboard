/**
 * Applies db/schema.sql to DATABASE_URL. Safe to re-run.
 *
 *   npm run db:migrate                                                # local DB from .env.local
 *   npx tsx --env-file=.env.production.local scripts/migrate.ts       # Neon, after `vercel env pull`
 */
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

// An already-set DATABASE_URL (e.g. from --env-file) wins over .env.local.
if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (put it in .env.local, or run `vercel env pull .env.local`)");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(readFileSync("db/schema.sql", "utf8"));
  console.log(`Schema applied to ${new URL(connectionString).host}`);
} finally {
  await client.end();
}
