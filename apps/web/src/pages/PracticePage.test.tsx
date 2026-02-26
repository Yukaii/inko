import { describe, expect, it } from "vitest";
import { canSubmitCard } from "./PracticePage.js";

describe("canSubmitCard", () => {
  it("requires handwriting and audio", () => {
    expect(
      canSubmitCard({
        handwritingCompleted: false,
        typingInput: "勉強",
        expected: "勉強",
        reading: "べんきょう",
        audioPlayed: true,
      }),
    ).toBe(false);

    expect(
      canSubmitCard({
        handwritingCompleted: true,
        typingInput: "勉強",
        expected: "勉強",
        reading: "べんきょう",
        audioPlayed: false,
      }),
    ).toBe(false);
  });

  it("accepts exact target or reading", () => {
    expect(
      canSubmitCard({
        handwritingCompleted: true,
        typingInput: "勉強",
        expected: "勉強",
        reading: "べんきょう",
        audioPlayed: true,
      }),
    ).toBe(true);

    expect(
      canSubmitCard({
        handwritingCompleted: true,
        typingInput: "べんきょう",
        expected: "勉強",
        reading: "べんきょう",
        audioPlayed: true,
      }),
    ).toBe(true);
  });
});
