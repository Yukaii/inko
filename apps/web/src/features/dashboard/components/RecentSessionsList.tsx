import { ChevronRight, BookOpen } from "lucide-react";
import type { TFunction } from "i18next";

function formatPracticeDuration(totalSeconds: number) {
  if (totalSeconds >= 60) {
    return `${Math.floor(totalSeconds / 60)}m`;
  }
  return `${Math.max(0, totalSeconds)}s`;
}

function formatSessionDate(timestamp: number, language: string) {
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
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

export function RecentSessionsList({
  t,
  language,
  isLoading,
  recentSessions,
  decksById,
  onSessionClick,
}: {
  t: TFunction;
  language: string;
  isLoading: boolean;
  recentSessions: Array<{
    sessionId: string;
    startedAt: unknown;
    finishedAt?: unknown;
    deckId: string;
    deckName?: string;
    cardsCompleted: number;
  }>;
  decksById: Map<string, { name: string; language?: string }>;
  onSessionClick: (sessionId: string) => void;
}) {
  if (isLoading) {
    return <RecentSessionsSkeleton />;
  }

  return (
    <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-2">
      {recentSessions.map((session) => {
        const startedAt = normalizeTimestamp(session.startedAt);
        const finishedAt = normalizeTimestamp(session.finishedAt ?? session.startedAt);
        const durationSeconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
        const deck = decksById.get(session.deckId);
        const sessionDeckName = deck?.name ?? session.deckName ?? t("dashboard.session_label");
        const sessionDeckLanguage = deck?.language?.toUpperCase();

        return (
          <button
            key={session.sessionId}
            type="button"
            onClick={() => onSessionClick(session.sessionId)}
            className="flex w-full flex-col gap-3 rounded-none border-b border-[var(--border-subtle)] bg-transparent px-5 py-3 text-left font-normal text-inherit focus:outline-none last:border-b-0 md:flex-row md:items-center md:justify-between"
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
                  {formatSessionDate(finishedAt, language)}
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
          </button>
        );
      })}

      {recentSessions.length === 0 ? (
        <p className="m-0 px-5 py-5 text-center text-[13px] text-text-secondary">
          {t("dashboard.no_sessions")}
        </p>
      ) : null}
    </div>
  );
}
