import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, Download, Layers, Star } from "lucide-react";
import { api } from "../api/client";
import { applyMetadata } from "../lib/seo";

export function CommunityDeckDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const deckQuery = useQuery({
    queryKey: ["community-deck", slug],
    queryFn: () => api.getCommunityDeck(slug!),
    enabled: Boolean(slug),
  });
  const deck = deckQuery.data;

  useEffect(() => {
    if (!deck) return;
    applyMetadata({
      title: `${deck.title} | Inko Community`,
      description: deck.summary,
      path: `/community/decks/${deck.slug}`,
      robots: "index,follow",
    });
  }, [deck]);

  if (!deck && !deckQuery.isLoading) {
    return <Navigate to="/community" replace />;
  }

  if (!deck) {
    return <div className="p-10 text-sm text-text-secondary">Loading deck…</div>;
  }

  return (
    <div className="min-h-screen bg-bg-page px-6 py-10 text-text-primary md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <Link className="text-sm font-medium text-text-secondary no-underline hover:text-text-primary" to="/community">
          Back to community library
        </Link>

        <header className="grid gap-6 rounded-[28px] border border-[var(--border-subtle)] bg-bg-card p-8 md:grid-cols-[minmax(0,1fr)_260px]">
          <div>
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
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Downloads</span>
                <span className="flex items-center gap-1 font-bold text-text-primary"><Download size={14} /> {deck.downloads.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Rating</span>
                <span className="flex items-center gap-1 font-bold text-text-primary"><Star size={14} /> {deck.rating.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Cards</span>
                <span className="font-bold text-text-primary">{deck.cardCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Updated</span>
                <span className="font-bold text-text-primary">{new Date(deck.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <Link
              to={`/imports/anki?community=${deck.slug}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-orange px-4 py-3 text-sm font-bold text-text-on-accent no-underline transition-transform hover:scale-[1.02]"
            >
              Import into Inko
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-text-primary">
              <Layers size={16} />
              Note types
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

          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
            <h2 className="m-0 text-2xl font-bold [font-family:var(--font-display)]">Sample cards</h2>
            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-bg-page text-left text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Reading</th>
                    <th className="px-4 py-3">Meaning</th>
                    <th className="px-4 py-3">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {deck.words.slice(0, 6).map((word) => (
                    <tr key={`${word.target}-${word.meaning}`} className="border-t border-[var(--border-subtle)]">
                      <td className="px-4 py-3 font-medium text-text-primary">{word.target}</td>
                      <td className="px-4 py-3 text-text-secondary">{word.reading ?? word.romanization ?? "-"}</td>
                      <td className="px-4 py-3 text-text-primary">{word.meaning}</td>
                      <td className="px-4 py-3 text-text-secondary">{word.example ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
