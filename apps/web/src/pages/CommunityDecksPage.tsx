import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, Search, Star, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { PublicNavbar } from "../components/PublicNavbar";
import { applyMetadata } from "../lib/seo";

export function CommunityDecksPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");

  useEffect(() => {
    applyMetadata({
      title: t("community.library.seo_title"),
      description: t("community.library.seo_description"),
      path: "/community",
      robots: "index,follow",
    });
  }, [t]);

  const decksQuery = useQuery({
    queryKey: ["community-decks", language, query],
    queryFn: () =>
      api.listCommunityDecks({
        language: language === "all" ? undefined : language,
        search: query.trim() || undefined,
      }),
  });

  const decks = decksQuery.data ?? [];
  const languages = useMemo(() => ["all", ...new Set(decks.map((deck) => deck.language))], [decks]);

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <PublicNavbar />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:px-10">
        <header className="grid gap-4 rounded-[28px] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(255,107,53,0.18),transparent_32%),linear-gradient(135deg,var(--bg-card),var(--bg-page))] p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-accent-teal">{t("community.library.badge")}</p>
            <h1 className="m-0 text-4xl font-bold [font-family:var(--font-display)] md:text-5xl">{t("community.library.title")}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary md:text-base">
              {t("community.library.subtitle")}
            </p>
          </div>
          <Link
            to="/imports/anki"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-orange px-5 py-3 text-sm font-bold text-text-on-accent no-underline transition-transform hover:scale-[1.02]"
          >
            {t("community.library.open_importer")}
            <ArrowRight size={16} />
          </Link>
        </header>

        <section className="grid gap-3 rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-bg-page px-4 py-3 text-sm text-text-secondary">
            <Search size={16} />
            <input
              className="w-full border-0 bg-transparent text-text-primary outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("community.library.search_placeholder")}
            />
          </label>
          <select
            className="rounded-2xl border border-[var(--border-subtle)] bg-bg-page px-4 py-3 text-sm text-text-primary outline-none"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {languages.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? t("community.library.all_languages") : value.toUpperCase()}
              </option>
            ))}
          </select>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {decks.length === 0 && !decksQuery.isLoading ? (
            <article className="md:col-span-2 xl:col-span-3 rounded-[24px] border border-dashed border-[var(--border-subtle)] bg-bg-card p-8 text-sm text-text-secondary">
              {t("community.library.empty")}
            </article>
          ) : null}
          {decks.map((deck) => (
            <article
              key={deck.slug}
              className="flex flex-col gap-4 rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6 shadow-[0_18px_70px_rgba(0,0,0,0.12)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent-teal/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-teal">
                  {deck.language.toUpperCase()}
                </span>
                <span className="rounded-full bg-bg-page px-2.5 py-1 text-[11px] font-medium text-text-secondary">{deck.difficulty}</span>
              </div>
              <div>
                <h2 className="m-0 text-2xl font-bold [font-family:var(--font-display)]">{deck.title}</h2>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{deck.summary}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-bg-page p-3 text-sm">
                <div>
                  <div className="flex items-center gap-1 text-text-secondary"><Download size={14} /> {t("community.stats.downloads")}</div>
                  <div className="mt-1 font-bold text-text-primary">{deck.downloads.toLocaleString()}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-text-secondary"><Star size={14} /> {t("community.stats.rating")}</div>
                  <div className="mt-1 font-bold text-text-primary">{deck.rating.toFixed(1)}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-text-secondary"><Users size={14} /> {t("community.stats.cards")}</div>
                  <div className="mt-1 font-bold text-text-primary">{deck.cardCount}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {deck.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-text-secondary">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between text-xs text-text-secondary">
                <span>{t("community.library.updated", { date: new Date(deck.updatedAt).toLocaleDateString() })}</span>
                <Link className="font-bold text-accent-orange no-underline" to={`/community/decks/${deck.slug}`}>
                  {t("community.library.view_deck")}
                </Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
