import { describe, expect, it } from "vitest";
import { canSubmitCard, getPracticeCompletionTitle, getTypingFeedback, isEscDoublePress } from "./PracticePage";

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

  it("supports non-japanese cards", () => {
    expect(
      canSubmitCard({
        typingInput: "HOLA",
        expected: "hola",
        language: "es",
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

describe("getPracticeCompletionTitle", () => {
  it("shows daily target reached when session is capped", () => {
    expect(
      getPracticeCompletionTitle({
        sessionCapped: true,
        cardsCompleted: 50,
        sessionTargetCards: 50,
      }),
    ).toBe("Daily target reached");
  });

  it("shows daily target reached when completed cards hit target", () => {
    expect(
      getPracticeCompletionTitle({
        sessionCapped: false,
        cardsCompleted: 50,
        sessionTargetCards: 50,
      }),
    ).toBe("Daily target reached");
  });

  it("shows session complete when target is not reached", () => {
    expect(
      getPracticeCompletionTitle({
        sessionCapped: false,
        cardsCompleted: 12,
        sessionTargetCards: 50,
      }),
    ).toBe("Session Complete");
  });
});

describe("isEscDoublePress", () => {
  it("returns true when second escape is inside window", () => {
    expect(isEscDoublePress(1000, 1800)).toBe(true);
  });

  it("returns false when second escape is outside window", () => {
    expect(isEscDoublePress(1000, 2200)).toBe(false);
  });

  it("returns false when there is no first escape", () => {
    expect(isEscDoublePress(null, 1500)).toBe(false);
  });
});
