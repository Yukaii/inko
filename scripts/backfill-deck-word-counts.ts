import { spawnSync } from "node:child_process";

type DeckPage = {
  page: Array<{ deckId: string; name: string }>;
  continueCursor: string;
  isDone: boolean;
};

type CountPage = {
  counted: number;
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

async function main() {
  const passthrough = process.argv.slice(2);
  if (passthrough.includes("--help") || passthrough.includes("-h")) {
    console.log("Usage: bun run backfill:deck-word-counts -- [convex-run-flags]");
    console.log("Example: bun run backfill:deck-word-counts -- --prod");
    return;
  }
  const deckPageSize = 100;
  const wordPageSize = 1000;

  let deckCursor: string | null = null;
  let updatedDecks = 0;

  for (;;) {
    const decks = runConvex<DeckPage>("decks:listDeckIdsPage", { cursor: deckCursor, limit: deckPageSize }, passthrough);

    for (const deck of decks.page) {
      let wordCursor: string | null = null;
      let total = 0;

      for (;;) {
        const countPage = runConvex<CountPage>(
          "decks:countDeckWordsPage",
          { deckId: deck.deckId, cursor: wordCursor, limit: wordPageSize },
          passthrough,
        );
        total += countPage.counted;

        if (countPage.isDone) break;
        wordCursor = countPage.continueCursor;
      }

      runConvex("decks:setDeckWordCount", { deckId: deck.deckId, wordCount: total }, passthrough);
      updatedDecks += 1;
      console.log(`backfilled ${deck.name} (${deck.deckId}) -> ${total}`);
    }

    if (decks.isDone) break;
    deckCursor = decks.continueCursor;
  }

  console.log(`done: updated ${updatedDecks} deck(s)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
