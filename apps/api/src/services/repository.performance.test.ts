import { describe, expect, it } from "vite-plus/test";
import { PERFORMANCE_CONSTANTS, testChunkArray } from "./repository";

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
});
