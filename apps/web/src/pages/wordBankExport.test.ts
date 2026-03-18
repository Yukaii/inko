import { describe, expect, it } from "vite-plus/test";
import { buildDeckExportCsv, buildDeckExportFilename } from "./wordBankExport";

describe("buildDeckExportCsv", () => {
  it("includes the import-compatible columns in order", () => {
    const csv = buildDeckExportCsv([
      {
        id: "word_1",
        userId: "user_1",
        language: "ja",
        target: "勉強",
        reading: "べんきょう",
        meaning: "study",
        romanization: "benkyou",
        example: "毎日、勉強します。",
        tags: ["jlpt", "n5"],
      },
    ]);

    expect(csv).toBe(
      "target,reading,meaning,romanization,example,tags\n" +
        "勉強,べんきょう,study,benkyou,毎日、勉強します。,\"jlpt, n5\"",
    );
  });

  it("escapes commas, quotes, and line breaks", () => {
    const csv = buildDeckExportCsv([
      {
        id: "word_2",
        userId: "user_1",
        language: "es",
        target: "\"quote\", value",
        meaning: "line 1\nline 2",
        tags: ["tag"],
      },
    ]);

    expect(csv).toContain("\"\"\"quote\"\", value\"");
    expect(csv).toContain("\"line 1\nline 2\"");
  });
});

describe("buildDeckExportFilename", () => {
  it("creates a stable csv filename", () => {
    expect(buildDeckExportFilename("JLPT N5 Deck", "ja", new Date("2026-02-28T12:00:00.000Z"))).toBe(
      "jlpt-n5-deck-ja-export-2026-02-28.csv",
    );
  });

  it("falls back when the deck name does not slugify", () => {
    expect(buildDeckExportFilename("!!!", "es", new Date("2026-02-28T12:00:00.000Z"))).toBe(
      "deck-es-export-2026-02-28.csv",
    );
  });
});
