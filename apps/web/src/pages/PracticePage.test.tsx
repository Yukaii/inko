/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { canSubmitCard, getPracticeCompletionTitle, getTypingFeedback, isEscDoublePress, PracticePage } from "./PracticePage";

const {
  mockStartPractice,
  mockSubmitPractice,
  mockFinishPractice,
  mockUpdateDeck,
  mockFetchWordTts,
} = vi.hoisted(() => ({
  mockStartPractice: vi.fn(),
  mockSubmitPractice: vi.fn(),
  mockFinishPractice: vi.fn(),
  mockUpdateDeck: vi.fn(),
  mockFetchWordTts: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: {
    startPractice: mockStartPractice,
    submitPractice: mockSubmitPractice,
    finishPractice: mockFinishPractice,
    updateDeck: mockUpdateDeck,
    fetchWordTts: mockFetchWordTts,
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("../hooks/useKeyboard", () => ({
  registerShortcut: () => () => undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: "en" },
  }),
}));

function renderPracticePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/practice/deck-1"]}>
        <Routes>
          <Route path="/practice/:deckId" element={<PracticePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockStartPractice.mockReset();
  mockSubmitPractice.mockReset();
  mockFinishPractice.mockReset();
  mockUpdateDeck.mockReset();
  mockFetchWordTts.mockReset();
  mockFetchWordTts.mockResolvedValue(new Blob(["audio"], { type: "audio/mpeg" }));
  vi.stubGlobal("Audio", class {
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
  });
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock-audio"),
    revokeObjectURL: vi.fn(),
  });
});

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

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "practice.daily_target_reached": "Daily target reached",
    "practice.session_complete": "Session Complete",
  };
  return translations[key] || key;
};

describe("getPracticeCompletionTitle", () => {
  it("shows daily target reached when session is capped", () => {
    expect(
      getPracticeCompletionTitle({
        sessionCapped: true,
        cardsCompleted: 50,
        sessionTargetCards: 50,
        t: mockT,
      }),
    ).toBe("Daily target reached");
  });

  it("shows daily target reached when completed cards hit target", () => {
    expect(
      getPracticeCompletionTitle({
        sessionCapped: false,
        cardsCompleted: 50,
        sessionTargetCards: 50,
        t: mockT,
      }),
    ).toBe("Daily target reached");
  });

  it("shows session complete when target is not reached", () => {
    expect(
      getPracticeCompletionTitle({
        sessionCapped: false,
        cardsCompleted: 12,
        sessionTargetCards: 50,
        t: mockT,
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

describe("PracticePage", () => {
  it("shows the example sentence when the practice card includes one", async () => {
    mockStartPractice.mockResolvedValue({
      sessionId: "session-1",
      card: {
        wordId: "word-1",
        deckId: "deck-1",
        language: "ja",
        target: "勉強",
        reading: "べんきょう",
        romanization: "benkyou",
        meaning: "study",
        example: "毎日日本語を勉強しています。",
      },
      upcomingCards: [],
      ttsEnabled: false,
      typingMode: "language_specific",
      sessionTargetCards: 50,
      cardsCompleted: 0,
    });

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByText("毎日日本語を勉強しています。")).toBeTruthy();
    });
  });
});
