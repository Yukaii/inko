import type { LanguageCode, WordDTO } from "@inko/shared";

const CSV_HEADERS = ["target", "reading", "meaning", "romanization", "example", "tags"] as const;

export type DeckExportTarget = {
  id: string;
  name: string;
  language: LanguageCode;
};

type ListWordsPage = (
  deckId: string,
  options: { cursor?: string | null; limit?: number },
) => Promise<{ words: WordDTO[]; nextCursor: string | null; isDone: boolean }>;

function escapeCsvValue(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildDeckExportCsv(words: WordDTO[]) {
  const rows = words.map((word) =>
    [
      word.target,
      word.reading ?? "",
      word.meaning,
      word.romanization ?? "",
      word.example ?? "",
      (word.tags ?? []).join(", "),
    ]
      .map((value) => escapeCsvValue(value))
      .join(","),
  );

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function buildDeckExportFilename(deckName: string, language: string, now = new Date()) {
  const slug = deckName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeDeckName = slug || "deck";
  const date = now.toISOString().slice(0, 10);
  return `${safeDeckName}-${language}-export-${date}.csv`;
}

export async function fetchAllDeckWords(deckId: string, listWordsPage: ListWordsPage) {
  const exportedWords: WordDTO[] = [];
  let cursor: string | null = null;

  do {
    const page = await listWordsPage(deckId, {
      cursor,
      limit: 500,
    });
    exportedWords.push(...page.words);
    cursor = page.isDone ? null : page.nextCursor;
  } while (cursor !== null);

  return exportedWords;
}

export function downloadDeckCsv(deck: DeckExportTarget, words: WordDTO[]) {
  const csv = buildDeckExportCsv(words);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildDeckExportFilename(deck.name, deck.language);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}
