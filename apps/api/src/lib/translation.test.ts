import { describe, expect, it } from "vite-plus/test";
import { translationService } from "./translation";

describe("translation service", () => {
  it("returns sentence-level fallback translation scaffolding", async () => {
    const result = await translationService.translateParagraph({
      sourceLanguage: "ja",
      translationLanguage: "English",
      paragraph: "私は寿司を食べる。水を飲む。",
    });

    expect(result.engine).toBe("fallback");
    expect(result.sentenceTranslations).toEqual([
      { source: "私は寿司を食べる。", translation: "[Japanese -> English] 私は寿司を食べる。" },
      { source: "水を飲む。", translation: "[Japanese -> English] 水を飲む。" },
    ]);
    expect(result.meaningHints.length).toBeGreaterThan(0);
  });
});
