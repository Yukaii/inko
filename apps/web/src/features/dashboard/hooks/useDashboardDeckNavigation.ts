import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { TFunction } from "i18next";
import { registerShortcut } from "../../../hooks/useKeyboard";

type DeckSummary = {
  id: string;
};

export function useDashboardDeckNavigation(input: {
  activeDecks: DeckSummary[];
  navigate: NavigateFunction;
  t: TFunction;
}) {
  const practiceGridRef = useRef<HTMLUListElement>(null);
  const [focusedDeckIndex, setFocusedDeckIndex] = useState(-1);

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    cleanups.push(
      registerShortcut({
        key: "w",
        handler: () => input.navigate("/word-bank"),
        description: input.t("shortcuts.go_word_bank", "Go to Word Bank"),
      }),
    );

    cleanups.push(
      registerShortcut({
        key: "p",
        handler: () => {
          if (input.activeDecks.length > 0) {
            setFocusedDeckIndex(0);
            const firstCard = practiceGridRef.current?.querySelector("[data-deck-index='0']") as HTMLElement | null;
            firstCard?.focus();
          }
        },
        description: input.t("dashboard.focus_decks_shortcut", "Focus practice decks"),
      }),
    );

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [input.activeDecks.length, input.navigate, input.t]);

  const handlePracticeKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const maxIndex = input.activeDecks.length - 1;
      if (maxIndex < 0) return;

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          setFocusedDeckIndex((prev) => {
            const next = prev + 1;
            return next > maxIndex ? 0 : next;
          });
          break;
        case "ArrowLeft":
          event.preventDefault();
          setFocusedDeckIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? maxIndex : next;
          });
          break;
        case "Enter":
          if (focusedDeckIndex >= 0 && focusedDeckIndex <= maxIndex) {
            event.preventDefault();
            const deck = input.activeDecks[focusedDeckIndex];
            if (deck) {
              input.navigate(`/practice/${deck.id}`);
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
    },
    [focusedDeckIndex, input.activeDecks, input.navigate],
  );

  useEffect(() => {
    if (focusedDeckIndex >= 0) {
      const card = practiceGridRef.current?.querySelector(
        `[data-deck-index='${focusedDeckIndex}']`,
      ) as HTMLElement | null;
      card?.focus();
    }
  }, [focusedDeckIndex]);

  return {
    practiceGridRef,
    focusedDeckIndex,
    handlePracticeKeyDown,
    setFocusedDeckIndex,
  };
}
