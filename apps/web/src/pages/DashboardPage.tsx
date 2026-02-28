import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { registerShortcut } from "../hooks/useKeyboard";
import { BookOpen, ChevronRight, Clock, Flame, Play, Star, Target, TrendingUp } from "lucide-react";

function clampProgress(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(10, Math.min(100, Math.round((value / max) * 100)));
}

function formatClockDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatPracticeDuration(totalSeconds: number) {
  if (totalSeconds >= 60) {
    return `${Math.floor(totalSeconds / 60)}m`;
  }
  return `${Math.max(0, totalSeconds)}s`;
}

function formatDeckDate(timestamp: number, language: string) {
  return new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function formatSessionDate(timestamp: number, language: string) {
  return new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function StatsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-4" aria-label="Statistics">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
          <div className="mb-4 h-3 w-28 animate-pulse rounded bg-bg-elevated" />
          <div className="mb-4 h-10 w-20 animate-pulse rounded bg-bg-elevated" />
          <div className="h-3 w-36 animate-pulse rounded bg-bg-elevated" />
        </div>
      ))}
    </section>
  );
}

function DeckSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-5"
        >
          <div className="mb-3 h-3 w-12 animate-pulse rounded bg-bg-elevated" />
          <div className="mb-6 h-6 w-28 animate-pulse rounded bg-bg-elevated" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-bg-elevated" />
        </div>
      ))}
    </div>
  );
}

