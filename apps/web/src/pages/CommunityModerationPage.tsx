import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShieldCheck, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CommunityDeckSubmissionDTO } from "@inko/shared";
import { api } from "../api/client";
import { RichText } from "../components/RichText";
import { useAuth } from "../hooks/useAuth";
import { applyNoIndexMetadata } from "../lib/seo";
import { authQueryKey } from "../lib/queryKeys";

type ReviewDraft = {
  slug: string;
  moderationNotes: string;
};

type StatusFilter = "pending" | "approved" | "rejected";

function SubmissionCard({
  submission,
  draft,
  onDraftChange,
  onApprove,
  onReject,
  isPending,
  t,
}: {
  submission: CommunityDeckSubmissionDTO;
  draft: ReviewDraft;
  onDraftChange: (next: ReviewDraft) => void;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <article className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-accent-teal">{submission.language.toUpperCase()} • {submission.difficulty}</div>
          <h2 className="mt-2 text-2xl font-bold [font-family:var(--font-display)] text-text-primary">{submission.title}</h2>
          <p className="mt-2 text-sm text-text-secondary">{submission.summary}</p>
        </div>
        <div className="rounded-full bg-bg-page px-3 py-1 text-xs font-medium text-text-secondary">{t(`community.moderation.status.${submission.status}`)}</div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <p className="m-0 text-sm leading-6 text-text-secondary">{submission.description}</p>
          <div className="flex flex-wrap gap-2">
            {submission.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-text-secondary">
                #{tag}
              </span>
            ))}
          </div>
          <div className="rounded-2xl bg-bg-page p-4">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("community.moderation.source")}</div>
            <div className="mt-2 text-sm text-text-primary">{submission.sourceKind} • {submission.sourceName}</div>
            <div className="mt-1 text-sm text-text-secondary">{t("community.moderation.source_meta", { count: submission.cardCount, email: submission.submitterEmail })}</div>
          </div>
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
                    <td className="px-4 py-3 text-text-primary">
                      <RichText html={word.targetHtml} text={word.target} className="[&_p]:m-0 [&_p+*]:mt-1 [&_ruby_rt]:text-[11px] [&_ruby_rt]:text-text-secondary" />
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      <RichText html={word.meaningHtml} text={word.meaning} className="[&_p]:m-0 [&_p+*]:mt-1 [&_ruby_rt]:text-[11px] [&_ruby_rt]:text-text-secondary" />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      <RichText html={word.readingHtml ?? word.romanizationHtml} text={word.reading ?? word.romanization} className="[&_p]:m-0 [&_p+*]:mt-1 [&_ruby_rt]:text-[11px] [&_ruby_rt]:text-text-secondary" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-bg-page p-4">
          <label className="block text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("community.moderation.published_slug")}</label>
          <input
            className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm text-text-primary outline-none"
            value={draft.slug}
            onChange={(event) => onDraftChange({ ...draft, slug: event.target.value })}
            placeholder={t("community.moderation.slug_placeholder")}
          />
          <label className="mt-4 block text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("community.moderation.moderation_notes")}</label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-xl border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm text-text-primary outline-none"
            value={draft.moderationNotes}
            onChange={(event) => onDraftChange({ ...draft, moderationNotes: event.target.value })}
            placeholder={t("community.moderation.notes_placeholder")}
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onApprove}
              disabled={isPending}
              className="flex-1 rounded-xl bg-accent-orange px-4 py-2.5 text-sm font-bold text-text-on-accent disabled:opacity-60"
            >
              {t("community.moderation.approve")}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={isPending}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 py-2.5 text-sm font-bold text-text-primary disabled:opacity-60"
            >
              {t("community.moderation.reject")}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CommunityModerationPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    applyNoIndexMetadata(t("community.moderation.seo_title"));
  }, [t]);

  const submissionsQuery = useQuery({
    queryKey: authQueryKey(token, "community-submissions", status),
    queryFn: () => api.listCommunitySubmissions(token ?? "", { status }),
    enabled: Boolean(token),
    retry: false,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ submissionId, nextStatus }: { submissionId: string; nextStatus: "approved" | "rejected" }) => {
      const draft = drafts[submissionId] ?? { slug: "", moderationNotes: "" };
      return await api.reviewCommunitySubmission(token ?? "", submissionId, {
        status: nextStatus,
        slug: draft.slug.trim() || undefined,
        moderationNotes: draft.moderationNotes.trim() || undefined,
      });
    },
    onSuccess: async (submission) => {
      setFeedback(t("community.moderation.updated_feedback", {
        title: submission.title,
        status: t(`community.moderation.status.${submission.status}`),
      }));
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "community-submissions") });
      await queryClient.invalidateQueries({ queryKey: ["community-decks"] });
    },
  });

  const accessDenied = (submissionsQuery.error as { statusCode?: number } | null)?.statusCode === 403;
  const submissions = submissionsQuery.data ?? [];

  const submissionDrafts = useMemo(() => {
    const next: Record<string, ReviewDraft> = {};
    for (const submission of submissions) {
      next[submission.id] = drafts[submission.id] ?? {
        slug: submission.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        moderationNotes: submission.moderationNotes ?? "",
      };
    }
    return next;
  }, [drafts, submissions]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 md:p-10">
      <header className="grid gap-5 rounded-[28px] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(0,212,170,0.18),transparent_34%),linear-gradient(135deg,var(--bg-card),var(--bg-page))] p-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-accent-teal">{t("community.moderation.badge")}</p>
          <h1 className="m-0 text-4xl font-bold [font-family:var(--font-display)] md:text-5xl">{t("community.moderation.title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary md:text-base">
            {t("community.moderation.subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link to="/community" className="rounded-2xl border border-[var(--border-subtle)] px-4 py-3 text-sm font-medium text-text-primary no-underline">
            {t("community.moderation.browse_library")}
          </Link>
          <Link to="/imports/anki" className="rounded-2xl bg-accent-orange px-4 py-3 text-sm font-bold text-text-on-accent no-underline">
            {t("community.moderation.open_importer")}
          </Link>
        </div>
      </header>

      <section className="flex flex-wrap gap-3">
        {(["pending", "approved", "rejected"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${status === value ? "bg-accent-orange text-text-on-accent" : "border border-[var(--border-subtle)] bg-bg-card text-text-primary"}`}
          >
            {t(`community.moderation.status.${value}`)}
          </button>
        ))}
      </section>

      {feedback ? <div className="rounded-2xl bg-accent-teal/10 px-4 py-3 text-sm text-accent-teal">{feedback}</div> : null}

      {accessDenied ? (
        <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-8 text-sm leading-6 text-text-secondary">
          <div className="flex items-center gap-3 text-text-primary">
            <XCircle size={18} />
            {t("community.moderation.access_denied")}
          </div>
          <p className="mb-0 mt-3">{t("community.moderation.access_denied_help")}</p>
        </section>
      ) : null}

      {!accessDenied && submissions.length === 0 && !submissionsQuery.isLoading ? (
        <section className="rounded-[24px] border border-dashed border-[var(--border-subtle)] bg-bg-card p-8 text-sm leading-6 text-text-secondary">
          {t("community.moderation.empty", { status: t(`community.moderation.status.${status}`) })}
        </section>
      ) : null}

      {!accessDenied && submissions.map((submission) => (
        <SubmissionCard
          key={submission.id}
          submission={submission}
          draft={submissionDrafts[submission.id]}
          onDraftChange={(next) => setDrafts((current) => ({ ...current, [submission.id]: next }))}
          onApprove={() => reviewMutation.mutate({ submissionId: submission.id, nextStatus: "approved" })}
          onReject={() => reviewMutation.mutate({ submissionId: submission.id, nextStatus: "rejected" })}
          isPending={reviewMutation.isPending}
          t={t}
        />
      ))}

      {!accessDenied && submissions.length > 0 ? (
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6 text-sm text-text-secondary">
          <div className="flex items-center gap-2 text-text-primary">
            <ShieldCheck size={16} />
            {t("community.moderation.catalog_note")}
          </div>
        </div>
      ) : null}
    </div>
  );
}
