import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(timestamp: number, language: string) {
  return new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--border-subtle)] bg-bg-card p-5">
      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary">{label}</p>
      <p className="mt-2 mb-0 text-[32px] leading-none [font-family:var(--font-display)]">{value}</p>
    </div>
  );
}

export function SessionDetailsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { sessionId } = useParams<{ sessionId: string }>();

  const detailsQuery = useQuery({
    queryKey: ["practice-session", sessionId],
    enabled: Boolean(token && sessionId),
    queryFn: () => api.getPracticeSessionDetails(token ?? "", sessionId ?? ""),
  });

  const details = detailsQuery.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          className="rounded-lg border border-[var(--border-subtle)] bg-bg-card px-3 py-2 font-mono text-xs text-text-secondary transition-colors hover:text-text-primary"
          onClick={() => navigate("/dashboard")}
        >
          {t("session_details.back")}
        </button>
      </div>

      {detailsQuery.isLoading ? (
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6 text-text-secondary">
          {t("common.loading", "Loading...")}
        </div>
      ) : details ? (
        <>
          <header className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {details.language ? (
                  <span className="inline-flex items-center rounded-md bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    {details.language.toUpperCase()}
                  </span>
                ) : null}
                <p className="m-0 font-mono text-sm text-text-secondary">
                  {formatDate(details.finishedAt ?? details.startedAt, i18n.language)}
                </p>
              </div>
              <h1 className="m-0 text-[38px] leading-none [font-family:var(--font-display)]">
                {details.deckName ?? t("dashboard.session_label")}
              </h1>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label={t("dashboard.cards_count", { count: 2 }).replace("2", "").trim()} value={details.cardsCompleted} />
            <StatCard label={t("session_details.duration")} value={formatDuration(details.durationSeconds)} />
            <StatCard label={t("session_details.avg_typing")} value={details.avgTypingScore} />
            <StatCard label={t("session_details.avg_recall")} value={Math.round((details.avgShapeScore + details.avgListeningScore) / 2)} />
          </section>

          <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card py-2">
            <div className="border-b border-[var(--border-subtle)] px-5 py-3">
              <h2 className="m-0 text-[22px] [font-family:var(--font-display)]">{t("session_details.attempt_breakdown")}</h2>
            </div>
            {details.attempts.map((attempt) => (
              <div
                key={attempt.attemptId}
                className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(56px,72px))] items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-base text-text-primary [font-family:var(--font-display)]">
                    {attempt.target}
                  </p>
                  <p className="m-0 truncate font-mono text-[12px] text-text-secondary">
                    {attempt.meaning}
                  </p>
                </div>
                <div className="text-right">
                  <p className="m-0 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary">{t("session_details.shape")}</p>
                  <p className="m-0 text-sm text-text-primary">{attempt.shapeScore}</p>
                </div>
                <div className="text-right">
                  <p className="m-0 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary">{t("session_details.typing")}</p>
                  <p className="m-0 text-sm text-text-primary">{attempt.typingScore}</p>
                </div>
                <div className="text-right">
                  <p className="m-0 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary">{t("session_details.listen")}</p>
                  <p className="m-0 text-sm text-text-primary">{attempt.listeningScore}</p>
                </div>
              </div>
            ))}
            {details.attempts.length === 0 ? (
              <p className="m-0 px-5 py-5 text-center text-[13px] text-text-secondary">
                {t("session_details.no_attempts")}
              </p>
            ) : null}
          </section>
        </>
      ) : (
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6 text-text-secondary">
          {t("session_details.load_failed")}
        </div>
      )}
    </div>
  );
}
