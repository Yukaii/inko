import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, Download, Layers, MessageSquare, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { RichText } from "../components/RichText";
import { useAuth } from "../hooks/useAuth";
import { applyMetadata } from "../lib/seo";
import { authQueryKey } from "../lib/queryKeys";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function CommunityDeckDetailPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const meQuery = useQuery({
    queryKey: authQueryKey(token, "me"),
    queryFn: () => api.me(token ?? ""),
    enabled: Boolean(token),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const currentUser = meQuery.data;

  const deckQuery = useQuery({
    queryKey: ["community-deck", slug, token ?? null],
    queryFn: () => api.getCommunityDeck(slug!, token ?? undefined),
    enabled: Boolean(slug),
  });
  const deck = deckQuery.data;

  const rateMutation = useMutation({
    mutationFn: (rating: number) => api.rateCommunityDeck(token ?? "", slug!, { rating }),
    onSuccess: (updatedDeck) => {
      queryClient.setQueryData(["community-deck", slug, token ?? null], updatedDeck);
      void queryClient.invalidateQueries({ queryKey: ["community-decks"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => api.addCommunityDeckComment(token ?? "", slug!, { body }),
    onSuccess: (updatedDeck) => {
      setCommentBody("");
      queryClient.setQueryData(["community-deck", slug, token ?? null], updatedDeck);
    },
  });
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteCommunityDeckComment(token ?? "", slug!, commentId),
    onSuccess: (updatedDeck) => {
      queryClient.setQueryData(["community-deck", slug, token ?? null], updatedDeck);
    },
  });

  useEffect(() => {
    if (!deck) return;
    applyMetadata({
      title: t("community.detail.seo_title", { title: deck.title }),
      description: deck.summary,
      path: `/community/decks/${deck.slug}`,
      robots: "index,follow",
    });
  }, [deck, t]);

  if (!deck && !deckQuery.isLoading) {
    return <Navigate to="/community" replace />;
  }

  if (!deck) {
    return <div className="p-10 text-sm text-text-secondary">{t("common.loading")}</div>;
  }

  return (
    <div className="text-text-primary">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <Link className="text-sm font-medium text-text-secondary no-underline hover:text-text-primary" to="/community">
          {t("community.back_to_library")}
        </Link>

        <header className="grid gap-6 rounded-[28px] border border-[var(--border-subtle)] bg-bg-card p-8 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent-teal/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-teal">
                {deck.language.toUpperCase()}
              </span>
              <span className="rounded-full bg-bg-page px-2.5 py-1 text-[11px] font-medium text-text-secondary">{deck.difficulty}</span>
            </div>
            <h1 className="m-0 text-4xl font-bold [font-family:var(--font-display)] md:text-5xl">{deck.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary md:text-base">{deck.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {deck.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-text-secondary">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] bg-bg-page p-5">
            <div className="grid gap-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">{t("community.stats.downloads")}</span>
                <span className="flex items-center gap-1 font-bold text-text-primary"><Download size={14} /> {deck.downloads.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">{t("community.stats.rating")}</span>
                <span className="flex items-center gap-1 font-bold text-text-primary">
                  <Star size={14} />
                  {deck.rating.toFixed(1)}
                  <span className="text-xs font-medium text-text-secondary">({deck.ratingCount})</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">{t("community.stats.cards")}</span>
                <span className="font-bold text-text-primary">{deck.cardCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">{t("community.stats.updated")}</span>
                <span className="font-bold text-text-primary">{new Date(deck.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <Link
              to={`/imports/anki?community=${deck.slug}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-orange px-4 py-3 text-sm font-bold text-text-on-accent no-underline transition-transform hover:scale-[1.02]"
            >
              {t("community.import_into_inko")}
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-text-primary">
                <Star size={16} />
                {t("community.detail.rate_title")}
              </div>
              <p className="m-0 text-sm leading-6 text-text-secondary">{t("community.detail.rate_copy")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {STAR_VALUES.map((value) => {
                  const isActive = value <= (deck.viewerRating ?? 0);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!token || rateMutation.isPending}
                      onClick={() => rateMutation.mutate(value)}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                        isActive
                          ? "border-accent-orange/60 bg-bg-page text-accent-orange ring-1 ring-accent-orange/20"
                          : "border-[color:color-mix(in_oklab,var(--text-secondary)_28%,var(--bg-page))] bg-bg-elevated text-text-secondary shadow-[inset_0_1px_0_color-mix(in_oklab,var(--bg-card)_70%,transparent)]"
                      } ${!token ? "cursor-not-allowed opacity-60" : "hover:border-accent-orange hover:bg-bg-page hover:text-accent-orange"}`}
                      aria-label={t("community.detail.rate_value", { value })}
                    >
                      <Star size={18} fill={isActive ? "currentColor" : "none"} />
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-text-secondary">
                {token
                  ? deck.viewerRating
                    ? t("community.detail.your_rating", { rating: deck.viewerRating })
                    : t("community.detail.rate_prompt")
                  : t("community.detail.sign_in_to_rate")}
              </div>
              {rateMutation.error ? (
                <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {(rateMutation.error as Error).message}
                </div>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-text-primary">
                <Layers size={16} />
                {t("community.note_types")}
              </div>
              <div className="flex flex-col gap-4">
                {deck.noteTypes.map((noteType) => (
                  <div key={noteType.name} className="rounded-2xl bg-bg-page p-4">
                    <div className="font-bold text-text-primary">{noteType.name}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {noteType.fields.map((field) => (
                        <span key={field} className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-text-secondary">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <h2 className="m-0 text-2xl font-bold [font-family:var(--font-display)]">{t("community.sample_cards")}</h2>
              <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-bg-page text-left text-text-secondary">
                    <tr>
                      <th className="px-4 py-3">{t("importer.fields.target")}</th>
                      <th className="px-4 py-3">{t("importer.fields.reading")}</th>
                      <th className="px-4 py-3">{t("importer.fields.meaning")}</th>
                      <th className="px-4 py-3">{t("importer.fields.example")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deck.words.slice(0, 6).map((word) => (
                      <tr key={`${word.target}-${word.meaning}`} className="border-t border-[var(--border-subtle)]">
                        <td className="max-w-[14rem] px-4 py-3 font-medium text-text-primary break-words">
                          <RichText html={word.targetHtml} text={word.target} className="[&_p]:m-0 [&_p+*]:mt-1 [&_ruby_rt]:text-[11px] [&_ruby_rt]:text-text-secondary" />
                        </td>
                        <td className="max-w-[14rem] px-4 py-3 text-text-secondary break-words">
                          <RichText html={word.readingHtml ?? word.romanizationHtml} text={word.reading ?? word.romanization} className="[&_p]:m-0 [&_p+*]:mt-1 [&_ruby_rt]:text-[11px] [&_ruby_rt]:text-text-secondary" />
                        </td>
                        <td className="max-w-[18rem] px-4 py-3 text-text-primary break-words">
                          <RichText html={word.meaningHtml} text={word.meaning} className="[&_p]:m-0 [&_p+*]:mt-1 [&_ruby_rt]:text-[11px] [&_ruby_rt]:text-text-secondary" />
                        </td>
                        <td className="max-w-[18rem] px-4 py-3 text-text-secondary break-words">
                          <RichText html={word.exampleHtml} text={word.example} className="[&_p]:m-0 [&_p+*]:mt-1 [&_ruby_rt]:text-[11px] [&_ruby_rt]:text-text-secondary" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <MessageSquare size={16} />
                  {t("community.detail.comments_title")}
                </div>
                <div className="text-xs text-text-secondary">{t("community.detail.comments_count", { count: deck.comments.length })}</div>
              </div>

              <div className="mt-4">
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  disabled={!token || commentMutation.isPending}
                  placeholder={token ? t("community.detail.comment_placeholder") : t("community.detail.sign_in_to_comment")}
                  className="min-h-[120px] w-full rounded-2xl border border-[var(--border-subtle)] bg-bg-page px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent-orange disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-text-secondary">
                    {token ? t("community.detail.comment_help") : t("community.detail.sign_in_required")}
                  </div>
                  <button
                    type="button"
                    disabled={!token || commentBody.trim().length === 0 || commentMutation.isPending}
                    onClick={() => commentMutation.mutate(commentBody)}
                    className="inline-flex items-center justify-center rounded-2xl bg-accent-orange px-4 py-2.5 text-sm font-bold text-text-on-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {commentMutation.isPending ? t("common.loading") : t("community.detail.post_comment")}
                  </button>
                </div>
                {commentMutation.error ? (
                  <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {(commentMutation.error as Error).message}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col gap-4">
                {deck.comments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-bg-page px-4 py-5 text-sm leading-6 text-text-secondary">
                    {t("community.detail.comments_empty")}
                  </div>
                ) : null}

                {deck.comments.map((comment) => (
                  <article key={comment.id} className="rounded-2xl bg-bg-page px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold text-text-primary">{comment.authorName}</div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-text-secondary">{new Date(comment.createdAt).toLocaleDateString()}</div>
                        {currentUser && (currentUser.id === comment.userId || currentUser.canModerateCommunity) ? (
                          <button
                            type="button"
                            disabled={deleteCommentMutation.isPending}
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                            className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-text-secondary transition hover:border-[var(--danger-text)] hover:text-[var(--danger-text)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {currentUser.canModerateCommunity && currentUser.id !== comment.userId
                              ? t("community.detail.remove_comment")
                              : t("community.detail.delete_comment")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 m-0 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">{comment.body}</p>
                  </article>
                ))}
              </div>
              {deleteCommentMutation.error ? (
                <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {(deleteCommentMutation.error as Error).message}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
