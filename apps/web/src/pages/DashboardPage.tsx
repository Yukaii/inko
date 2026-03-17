import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { authQueryKey } from "../lib/queryKeys";
import { useDashboardDeckNavigation } from "../features/dashboard/hooks/useDashboardDeckNavigation";
import { useDashboardOnboarding } from "../features/dashboard/hooks/useDashboardOnboarding";
import { DashboardStats } from "../features/dashboard/components/DashboardStats";
import { PracticeDeckGrid } from "../features/dashboard/components/PracticeDeckGrid";
import { DashboardOnboardingPanel } from "../features/dashboard/components/DashboardOnboardingPanel";
import { RecentSessionsList } from "../features/dashboard/components/RecentSessionsList";

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: authQueryKey(token, "dashboard", "stats"),
    queryFn: () => api.dashboardStats(token ?? ""),
    enabled: Boolean(token),
    staleTime: 30_000,
  });
  const sessionsQuery = useQuery({
    queryKey: authQueryKey(token, "dashboard", "recent-sessions"),
    queryFn: () => api.dashboardRecentSessions(token ?? ""),
    enabled: Boolean(token),
    staleTime: 30_000,
  });
  const meQuery = useQuery({
    queryKey: authQueryKey(token, "me"),
    queryFn: () => api.me(token ?? ""),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const decksQuery = useQuery({
    queryKey: authQueryKey(token, "decks"),
    queryFn: () => api.listDecks(token ?? ""),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const decks = decksQuery.data ?? [];
  const activeDecks = decks.filter((deck) => !deck.archived);
  const decksById = new Map(decks.map((deck) => [deck.id, deck]));
  const stats = statsQuery.data;
  const dueToday = stats?.wordsDueToday ?? 0;
  const totalWordsLearned = stats?.totalWordsLearned ?? 0;
  const learningStreak = stats?.learningStreak ?? 0;
  const sessionTimeSeconds = stats?.sessionTimeSeconds ?? 0;
  const canQuickStart = activeDecks.length > 0;
  const recentSessionsCount = sessionsQuery.data?.recentSessions.length ?? 0;
  const deckNavigation = useDashboardDeckNavigation({ activeDecks, navigate, t });
  const onboarding = useDashboardOnboarding({
    token,
    decksCount: decks.length,
    recentSessionsCount,
    t,
    navigate,
    queryClient,
  });

  const goToFirstDeck = () => {
    const firstDeck = activeDecks[0];
    if (firstDeck) {
      navigate(`/practice/${firstDeck.id}`);
      return;
    }
    navigate("/word-bank");
  };

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <header className="rounded-[28px] border border-[var(--border-subtle)] bg-bg-card px-6 py-6 md:px-8 md:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <p className="m-0 font-mono text-sm text-text-secondary">
              {t("dashboard.welcome_back")}
            </p>
            <h1 className="m-0 text-[38px] leading-none font-semibold [font-family:var(--font-display)] md:text-[42px]">
              {t("dashboard.good_day", {
                name: meQuery.data?.displayName ?? t("dashboard.learner"),
              })}
            </h1>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-[18px] bg-accent-orange px-5 py-4 text-left text-text-on-accent transition-transform hover:scale-[1.01] active:scale-[0.99] lg:w-auto lg:min-w-[240px]"
            onClick={goToFirstDeck}
          >
            <Play size={18} className="shrink-0 fill-current" />
            <span className="flex min-w-0 flex-col">
              <span className="font-mono text-[12px] font-bold uppercase tracking-[0.08em]">
                {t("dashboard.quick_start")}
              </span>
              <span className="font-mono text-[11px] opacity-80">
                {canQuickStart
                  ? t("dashboard.due_today_cards", { count: dueToday })
                  : t("dashboard.create_first_deck_cta")}
              </span>
            </span>
          </button>
        </div>
      </header>

      <DashboardStats
        t={t}
        isLoading={statsQuery.isLoading}
        totalWordsLearned={totalWordsLearned}
        dueToday={dueToday}
        learningStreak={learningStreak}
        sessionTimeSeconds={sessionTimeSeconds}
      />

      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[24px] font-semibold [font-family:var(--font-display)]">
              {t("dashboard.your_progress")}
            </h2>
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary">
              {t("dashboard.progress_hint")}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-primary shadow-sm">
            <kbd className="rounded bg-bg-card px-1.5 py-0.5 font-mono">p</kbd>
            <span>{t("dashboard.to_focus")}</span>
          </span>
        </div>

        {decksQuery.isLoading ? null : activeDecks.length > 0 ? (
          <PracticeDeckGrid
            t={t}
            language={i18n.language}
            activeDecks={activeDecks}
            focusedDeckIndex={deckNavigation.focusedDeckIndex}
            gridRef={deckNavigation.practiceGridRef}
            onKeyDown={deckNavigation.handlePracticeKeyDown}
            onDeckClick={(deckId) => navigate(`/practice/${deckId}`)}
          />
        ) : onboarding.shouldShowOnboarding ? (
          <DashboardOnboardingPanel
            t={t}
            stepLabel={onboarding.onboardingStepLabel}
            createdSampleDeckId={onboarding.createdSampleDeckId}
            onboardingError={onboarding.onboardingError}
            isCreatingSampleDeck={onboarding.isCreatingSampleDeck}
            onCreateSampleDeck={() => void onboarding.handleCreateSampleDeck()}
            onStartFirstPractice={onboarding.handleStartFirstPractice}
          />
        ) : (
          <section className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-bg-card px-8 py-10 text-center text-text-secondary">
            <p className="m-0 text-base text-text-primary">{t("dashboard.no_decks")}</p>
            <p className="mt-2 text-sm">
              {t("dashboard.head_to")}{" "}
              <Link to="/word-bank" className="text-accent-orange hover:underline">
                {t("nav.word_bank")}
              </Link>{" "}
              {t("dashboard.create_first_deck")}
            </p>
          </section>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="m-0 text-[24px] font-semibold [font-family:var(--font-display)]">
          {t("dashboard.recent_sessions")}
        </h2>

        <RecentSessionsList
          t={t}
          language={i18n.language}
          isLoading={sessionsQuery.isLoading}
          recentSessions={sessionsQuery.data?.recentSessions ?? []}
          decksById={decksById}
          onSessionClick={(sessionId) => navigate(`/sessions/${sessionId}`)}
        />
      </section>
    </div>
  );
}
