import { closeDb } from "../db/client";
import { migrateToLatest } from "../db/migrator";

try {
  await migrateToLatest();
} finally {
  await closeDb();
}
