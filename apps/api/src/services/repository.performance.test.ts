import { describe, expect, it } from "vite-plus/test";
import { PERFORMANCE_CONSTANTS, testChunkArray, testSanitizeCreateWordInput } from "./repository";

describe("repository performance guards", () => {
  it("chunks large imports into bounded batches", () => {
    const items = Array.from({ length: 10000 }, (_, i) => i);
    const chunks = testChunkArray(items, PERFORMANCE_CONSTANTS.BATCH_WORDS_CHUNK_SIZE);

    expect(chunks.length).toBe(50);
    expect(chunks[0].length).toBe(PERFORMANCE_CONSTANTS.BATCH_WORDS_CHUNK_SIZE);
    expect(chunks[chunks.length - 1].length).toBe(PERFORMANCE_CONSTANTS.BATCH_WORDS_CHUNK_SIZE);
    expect(chunks.every((chunk) => chunk.length <= PERFORMANCE_CONSTANTS.BATCH_WORDS_CHUNK_SIZE)).toBe(true);
  });

  it("keeps batch size under the configured array argument limit", () => {
    expect(PERFORMANCE_CONSTANTS.BATCH_WORDS_CHUNK_SIZE).toBeLessThan(
      PERFORMANCE_CONSTANTS.CONVEX_ARRAY_ARG_LIMIT,
    );
  });

  it("maps rich word create fields to database column names", () => {
    const sanitized = testSanitizeCreateWordInput({
      target: "勉強",
      targetHtml: "<b>勉強</b>",
      reading: "べんきょう",
      readingHtml: "<ruby>勉強<rt>べんきょう</rt></ruby>",
      romanization: "benkyou",
      romanizationHtml: "<i>benkyou</i>",
      meaning: "study",
      meaningHtml: "<b>study</b>",
      example: "毎日勉強します。",
      exampleHtml: "<span>毎日勉強します。</span>",
    });

    expect(sanitized).toMatchObject({
      target_html: "<b>勉強</b>",
      reading_html: "<ruby>勉強<rt>べんきょう</rt></ruby>",
      romanization_html: "<i>benkyou</i>",
      meaning_html: "<b>study</b>",
      example_html: "毎日勉強します。",
    });
    expect(sanitized).not.toHaveProperty("targetHtml");
    expect(sanitized).not.toHaveProperty("readingHtml");
    expect(sanitized).not.toHaveProperty("romanizationHtml");
    expect(sanitized).not.toHaveProperty("meaningHtml");
    expect(sanitized).not.toHaveProperty("exampleHtml");
  });
});
