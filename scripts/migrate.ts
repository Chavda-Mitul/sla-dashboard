/**
 * Applies db/schema.sql to DATABASE_URL (read from .env.local if present). Safe to re-run.
 *
 *   npm run db:migrate
 */
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

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
