import { describe, expect, it } from "vitest";
import { isJapaneseTypingMatch, normalizeJapaneseInput, romajiToHiragana, scoreListening, scoreTyping } from "./scoring.js";

describe("scoring", () => {
  it("normalizes full-width and spaces", () => {
    expect(normalizeJapaneseInput("　べ ん きょう　")).toBe("べんきょう");
  });

  it("scores typing with speed bonus", () => {
    expect(scoreTyping("BENKYOU", "勉強", "べんきょう", "benkyou", 1500)).toBe(100);
    expect(scoreTyping("benkyou", "勉強", "べんきょう", "benkyou", 7000)).toBe(70);
    expect(scoreTyping("manabu", "勉強", "べんきょう", "benkyou", 1000)).toBe(0);
  });

  it("converts romaji to hiragana", () => {
    expect(romajiToHiragana("benkyou")).toBe("べんきょう");
    expect(romajiToHiragana("gakkou")).toBe("がっこう");
  });

  it("matches romanization in lowercase or uppercase", () => {
    expect(isJapaneseTypingMatch("BENKYOU", "勉強", "べんきょう", "benkyou")).toBe(true);
    expect(isJapaneseTypingMatch("benkyou", "勉強", "べんきょう", "benkyou")).toBe(true);
    expect(isJapaneseTypingMatch("勉強", "勉強", "べんきょう", "benkyou")).toBe(false);
  });

  it("maps listening confidence", () => {
    expect(scoreListening(1)).toBe(20);
    expect(scoreListening(5)).toBe(100);
  });
});
