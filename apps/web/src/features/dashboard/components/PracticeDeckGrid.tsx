import type { RefObject } from "react";
import type { KeyboardEvent } from "react";
import type { TFunction } from "i18next";

export function PracticeDeckGrid({
  t,
  language,
  activeDecks,
  focusedDeckIndex,
  gridRef,
  onKeyDown,
  onDeckClick,
}: {
  t: TFunction;
  language: string;
  activeDecks: Array<{ id: string; language: string; name: string; createdAt: number }>;
  focusedDeckIndex: number;
  gridRef: RefObject<HTMLUListElement | null>;
  onKeyDown: (event: KeyboardEvent) => void;
  onDeckClick: (deckId: string) => void;
}) {
  return (
    <ul
      ref={gridRef}
      className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2 xl:grid-cols-4"
      onKeyDown={onKeyDown}
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
            onClick={() => onDeckClick(deck.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onDeckClick(deck.id);
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
                        date: new Intl.DateTimeFormat(language, {
                          month: "short",
                          day: "numeric",
                        }).format(new Date(deck.createdAt)),
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
                {isFeatured ? t("dashboard.resume_session") : t("dashboard.start_practice")}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
