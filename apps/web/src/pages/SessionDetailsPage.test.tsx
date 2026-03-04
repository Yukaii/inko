/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionDetailsPage } from "./SessionDetailsPage";

const { mockGetPracticeSessionDetails } = vi.hoisted(() => ({
  mockGetPracticeSessionDetails: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: {
    getPracticeSessionDetails: mockGetPracticeSessionDetails,
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === "string") {
        return fallbackOrOptions;
      }

      if (key === "dashboard.cards_count") {
        return "Cards";
      }

      return key;
    },
    i18n: { language: "en" },
  }),
}));

function renderSessionDetailsPage(sessionId = "session-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/sessions/${sessionId}`]}>
        <Routes>
          <Route path="/sessions/:sessionId" element={<SessionDetailsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGetPracticeSessionDetails.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("SessionDetailsPage", () => {
  it("renders an em dash when the API returns an invalid timestamp", async () => {
    mockGetPracticeSessionDetails.mockResolvedValue({
      sessionId: "session-1",
      deckId: "deck-1",
      deckName: "Core deck",
      language: "ja",
      startedAt: undefined,
      finishedAt: null,
      cardsCompleted: 3,
      durationSeconds: 42,
      avgShapeScore: 90,
      avgTypingScore: 91,
      avgListeningScore: 89,
      attempts: [],
    });

    renderSessionDetailsPage();

    expect(await screen.findByRole("heading", { name: "Core deck" })).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });
});
