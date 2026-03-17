import { BookOpen, Clock, Flame, Star, Target, TrendingUp } from "lucide-react";
import type { TFunction } from "i18next";

function clampProgress(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(10, Math.min(100, Math.round((value / max) * 100)));
}

function formatClockDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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

export function DashboardStats({
  t,
  isLoading,
  totalWordsLearned,
  dueToday,
  learningStreak,
  sessionTimeSeconds,
}: {
  t: TFunction;
  isLoading: boolean;
  totalWordsLearned: number;
  dueToday: number;
  learningStreak: number;
  sessionTimeSeconds: number;
}) {
  if (isLoading) {
    return <StatsSkeleton />;
  }

  const sessionTimeMinutes = Math.floor(sessionTimeSeconds / 60);

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-4" aria-label={t("dashboard.statistics_aria")}>
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
            <div className="h-full rounded-full bg-accent-orange transition-[width]" style={{ width: `${clampProgress(dueToday, 40)}%` }} />
          </div>
          <p className="m-0 font-mono text-[11px] text-text-secondary">{t("dashboard.ready_to_review")}</p>
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
            <div className="h-full rounded-full bg-text-primary transition-[width]" style={{ width: `${clampProgress(sessionTimeMinutes, 30)}%` }} />
          </div>
          <p className="m-0 font-mono text-[11px] text-text-secondary">{t("dashboard.session_time_support")}</p>
        </div>
      </article>
    </section>
  );
}
