import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { env } from "../lib/env";
import type { Database } from "./types";

let pool: Pool | null = null;
let db: Kysely<Database> | null = null;

export function getDb() {
  if (db) return db;

  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
  });

  db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });

  return db;
}

export async function closeDb() {
  await db?.destroy();
  db = null;
  pool = null;
}
