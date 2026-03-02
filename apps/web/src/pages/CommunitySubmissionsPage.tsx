import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { applyNoIndexMetadata } from "../lib/seo";

export function CommunitySubmissionsPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  useEffect(() => {
    applyNoIndexMetadata(t("community.submissions.seo_title"));
  }, [t]);

  const submissionsQuery = useQuery({
    queryKey: ["community-submissions", "mine"],
    queryFn: () => api.listMyCommunitySubmissions(token ?? ""),
    enabled: Boolean(token),
  });

  const submissions = submissionsQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-5 md:p-10">
      <header className="grid gap-4 rounded-[28px] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(255,107,53,0.18),transparent_32%),linear-gradient(135deg,var(--bg-card),var(--bg-page))] p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-accent-teal">{t("community.submissions.badge")}</p>
          <h1 className="m-0 text-4xl font-bold [font-family:var(--font-display)] md:text-5xl">{t("community.submissions.title")}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary md:text-base">
            {t("community.submissions.subtitle")}
          </p>
        </div>
        <Link
          to="/imports/anki"
          className="inline-flex items-center justify-center rounded-2xl bg-accent-orange px-5 py-3 text-sm font-bold text-text-on-accent no-underline"
        >
          {t("community.submissions.open_importer")}
        </Link>
      </header>

      {submissionsQuery.isLoading ? (
        <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-8 text-sm text-text-secondary">
          {t("common.loading")}
        </section>
      ) : null}

      {!submissionsQuery.isLoading && submissions.length === 0 ? (
        <section className="rounded-[24px] border border-dashed border-[var(--border-subtle)] bg-bg-card p-8 text-sm leading-6 text-text-secondary">
          {t("community.submissions.empty")}
        </section>
      ) : null}

      <section className="grid gap-5">
        {submissions.map((submission) => (
          <article key={submission.id} className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-accent-teal">
                  {submission.language.toUpperCase()} • {submission.difficulty}
                </div>
                <h2 className="mt-2 text-2xl font-bold [font-family:var(--font-display)] text-text-primary">{submission.title}</h2>
                <p className="mt-2 text-sm text-text-secondary">{submission.summary}</p>
              </div>
              <div className="rounded-full bg-bg-page px-3 py-1 text-xs font-medium text-text-secondary">
                {t(`community.moderation.status.${submission.status}`)}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-4">
                <p className="m-0 text-sm leading-6 text-text-secondary">{submission.description}</p>
                <div className="flex flex-wrap gap-2">
                  {submission.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-text-secondary">
                      #{tag}
                    </span>
                  ))}
                </div>
                {submission.sampleWords.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-bg-page text-left text-text-secondary">
                        <tr>
                          <th className="px-4 py-3">{t("importer.fields.target")}</th>
                          <th className="px-4 py-3">{t("importer.fields.meaning")}</th>
                          <th className="px-4 py-3">{t("importer.fields.reading")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submission.sampleWords.slice(0, 5).map((word) => (
                          <tr key={`${word.target}-${word.meaning}`} className="border-t border-[var(--border-subtle)]">
                            <td className="px-4 py-3 text-text-primary">{word.target}</td>
                            <td className="px-4 py-3 text-text-primary">{word.meaning}</td>
                            <td className="px-4 py-3 text-text-secondary">{word.reading ?? word.romanization ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl bg-bg-page p-4 text-sm text-text-secondary">
                <div>{t("community.submissions.source")}: <span className="font-semibold text-text-primary">{submission.sourceKind} • {submission.sourceName}</span></div>
                <div className="mt-1">{t("community.submissions.cards")}: <span className="font-semibold text-text-primary">{submission.cardCount}</span></div>
                <div className="mt-1">{t("community.submissions.created")}: <span className="font-semibold text-text-primary">{new Date(submission.createdAt).toLocaleDateString()}</span></div>
                {submission.moderationNotes ? (
                  <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-bg-card px-3 py-2 text-sm text-text-secondary">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("community.submissions.moderation_notes")}</div>
                    <div className="mt-2 text-text-primary">{submission.moderationNotes}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
