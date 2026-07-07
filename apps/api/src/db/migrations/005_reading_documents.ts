import { Kysely, sql } from "kysely";
import type { Database } from "../types";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("reading_documents")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("source_language", "text", (col) => col.notNull())
    .addColumn("translation_language", "text", (col) => col.notNull())
    .addColumn("source_kind", "text", (col) => col.notNull())
    .addColumn("source_name", "text")
    .addColumn("paragraphs", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("paragraph_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("completed_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "bigint", (col) => col.notNull())
    .addColumn("updated_at", "bigint", (col) => col.notNull())
    .execute();

  await db.schema.createIndex("reading_documents_user_id_idx").on("reading_documents").column("user_id").execute();
  await db.schema.createIndex("reading_documents_updated_at_idx").on("reading_documents").column("updated_at").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("reading_documents").ifExists().execute();
}
