import { Kysely, sql } from "kysely";
import { DEFAULT_SRS_CONFIG } from "@inko/shared";
import type { Database } from "../types";

export async function up(db: Kysely<Database>): Promise<void> {
  const defaultConfigLiteral = sql.raw(`'${JSON.stringify(DEFAULT_SRS_CONFIG)}'::jsonb`);
  await db.schema
    .alterTable("users")
    .addColumn("srs_config", "jsonb", (col) => col.notNull().defaultTo(defaultConfigLiteral))
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable("users").dropColumn("srs_config").execute();
}
