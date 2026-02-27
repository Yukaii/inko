import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { registerShortcut } from "../hooks/useKeyboard";
import { BookOpen, Target, Flame, Clock, Play } from "lucide-react";

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const practiceGridRef = useRef<HTMLUListElement>(null);
  const [focusedDeckIndex, setFocusedDeckIndex] = useState(-1);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard(token ?? ""),
  });
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(token ?? ""),
    enabled: Boolean(token),
  });

  const decksQuery = useQuery({
    queryKey: ["decks"],
    queryFn: () => api.listDecks(token ?? ""),
  });

  const decks = decksQuery.data ?? [];
  const activeDecks = decks.filter((d) => !d.archived);

  // Register keyboard shortcuts
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // 'w' to go to word bank
    cleanups.push(
      registerShortcut({
        key: "w",
        handler: () => navigate("/word-bank"),
        description: t("shortcuts.go_word_bank", "Go to Word Bank"),
      })
    );

    // 'p' to focus first practice deck
    cleanups.push(
      registerShortcut({
        key: "p",
        handler: () => {
          if (activeDecks.length > 0) {
            setFocusedDeckIndex(0);
            const firstCard = practiceGridRef.current?.querySelector("[data-deck-index='0']") as HTMLElement;
            firstCard?.focus();
          }
        },
        description: "Focus first practice deck",
      })
    );

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [navigate, activeDecks.length, t]);

  // Handle arrow key navigation within practice grid
  const handlePracticeKeyDown = (event: React.KeyboardEvent) => {
    const maxIndex = activeDecks.length - 1;

    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        setFocusedDeckIndex((prev) => {
          const next = prev + 1;
          if (next > maxIndex) return 0;
          return next;
        });
        break;
      case "ArrowLeft":
        event.preventDefault();
        setFocusedDeckIndex((prev) => {
          const next = prev - 1;
          if (next < 0) return maxIndex;
          return next;
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

  // Focus the currently selected deck card
  useEffect(() => {
    if (focusedDeckIndex >= 0) {
      const card = practiceGridRef.current?.querySelector(`[data-deck-index='${focusedDeckIndex}']`) as HTMLElement;
      card?.focus();
    }
  }, [focusedDeckIndex]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="p-[60px] text-center text-base text-text-secondary">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Header */}
      <header className="mb-2">
        <p className="mb-2 text-sm text-text-secondary">{t("dashboard.welcome_back")}</p>
        <h1 className="m-0 text-[42px] font-semibold [font-family:var(--font-display)]">
          {t("dashboard.good_day", { name: (meQuery.data as { displayName?: string } | undefined)?.displayName ?? t("dashboard.learner") })}
        </h1>
      </header>

      {/* Stats Row */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Statistics">
        <div className="flex flex-col gap-2 rounded-base bg-bg-card p-5">
          <div className="flex items-center gap-2 text-xs tracking-[0.04em] text-text-secondary uppercase">
            <BookOpen size={14} /> {t("dashboard.stats.words_learned")}
          </div>
          <div className="text-[32px] font-semibold [font-family:var(--font-display)]">{data?.totalWordsLearned ?? 0}</div>
        </div>
        <div className="flex flex-col gap-2 rounded-base bg-bg-card p-5">
          <div className="flex items-center gap-2 text-xs tracking-[0.04em] text-text-secondary uppercase">
            <Target size={14} className="text-accent-orange" /> {t("dashboard.stats.due_today")}
          </div>
          <div className="text-[32px] font-semibold text-accent-orange [font-family:var(--font-display)]">{data?.wordsDueToday ?? 0}</div>
        </div>
        <div className="flex flex-col gap-2 rounded-base bg-bg-card p-5">
          <div className="flex items-center gap-2 text-xs tracking-[0.04em] text-text-secondary uppercase">
            <Flame size={14} className="text-accent-teal" /> {t("dashboard.stats.day_streak")}
          </div>
          <div className="text-[32px] font-semibold text-accent-teal [font-family:var(--font-display)]">{data?.learningStreak ?? 0}</div>
        </div>
        <div className="flex flex-col gap-2 rounded-base bg-bg-card p-5">
          <div className="flex items-center gap-2 text-xs tracking-[0.04em] text-text-secondary uppercase">
            <Clock size={14} /> {t("dashboard.stats.session_time")}
          </div>
          <div className="text-[32px] font-semibold [font-family:var(--font-display)]">{Math.floor((data?.sessionTimeSeconds ?? 0) / 60)}m</div>
        </div>
      </section>

      {/* Quick Practice Section */}
      {activeDecks.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">{t("dashboard.quick_practice")}</h2>
            <span className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-primary shadow-sm">
              <kbd className="rounded bg-bg-card px-1.5 py-0.5 font-mono">p</kbd>
              <span>{t("dashboard.to_focus")}</span>
            </span>
          </div>
          <ul
            ref={practiceGridRef}
            className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 xl:grid-cols-4"
            onKeyDown={handlePracticeKeyDown}
            aria-label="Practice decks"
          >
            {activeDecks.map((deck, index) => (
              <li
                key={deck.id}
                data-deck-index={index}
                className="group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-base border border-[var(--border-muted)] bg-bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent-orange hover:shadow-[0_4px_20px_-10px_var(--accent-orange)] focus:-translate-y-0.5 focus:border-accent-orange"
                tabIndex={focusedDeckIndex === index ? 0 : -1}
                onClick={() => navigate(`/practice/${deck.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    navigate(`/practice/${deck.id}`);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-[0.1em] text-text-secondary">{deck.language.toUpperCase()}</span>
                    <span className="text-lg font-semibold text-text-primary [font-family:var(--font-display)]">{deck.name}</span>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-elevated text-text-secondary opacity-0 transition-all group-hover:bg-accent-orange/10 group-hover:text-accent-orange group-hover:opacity-100">
                    <Play size={16} className="ml-0.5 fill-current" />
                  </div>
                </div>
                <button type="button" className="mt-auto w-full rounded-lg bg-bg-elevated px-3 py-2 text-sm text-text-secondary transition-colors group-hover:bg-accent-orange group-hover:text-text-on-accent">
                  {t("dashboard.start_practice")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeDecks.length === 0 && !decksQuery.isLoading && (
        <section className="rounded-base bg-bg-card p-10 text-center text-text-secondary">
          <p>{t("dashboard.no_decks")}</p>
          <p className="mt-2 text-[13px]">
            {t("dashboard.head_to")} <Link to="/word-bank" className="text-accent-orange hover:underline">{t("nav.word_bank")}</Link> {t("dashboard.create_first_deck")}
          </p>
        </section>
      )}

      {/* Recent Sessions */}
      <section className="flex flex-col gap-4">
        <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">{t("dashboard.recent_sessions")}</h2>
        <div className="rounded-base bg-bg-card py-2">
          {(data?.recentSessions ?? []).map((session: { 
            sessionId: string; 
            cardsCompleted: number; 
            startedAt: number; 
            finishedAt?: number;
          }) => {
            const duration = Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 1000);
            const formattedDate = new Date(session.finishedAt ?? session.startedAt).toLocaleString(i18n.language, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            
            return (
              <div key={session.sessionId} className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3 last:border-b-0">
                <span className="text-[13px] text-text-secondary">{formattedDate}</span>
                <span className="font-mono text-[13px]">
                  {t("dashboard.cards_count", { count: session.cardsCompleted })} · {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                </span>
              </div>
            );
          })}
          {data?.recentSessions?.length === 0 ? (
            <p className="m-0 px-5 py-5 text-center text-[13px] text-text-secondary">{t("dashboard.no_sessions")}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
