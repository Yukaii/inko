import { spawnSync } from "node:child_process";

type BackfillPage = {
  processed: number;
  created: number;
  updated: number;
  initializedProgress: number;
  continueCursor: string;
  isDone: boolean;
};

function runConvex<T>(fn: string, args: Record<string, unknown>, passthrough: string[]): T {
  const result = spawnSync(
    "bunx",
    ["convex", "run", fn, JSON.stringify(args), ...passthrough],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || `convex run failed for ${fn}`;
    throw new Error(message);
  }

  return JSON.parse(result.stdout) as T;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

async function main() {
  const passthrough = process.argv.slice(2);
  if (passthrough.includes("--help") || passthrough.includes("-h")) {
    console.log("Usage: bun run backfill:practice-queue -- [convex-run-flags]");
    console.log("Example: bun run backfill:practice-queue -- --prod");
    return;
  }

  const pageSize = 200;
  let cursor: string | null = null;
  let pageCount = 0;
  let processed = 0;
  let created = 0;
  let updated = 0;
  let initializedProgress = 0;
  const startedAt = Date.now();

  for (;;) {
    const pageStartedAt = Date.now();
    const result = runConvex<BackfillPage>(
      "practiceQueue:backfillEntriesPage",
      { cursor, limit: pageSize },
      passthrough,
    );

    pageCount += 1;
    processed += result.processed;
    created += result.created;
    updated += result.updated;
    initializedProgress += result.initializedProgress;

    const elapsedMs = Date.now() - startedAt;
    const pageElapsedMs = Date.now() - pageStartedAt;
    const ratePerSecond = elapsedMs > 0 ? processed / (elapsedMs / 1000) : 0;
    const nextPageEta = ratePerSecond > 0 && result.processed === pageSize
      ? (pageSize / ratePerSecond) * 1000
      : 0;

    console.log(
      [
        `page=${pageCount}`,
        `processed_page=${result.processed}`,
        `created_page=${result.created}`,
        `updated_page=${result.updated}`,
        `processed_total=${processed}`,
        `created_total=${created}`,
        `updated_total=${updated}`,
        `progress_rows=${initializedProgress}`,
        `elapsed=${formatDuration(elapsedMs)}`,
        `page_time=${formatDuration(pageElapsedMs)}`,
        `rate=${ratePerSecond.toFixed(1)}/s`,
        `next_page_eta=${formatDuration(nextPageEta)}`,
      ].join(" | "),
    );

    if (result.isDone) break;
    cursor = result.continueCursor;
  }

  console.log(
    `done: processed ${processed} link(s), created ${created}, updated ${updated}, initialized progress ${initializedProgress}, elapsed ${formatDuration(Date.now() - startedAt)}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
