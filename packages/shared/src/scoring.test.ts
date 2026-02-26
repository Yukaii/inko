import { describe, expect, it } from "vitest";
import { normalizeJapaneseInput, scoreListening, scoreTyping } from "./scoring.js";

describe("scoring", () => {
  it("normalizes full-width and spaces", () => {
    expect(normalizeJapaneseInput("　べ ん きょう　")).toBe("べんきょう");
  });

  it("scores typing with speed bonus", () => {
    expect(scoreTyping("勉強", "勉強", "べんきょう", 1500)).toBe(100);
    expect(scoreTyping("勉強", "勉強", "べんきょう", 7000)).toBe(70);
    expect(scoreTyping("違う", "勉強", "べんきょう", 1000)).toBe(0);
  });

  it("maps listening confidence", () => {
    expect(scoreListening(1)).toBe(20);
    expect(scoreListening(5)).toBe(100);
  });
});
