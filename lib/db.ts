import pg from "pg";

let pool: pg.Pool | undefined;

/**
 * Lazily created, so importing a module never needs the database. A warm serverless instance
 * reuses the pool across invocations; it holds connections, not application state.
 * DATABASE_URL is Neon's pooled connection string in production, a local Postgres in development.
 */
export function db(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({ connectionString, max: 3, idleTimeoutMillis: 10_000 });
  }
  return pool;
}

/** For scripts and tests that need to exit cleanly. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
