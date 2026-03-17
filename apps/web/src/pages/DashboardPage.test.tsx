/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { buildSampleDeckWords, shouldShowDashboardOnboarding } from "../features/dashboard/utils/dashboardOnboarding";

const {
  mockDashboardStats,
  mockDashboardRecentSessions,
  mockListDecks,
  mockCreateDeck,
  mockCreateWordsBatch,
  mockMe,
  mockNavigate,
} = vi.hoisted(() => ({
  mockDashboardStats: vi.fn(),
  mockDashboardRecentSessions: vi.fn(),
  mockListDecks: vi.fn(),
  mockCreateDeck: vi.fn(),
  mockCreateWordsBatch: vi.fn(),
  mockMe: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: {
    dashboardStats: mockDashboardStats,
    dashboardRecentSessions: mockDashboardRecentSessions,
    listDecks: mockListDecks,
    createDeck: mockCreateDeck,
    createWordsBatch: mockCreateWordsBatch,
    me: mockMe,
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("../hooks/useKeyboard", () => ({
  registerShortcut: vi.fn(() => () => undefined),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === "string") return fallbackOrOptions;
      const translations: Record<string, string> = {
        "dashboard.welcome_back": "Welcome back",
        "dashboard.learner": "learner",
        "dashboard.good_day": "Good day, {{name}}",
        "dashboard.quick_start": "QUICK START",
        "dashboard.create_first_deck_cta": "Build your first deck to begin",
        "dashboard.statistics_aria": "Statistics",
        "dashboard.your_progress": "Your Progress",
        "dashboard.progress_hint": "Keep up the momentum!",
        "dashboard.to_focus": "to focus",
        "dashboard.practice_decks_aria": "Practice decks",
        "dashboard.no_decks": "No decks yet.",
        "dashboard.head_to": "Head to the",
        "dashboard.create_first_deck": "to create your first deck.",
        "dashboard.recent_sessions": "Recent Sessions",
        "dashboard.no_sessions": "No completed sessions yet.",
        "dashboard.onboarding.title": "Create your sample deck",
        "dashboard.onboarding.body": "We'll set up a starter deck so you can begin practicing right away.",
        "dashboard.onboarding.launch_title": "Your sample deck is ready",
        "dashboard.onboarding.launch_body": "Jump straight into your first practice session.",
        "dashboard.onboarding.create_cta": "Create sample deck",
        "dashboard.onboarding.launch_cta": "Start first practice",
        "dashboard.onboarding.retry": "Try again",
        "dashboard.onboarding.sample_deck_name": "Starter Japanese",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

function renderDashboardPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockDashboardStats.mockReset();
  mockDashboardRecentSessions.mockReset();
  mockListDecks.mockReset();
  mockCreateDeck.mockReset();
  mockCreateWordsBatch.mockReset();
  mockMe.mockReset();
  mockNavigate.mockReset();

  mockDashboardStats.mockResolvedValue({
    totalWordsLearned: 0,
    wordsDueToday: 0,
    learningStreak: 0,
    sessionTimeSeconds: 0,
  });
  mockDashboardRecentSessions.mockResolvedValue({ recentSessions: [] });
  mockListDecks.mockResolvedValue([]);
  mockMe.mockResolvedValue({
    id: "user-1",
    email: "user@example.com",
    displayName: "Aki",
    themeMode: "system",
    typingMode: "language_specific",
    ttsEnabled: true,
    srsConfig: { newCardsPerDay: 20, reviewsPerDay: 200, targetRetention: 0.9 },
    canModerateCommunity: false,
    themes: {
      light: {
        accentOrange: "#ff6b35",
        accentTeal: "#0f766e",
        bgPage: "#f6f4ef",
        bgCard: "#ffffff",
        bgElevated: "#ece7df",
        textPrimary: "#111827",
        textSecondary: "#4b5563",
        textOnAccent: "#111827",
      },
      dark: {
        accentOrange: "#ff6b35",
        accentTeal: "#14b8a6",
        bgPage: "#111827",
        bgCard: "#1f2937",
        bgElevated: "#374151",
        textPrimary: "#f9fafb",
        textSecondary: "#9ca3af",
        textOnAccent: "#111827",
      },
    },
    createdAt: 1,
  });
  mockCreateDeck.mockResolvedValue({
    id: "deck-sample",
    userId: "user-1",
    name: "Starter Japanese",
    language: "ja",
    archived: false,
    ttsEnabled: true,
    ttsVoice: "ja-JP-NanamiNeural",
    ttsRate: "default",
    createdAt: 1,
  });
  mockCreateWordsBatch.mockResolvedValue({ created: 6, words: [] });
});

describe("dashboardOnboarding", () => {
  it("shows onboarding only for first-run users", () => {
    expect(
      shouldShowDashboardOnboarding({
        decksCount: 0,
        recentSessionsCount: 0,
        hasStartedPracticeFlag: false,
      }),
    ).toBe(true);

    expect(
      shouldShowDashboardOnboarding({
        decksCount: 1,
        recentSessionsCount: 0,
        hasStartedPracticeFlag: false,
      }),
    ).toBe(false);
  });

  it("builds the six-card sample deck seed", () => {
    expect(buildSampleDeckWords()).toHaveLength(6);
    expect(buildSampleDeckWords()[0]).toMatchObject({
      target: "こんにちは",
      meaning: "hello",
    });
  });
});

describe("DashboardPage", () => {
  it("shows onboarding for a first-run user with no decks and no recent sessions", async () => {
    renderDashboardPage();

    expect(await screen.findByText("Create your sample deck")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create sample deck" })).toBeTruthy();
  });

  it("creates a sample deck and starter words from onboarding", async () => {
    renderDashboardPage();

    fireEvent.click(await screen.findByRole("button", { name: "Create sample deck" }));

    await waitFor(() => {
      expect(mockCreateDeck).toHaveBeenCalledWith("test-token", { name: "Starter Japanese", language: "ja" });
      expect(mockCreateWordsBatch).toHaveBeenCalledWith("test-token", "deck-sample", {
        words: buildSampleDeckWords(),
      });
    });

    expect(await screen.findByText("Your sample deck is ready")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start first practice" })).toBeTruthy();
  });

  it("navigates into practice from the launch state", async () => {
    renderDashboardPage();

    fireEvent.click(await screen.findByRole("button", { name: "Create sample deck" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start first practice" }));

    expect(mockNavigate).toHaveBeenCalledWith("/practice/deck-sample");
  });

  it("shows a retryable error when starter word seeding fails", async () => {
    mockCreateWordsBatch.mockRejectedValueOnce(new Error("Seed failed"));

    renderDashboardPage();

    fireEvent.click(await screen.findByRole("button", { name: "Create sample deck" }));

    expect(await screen.findByText("Seed failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
