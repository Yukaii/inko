import { closeDb } from "../db/client";
import { migrateToLatest } from "../db/migrator";

async function main() {
  try {
    await migrateToLatest();
  } finally {
    await closeDb();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
