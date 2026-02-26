import { describe, expect, it } from "vitest";
import { canSubmitCard, getTypingFeedback } from "./PracticePage.js";

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

describe("getTypingFeedback", () => {
  it("tracks prefix streak when input is on target", () => {
    const feedback = getTypingFeedback({
      typingInput: "べん",
      expected: "勉強",
      reading: "べんきょう",
    });

    expect(feedback.onTrack).toBe(true);
    expect(feedback.currentStreak).toBe(2);
    expect(feedback.target).toBe("べんきょう");
    expect(feedback.progress).toBe(40);
  });

  it("resets streak when mistyped", () => {
    const feedback = getTypingFeedback({
      typingInput: "べx",
      expected: "勉強",
      reading: "べんきょう",
    });

    expect(feedback.onTrack).toBe(false);
    expect(feedback.currentStreak).toBe(0);
    expect(feedback.accuracy).toBe(50);
  });
});
