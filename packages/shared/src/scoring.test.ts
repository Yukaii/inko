import { describe, expect, it } from "vite-plus/test";
import {
  isJapaneseTypingMatch,
  isTypingMatch,
  normalizeJapaneseInput,
  normalizeTypingInput,
  romajiToHiragana,
  scoreListening,
  scoreTyping,
} from "./scoring";

describe("scoring", () => {
  it("normalizes full-width and spaces", () => {
    expect(normalizeJapaneseInput("　べ ん きょう　")).toBe("べんきょう");
  });

  it("preserves required word spaces for general typing", () => {
    expect(normalizeTypingInput("  New   York  ")).toBe("new york");
    expect(isTypingMatch("new york", "New York", undefined, undefined, "en", "language_specific")).toBe(true);
    expect(isTypingMatch("newyork", "New York", undefined, undefined, "en", "language_specific")).toBe(false);
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

  it("supports non-japanese matching in language-specific mode", () => {
    expect(isTypingMatch("hola", "hola", undefined, undefined, "es", "language_specific")).toBe(true);
    expect(isTypingMatch("HOLA", "hola", undefined, undefined, "es", "language_specific")).toBe(true);
    expect(isTypingMatch("holaa", "hola", undefined, undefined, "es", "language_specific")).toBe(false);
  });

  it("supports universal mode for japanese direct typing", () => {
    expect(isTypingMatch("勉強", "勉強", "べんきょう", "benkyou", "ja", "universal")).toBe(false);
    expect(isTypingMatch("benkyou", "勉強", "べんきょう", "benkyou", "ja", "universal")).toBe(true);
    expect(scoreTyping("benkyou", "勉強", "べんきょう", "benkyou", 1500, "ja", "universal")).toBe(100);
  });
});