function RecentSessionsSkeleton() {
  return (
    <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-2">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-4 last:border-b-0"
        >
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-bg-elevated" />
            <div className="h-3 w-24 animate-pulse rounded bg-bg-elevated" />
          </div>
          <div className="h-4 w-32 animate-pulse rounded bg-bg-elevated" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const practiceGridRef = useRef<HTMLUListElement>(null);
  const [focusedDeckIndex, setFocusedDeckIndex] = useState(-1);

  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.dashboardStats(token ?? ""),
    enabled: Boolean(token),
    staleTime: 30_000,
  });
  const sessionsQuery = useQuery({
    queryKey: ["dashboard", "recent-sessions"],
    queryFn: () => api.dashboardRecentSessions(token ?? ""),
    enabled: Boolean(token),
    staleTime: 30_000,
  });
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(token ?? ""),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const decksQuery = useQuery({
    queryKey: ["decks"],
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

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    cleanups.push(
      registerShortcut({
        key: "w",
        handler: () => navigate("/word-bank"),
        description: t("shortcuts.go_word_bank", "Go to Word Bank"),
      }),
    );

    cleanups.push(
      registerShortcut({
        key: "p",
        handler: () => {
          if (activeDecks.length > 0) {
            setFocusedDeckIndex(0);
            const firstCard = practiceGridRef.current?.querySelector(
              "[data-deck-index='0']",
            ) as HTMLElement | null;
            firstCard?.focus();
          }
        },
        description: t("dashboard.focus_decks_shortcut", "Focus practice decks"),
      }),
    );

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [activeDecks.length, navigate, t]);

  const handlePracticeKeyDown = (event: React.KeyboardEvent) => {
    const maxIndex = activeDecks.length - 1;
    if (maxIndex < 0) return;

    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        setFocusedDeckIndex((prev) => {
          const next = prev + 1;
          return next > maxIndex ? 0 : next;
        });
        break;
      case "ArrowLeft":
        event.preventDefault();
        setFocusedDeckIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? maxIndex : next;
        });
        break;
      case "Enter":
        if (focusedDeckIndex >= 0 && focusedDeckIndex <= maxIndex) {
          event.preventDefault();
          const deck = activeDecks[focusedDeckIndex];
          if (deck) {
            navigate(`/practice/${deck.id}`);
          }
        }
        break;
      case "Home":
        event.preventDefault();
        setFocusedDeckIndex(0);
        break;
      case "End":
        event.preventDefault();
        setFocusedDeckIndex(maxIndex);
        break;
    }
  };

  useEffect(() => {
    if (focusedDeckIndex >= 0) {
      const card = practiceGridRef.current?.querySelector(
        `[data-deck-index='${focusedDeckIndex}']`,
      ) as HTMLElement | null;
      card?.focus();
    }
  }, [focusedDeckIndex]);

  const goToFirstDeck = () => {
    const firstDeck = activeDecks[0];
    if (firstDeck) {
      navigate(`/practice/${firstDeck.id}`);
      return;
    }
    navigate("/word-bank");
  };

  const sessionTimeMinutes = Math.floor(sessionTimeSeconds / 60);

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

      {statsQuery.isLoading ? (
        <StatsSkeleton />
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-4" aria-label="Statistics">
          <article className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-text-secondary">
              <BookOpen size={14} />
              <span>{t("dashboard.stats.words_learned")}</span>
            </div>
            <div className="mb-3 text-[36px] leading-none font-bold [font-family:var(--font-display)]">
              {totalWordsLearned}
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-accent-teal">
              <TrendingUp size={12} />
              <span>{t("dashboard.words_learned_support", { count: dueToday })}</span>
            </div>
          </article>

          <article className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-text-secondary">
              <Target size={14} className="text-accent-orange" />
              <span>{t("dashboard.stats.due_today")}</span>
            </div>
            <div className="mb-3 text-[36px] leading-none font-bold text-accent-orange [font-family:var(--font-display)]">
              {dueToday}
            </div>
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-accent-orange transition-[width]"
                  style={{ width: `${clampProgress(dueToday, 40)}%` }}
                />
              </div>
              <p className="m-0 font-mono text-[11px] text-text-secondary">
                {t("dashboard.ready_to_review")}
              </p>
            </div>
          </article>

          <article className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-text-secondary">
              <Flame size={14} className="text-accent-teal" />
              <span>{t("dashboard.stats.day_streak")}</span>
            </div>
            <div className="mb-3 text-[36px] leading-none font-bold text-accent-teal [font-family:var(--font-display)]">
              {learningStreak}
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-text-secondary">
              <Star size={12} className="text-accent-teal" />
              <span>{t("dashboard.streak_support")}</span>
            </div>
          </article>

          <article className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
            <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-text-secondary">
              <Clock size={14} />
              <span>{t("dashboard.stats.session_time")}</span>
            </div>
            <div className="mb-3 text-[36px] leading-none font-bold [font-family:var(--font-display)]">
              {formatClockDuration(sessionTimeSeconds)}
            </div>
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-text-primary transition-[width]"
                  style={{ width: `${clampProgress(sessionTimeMinutes, 30)}%` }}
                />
              </div>
              <p className="m-0 font-mono text-[11px] text-text-secondary">
                {t("dashboard.session_time_support")}
              </p>
            </div>
          </article>
        </section>
      )}

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

        {decksQuery.isLoading ? (
          <DeckSkeletons />
        ) : activeDecks.length > 0 ? (
          <ul
            ref={practiceGridRef}
            className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2 xl:grid-cols-4"
            onKeyDown={handlePracticeKeyDown}
            aria-label={t("dashboard.practice_decks_aria")}
          >
            {activeDecks.map((deck, index) => {
              const isFeatured = index === 0;
              const isFocused = focusedDeckIndex === index;

              return (
                <li
                  key={deck.id}
                  data-deck-index={index}
                  tabIndex={isFocused ? 0 : -1}
                  onClick={() => navigate(`/practice/${deck.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      navigate(`/practice/${deck.id}`);
                    }
                  }}
                  className={`group flex cursor-pointer flex-col gap-5 rounded-[24px] border bg-bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent-orange focus:-translate-y-0.5 focus:outline-none ${
                    isFeatured
                      ? "border-accent-orange shadow-[0_18px_40px_-28px_var(--accent-orange)]"
                      : "border-[var(--border-subtle)]"
                  } ${isFocused ? "border-accent-orange" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.14em] text-text-secondary">
                        {deck.language.toUpperCase()}
                      </p>
                      <h3 className="mt-1 text-[24px] leading-tight font-semibold text-text-primary [font-family:var(--font-display)]">
                        {deck.name}
                      </h3>
                    </div>

                    {isFeatured ? (
                      <span className="shrink-0 rounded-md bg-accent-orange/12 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-orange">
                        {t("dashboard.featured_deck_label")}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      {!isFeatured ? (
                        <p className="m-0 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary">
                          {t("dashboard.deck_added_label")}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-text-secondary">
                        {isFeatured
                          ? t("dashboard.deck_focus_hint")
                          : t("dashboard.added_on", {
                              date: formatDeckDate(deck.createdAt, i18n.language),
                            })}
                      </p>
                    </div>

                    <button
                      type="button"
                      className={`inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2 font-mono text-[12px] transition-colors ${
                        isFeatured
                          ? "bg-accent-orange font-semibold text-text-on-accent"
                          : "bg-bg-elevated text-text-secondary group-hover:text-text-primary"
                      }`}
                    >
                      {isFeatured
                        ? t("dashboard.resume_session")
                        : t("dashboard.start_practice")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
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

        {sessionsQuery.isLoading ? (
          <RecentSessionsSkeleton />
        ) : (
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-2">
            {(sessionsQuery.data?.recentSessions ?? []).map((session) => {
              const finishedAt = session.finishedAt ?? session.startedAt;
              const durationSeconds = Math.max(
                0,
                Math.round((finishedAt - session.startedAt) / 1000),
              );
              const deck = decksById.get(session.deckId);
              const sessionDeckName = deck?.name ?? session.deckName ?? t("dashboard.session_label");
              const sessionDeckLanguage = deck?.language?.toUpperCase();

              return (
                <div
                  key={session.sessionId}
                  className="flex flex-col gap-3 border-b border-[var(--border-subtle)] px-4 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-text-secondary">
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {sessionDeckLanguage ? (
                          <span className="inline-flex items-center rounded-md bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                            {sessionDeckLanguage}
                          </span>
                        ) : null}
                        <p className="m-0 text-base font-medium text-text-primary [font-family:var(--font-display)]">
                          {sessionDeckName}
                        </p>
                      </div>
                      <p className="m-0 font-mono text-[12px] text-text-secondary">
                        {formatSessionDate(finishedAt, i18n.language)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    <span className="font-mono text-[13px] text-text-primary">
                      {t("dashboard.cards_and_time", {
                        count: session.cardsCompleted,
                        duration: formatPracticeDuration(durationSeconds),
                      })}
                    </span>
                    <ChevronRight size={16} className="text-text-secondary" aria-hidden="true" />
                  </div>
                </div>
              );
            })}

            {sessionsQuery.data?.recentSessions?.length === 0 ? (
              <p className="m-0 px-5 py-5 text-center text-[13px] text-text-secondary">
                {t("dashboard.no_sessions")}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
