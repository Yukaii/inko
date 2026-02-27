import { describe, expect, it } from "vitest";
import { canSubmitCard, getTypingFeedback } from "./PracticePage.js";

describe("canSubmitCard", () => {
  it("requires correct romaji typing", () => {
    expect(
      canSubmitCard({
        typingInput: "manabu",
        expected: "勉強",
        reading: "べんきょう",
        romanization: "benkyou",
      }),
    ).toBe(false);

    expect(
      canSubmitCard({
        typingInput: "BENKYOU",
        expected: "勉強",
        reading: "べんきょう",
        romanization: "benkyou",
      }),
    ).toBe(true);
  });

  it("falls back to reading match when romanization is missing", () => {
    expect(
      canSubmitCard({
        typingInput: "benkyou",
        expected: "勉強",
        reading: "べんきょう",
      }),
    ).toBe(true);

    expect(
      canSubmitCard({
        typingInput: "BENKYOU",
        expected: "勉強",
        reading: "べんきょう",
      }),
    ).toBe(true);
  });
});

describe("getTypingFeedback", () => {
  it("tracks prefix streak when input is on target", () => {
    const feedback = getTypingFeedback({
      typingInput: "ben",
      expected: "勉強",
      reading: "べんきょう",
      romanization: "benkyou",
    });

    expect(feedback.onTrack).toBe(true);
    expect(feedback.currentStreak).toBe(3);
    expect(feedback.target).toBe("benkyou");
    expect(feedback.progress).toBe(43);
  });

  it("resets streak when mistyped", () => {
    const feedback = getTypingFeedback({
      typingInput: "bex",
      expected: "勉強",
      reading: "べんきょう",
      romanization: "benkyou",
    });

    expect(feedback.onTrack).toBe(false);
    expect(feedback.currentStreak).toBe(0);
    expect(feedback.accuracy).toBe(67);
  });
});
