import { Kysely } from "kysely";
import type { Database } from "../types";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("magic_link_tokens")
    .addColumn("token", "text", (col) => col.primaryKey())
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("expires_at", "bigint", (col) => col.notNull())
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .execute();

  await db.schema.createIndex("magic_link_tokens_email_idx").on("magic_link_tokens").column("email").execute();
  await db.schema.createIndex("magic_link_tokens_expires_at_idx").on("magic_link_tokens").column("expires_at").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("magic_link_tokens").ifExists().execute();
}
