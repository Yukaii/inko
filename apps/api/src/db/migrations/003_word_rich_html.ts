import { Kysely } from "kysely";
import type { Database } from "../types";

const HTML_COLUMNS = ["target_html", "reading_html", "romanization_html", "meaning_html", "example_html"] as const;

export async function up(db: Kysely<Database>): Promise<void> {
  for (const column of HTML_COLUMNS) {
    await db.schema.alterTable("words").addColumn(column, "text").execute();
  }
}

export async function down(db: Kysely<Database>): Promise<void> {
  for (const column of HTML_COLUMNS) {
    await db.schema.alterTable("words").dropColumn(column).execute();
  }
}
