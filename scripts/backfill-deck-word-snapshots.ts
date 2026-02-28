import { spawnSync } from "node:child_process";

type DeckWordLinkPage = {
  page: Array<{ linkId: string; wordId: string; hasSnapshot: boolean }>;
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
    console.log("Usage: bun run backfill:deck-word-snapshots -- [convex-run-flags]");
    console.log("Example: bun run backfill:deck-word-snapshots -- --prod");
    return;
  }

  const pageSize = 200;
  let cursor: string | null = null;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let pageCount = 0;
  const startedAt = Date.now();

  for (;;) {
    const page = runConvex<DeckWordLinkPage>(
      "decks:listDeckWordLinksPage",
      { cursor, limit: pageSize },
      passthrough,
    );
    pageCount += 1;

    const pageStartedAt = Date.now();
    const snapshotsMissing = page.page.filter((link) => !link.hasSnapshot).length;

    for (const link of page.page) {
      scanned += 1;
      if (link.hasSnapshot) {
        skipped += 1;
        continue;
      }

      runConvex("decks:backfillDeckWordSnapshot", { linkId: link.linkId }, passthrough);
      updated += 1;
    }

    const elapsedMs = Date.now() - startedAt;
    const pageElapsedMs = Date.now() - pageStartedAt;
    const processed = updated + skipped;
    const ratePerSecond = elapsedMs > 0 ? processed / (elapsedMs / 1000) : 0;
    const remainingEstimate = ratePerSecond > 0 && page.page.length === pageSize
      ? Math.max(0, pageSize / ratePerSecond)
      : 0;

    console.log(
      [
        `page=${pageCount}`,
        `page_size=${page.page.length}`,
        `missing=${snapshotsMissing}`,
        `scanned=${scanned}`,
        `updated=${updated}`,
        `skipped=${skipped}`,
        `elapsed=${formatDuration(elapsedMs)}`,
        `page_time=${formatDuration(pageElapsedMs)}`,
        `rate=${ratePerSecond.toFixed(1)}/s`,
        `next_page_eta=${formatDuration(remainingEstimate * 1000)}`,
      ].join(" | "),
    );

    if (page.isDone) break;
    cursor = page.continueCursor;
  }

  console.log(
    `done: scanned ${scanned} link(s), updated ${updated}, skipped ${skipped}, elapsed ${formatDuration(Date.now() - startedAt)}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
