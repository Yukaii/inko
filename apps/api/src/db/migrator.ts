import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileMigrationProvider, Migrator } from "kysely";
import { getDb } from "./client";

export async function migrateToLatest() {
  const migrationFolder = fileURLToPath(new URL("./migrations", import.meta.url));
  const migrator = new Migrator({
    db: getDb(),
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    const status = result.status === "Success" ? "applied" : result.status.toLowerCase();
    console.log(`[db] ${status} ${result.migrationName}`);
  }

  if (error) {
    throw error;
  }
}
