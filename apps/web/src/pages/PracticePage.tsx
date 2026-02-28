import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { registerShortcut } from "../hooks/useKeyboard";
import {
  PRACTICE_SESSION_CARD_CAP_DEFAULT,
  getTypingMatchSource,
  getTypingMatchTarget,
  isTypingMatch,
  normalizeTypingInput,
  type LanguageCode,
  type TypingMode,
} from "@inko/shared";

type PracticeCard = {
  wordId: string;
  language: LanguageCode;
  target: string;
  reading?: string;
  romanization?: string;
  meaning?: string;
  example?: string;
  audioUrl?: string;
};

export function canSubmitCard(input: {
  typingInput: string;
  expected: string;
  language?: LanguageCode;
  typingMode?: TypingMode;
  reading?: string;
  romanization?: string;
}) {
  return isTypingMatch(
    input.typingInput,
    input.expected,
    input.reading,
    input.romanization,
    input.language ?? "ja",
    input.typingMode ?? "language_specific",
  );
}

export function getTypingFeedback(input: {
  typingInput: string;
  expected: string;
  language?: LanguageCode;
  typingMode?: TypingMode;
  reading?: string;
  romanization?: string;
}) {
  const language = input.language ?? "ja";
  const typingMode = input.typingMode ?? "language_specific";
  const target = getTypingMatchTarget(input.expected, input.reading, input.romanization, language, typingMode);
  const source = getTypingMatchSource(input.typingInput, input.reading, input.romanization, language, typingMode);

  if (!source || !target) {
    return {
      target,
      matchedChars: 0,
      accuracy: 100,
      progress: 0,
      onTrack: true,
      complete: false,
      currentStreak: 0,
    };
  }

  let matchedChars = 0;
  const limit = Math.min(source.length, target.length);
  while (matchedChars < limit && source[matchedChars] === target[matchedChars]) {
    matchedChars += 1;
  }

  const onTrack = target.startsWith(source);
  const complete = source === target;
  const accuracy = source.length === 0 ? 100 : Math.round((matchedChars / source.length) * 100);
  const progress = target.length === 0 ? 0 : Math.min(100, Math.round((matchedChars / target.length) * 100));

  return {
    target,
    matchedChars,
    accuracy,
    progress,
    onTrack,
    complete,
    currentStreak: onTrack ? source.length : 0,
  };
}

export function isEscDoublePress(lastEscPressedAt: number | null, now: number, windowMs = 1000) {
  if (!lastEscPressedAt) return false;
  return now - lastEscPressedAt <= windowMs;
}

export function getPracticeCompletionTitle(input: {
  sessionCapped: boolean;
  cardsCompleted: number;
  sessionTargetCards: number;
  t: (key: string) => string;
}) {
  if (input.sessionCapped || (input.sessionTargetCards > 0 && input.cardsCompleted >= input.sessionTargetCards)) {
    return input.t("practice.daily_target_reached");
  }
  return input.t("practice.session_complete");
}

export function PracticePage() {
  const { t } = useTranslation();
  const { deckId } = useParams<{ deckId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState("");
  const [card, setCard] = useState<PracticeCard | null>(null);
  const [typingInput, setTypingInput] = useState("");
  const [cardStreak, setCardStreak] = useState(0);
  const [bestCardStreak, setBestCardStreak] = useState(0);
  const [lastSubmitAccepted, setLastSubmitAccepted] = useState<boolean | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<{ cardsCompleted: number; avgTypingScore: number } | null>(null);
  const [typingMode, setTypingMode] = useState<TypingMode>("language_specific");
  const [upcomingCards, setUpcomingCards] = useState<PracticeCard[]>([]);
  const [cardTransition, setCardTransition] = useState(false);
  const [finishError, setFinishError] = useState("");
  const [sessionTargetCards, setSessionTargetCards] = useState(PRACTICE_SESSION_CARD_CAP_DEFAULT);
  const [cardsCompleted, setCardsCompleted] = useState(0);
  const [sessionCapped, setSessionCapped] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [exitEscHint, setExitEscHint] = useState(false);
  const [lastEscPressedAt, setLastEscPressedAt] = useState<number | null>(null);
  const [startError, setStartError] = useState("");

  const startedAtRef = useRef<number>(Date.now());
  const autoSubmitKeyRef = useRef<string>("");
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUrlCacheRef = useRef<Map<string, string>>(new Map());
  const ttsPromiseCacheRef = useRef<Map<string, Promise<string>>>(new Map());

  useEffect(() => {
    if (!deckId || !token) return;
    let cancelled = false;
    setStartError("");

    api.startPractice(token, deckId)
      .then((res) => {
        if (cancelled) return;
        setSessionId(res.sessionId);
        setCard(res.card as PracticeCard);
        setUpcomingCards((res.upcomingCards as PracticeCard[] | undefined) ?? []);
        setTypingMode((res.typingMode as TypingMode | undefined) ?? "language_specific");
        setSessionTargetCards(res.sessionTargetCards ?? PRACTICE_SESSION_CARD_CAP_DEFAULT);
        setCardsCompleted(res.cardsCompleted ?? 0);
        setSessionCapped(false);
        startedAtRef.current = Date.now();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : undefined;

        if (statusCode === 409) {
          setStartError(t("practice.no_words_available"));
          return;
        }

        if (error instanceof Error && error.message) {
          setStartError(error.message);
          return;
        }

        setStartError(t("errors.unknown"));
      });

    return () => {
      cancelled = true;
    };
  }, [deckId, t, token]);

  // Register shortcut for going back to dashboard when session is done
  useEffect(() => {
    if (!sessionDone) return;

    const cleanup = registerShortcut({
      key: "b",
      handler: () => navigate("/dashboard"),
      description: t("practice.back_to_dashboard"),
    });

    return cleanup;
  }, [sessionDone, navigate, t]);

  const focusInput = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!card) throw new Error("No card");
      if (!token) throw new Error("Not authenticated");
      return api.submitPractice(token, sessionId, card.wordId, {
        handwritingCompleted: true,
        typingInput,
        typingMs: Date.now() - startedAtRef.current,
        audioPlayed: true,
        listeningConfidence: 3,
      });
    },
    onSuccess: (res) => {
      const resolvedTarget = res.sessionTargetCards ?? sessionTargetCards;
      if (res.sessionTargetCards !== undefined) {
        setSessionTargetCards(res.sessionTargetCards);
      }
      setUpcomingCards((res.upcomingCards as PracticeCard[] | undefined) ?? []);
      const nextCompleted =
        res.cardsCompleted ??
        (res.remainingCards !== undefined
          ? Math.max(0, resolvedTarget - res.remainingCards)
          : res.accepted
            ? undefined
            : cardsCompleted);
      if (nextCompleted !== undefined) {
        setCardsCompleted(nextCompleted);
      } else {
        setCardsCompleted((prev) => Math.min(resolvedTarget, prev + 1));
      }
      if (res.sessionCapped) {
        setSessionCapped(true);
      }

      if (res.accepted) {
        setLastSubmitAccepted(true);
        setCardStreak((prev) => {
          const next = prev + 1;
          setBestCardStreak((best) => Math.max(best, next));
          return next;
        });

        setCardTransition(true);
        setTimeout(() => {
          setTypingInput("");
          if (res.nextCard) {
            setCard(res.nextCard as PracticeCard);
          } else {
            setUpcomingCards([]);
            requestFinish();
          }
          startedAtRef.current = Date.now();
          setCardTransition(false);
          focusInput();
        }, 400);
      } else {
        setLastSubmitAccepted(false);
        setCardStreak(0);
        if (res.sessionCapped) {
          requestFinish();
        }
      }
    },
  });

  const finishRequestedRef = useRef(false);

  const finishMutation = useMutation({
    mutationFn: (vars: { token: string; sessionId: string }) => {
      return api.finishPractice(vars.token, vars.sessionId);
    },
    onSuccess: (summary) => {
      setFinishError("");
      setSessionDone(true);
      setSessionSummary(summary);
    },
    onError: (error) => {
      setFinishError(error instanceof Error ? error.message : "Failed to finish session");
      finishRequestedRef.current = false;
    },
  });

  const requestFinish = useCallback(() => {
    if (!sessionId) {
      setFinishError("Session is still starting. Try again.");
      return;
    }
    if (!token) {
      setFinishError("You are not authenticated.");
      return;
    }
    if (finishRequestedRef.current || finishMutation.isPending || sessionDone) return;
    finishRequestedRef.current = true;
    setFinishError("");
    finishMutation.mutate({ token, sessionId });
  }, [finishMutation, sessionDone, sessionId, token]);

  useEffect(() => {
    if (lastEscPressedAt === null) return;
    const timer = window.setTimeout(() => {
      setLastEscPressedAt(null);
      setExitEscHint(false);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [lastEscPressedAt]);

  const requestExitIntent = useCallback(
    (source: "esc" | "button") => {
      if (source === "button") {
        setExitEscHint(false);
        setExitConfirmOpen(true);
        return;
      }

      const now = Date.now();
      if (isEscDoublePress(lastEscPressedAt, now)) {
        setLastEscPressedAt(null);
        setExitEscHint(false);
        setExitConfirmOpen(true);
        return;
      }

      setLastEscPressedAt(now);
      setExitEscHint(true);
    },
    [lastEscPressedAt],
  );

  const submitEnabled = useMemo(() => {
    if (!card) return false;
    return canSubmitCard({
      typingInput,
      expected: card.target,
      language: card.language,
      typingMode,
      reading: card.reading,
      romanization: card.romanization,
    });
  }, [card, typingInput, typingMode]);

  const typingFeedback = useMemo(() => {
    if (!card) {
      return {
        target: "",
        matchedChars: 0,
        accuracy: 100,
        progress: 0,
        onTrack: true,
        complete: false,
        currentStreak: 0,
      };
    }

    return getTypingFeedback({
      typingInput,
      expected: card.target,
      language: card.language,
      typingMode,
      reading: card.reading,
      romanization: card.romanization,
    });
  }, [card, typingInput, typingMode]);

  const focusKey = card?.wordId ?? "";

  useEffect(() => {
    if (!focusKey) return;
    focusInput();
  }, [focusKey, focusInput]);

  const getOrPrefetchAudioUrl = useCallback(async (practiceCard: PracticeCard) => {
    if (practiceCard.audioUrl) return practiceCard.audioUrl;

    const cachedUrl = ttsUrlCacheRef.current.get(practiceCard.wordId);
    if (cachedUrl) return cachedUrl;

    const cachedPromise = ttsPromiseCacheRef.current.get(practiceCard.wordId);
    if (cachedPromise) return await cachedPromise;

    const promise = api.fetchWordTts(token ?? "", practiceCard.wordId).then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      ttsUrlCacheRef.current.set(practiceCard.wordId, objectUrl);
      ttsPromiseCacheRef.current.delete(practiceCard.wordId);
      return objectUrl;
    }).catch((error) => {
      ttsPromiseCacheRef.current.delete(practiceCard.wordId);
      throw error;
    });

    ttsPromiseCacheRef.current.set(practiceCard.wordId, promise);
    return await promise;
  }, [token]);

  useEffect(() => {
    for (const upcomingCard of upcomingCards.slice(0, 7)) {
      void getOrPrefetchAudioUrl(upcomingCard).catch(() => {
        // Ignore prefetch failures; playback will retry on demand.
      });
    }
  }, [getOrPrefetchAudioUrl, upcomingCards]);

  useEffect(() => {
    if (!card) return;

    let cancelled = false;

    const resetAudio = () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };

    const playAudio = async () => {
      resetAudio();

      try {
        const source = await getOrPrefetchAudioUrl(card);

        if (cancelled) {
          return;
        }

        const audio = new Audio(source);
        audioRef.current = audio;
        await audio.play();
      } catch {
        // Ignore autoplay and synthesis failures so practice can continue.
      }
    };

    void playAudio();

    return () => {
      cancelled = true;
      resetAudio();
    };
  }, [card, getOrPrefetchAudioUrl]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      for (const objectUrl of ttsUrlCacheRef.current.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      ttsUrlCacheRef.current.clear();
      ttsPromiseCacheRef.current.clear();
    };
  }, []);

  // Auto-submit on match
  useEffect(() => {
    if (!card || submitMutation.isPending || !submitEnabled) return;
    const normalizedTyped = normalizeTypingInput(typingInput);
    if (!normalizedTyped) return;

    const autoSubmitKey = `${sessionId}:${card.wordId}:${normalizedTyped}`;
    if (autoSubmitKeyRef.current === autoSubmitKey) return;

    autoSubmitKeyRef.current = autoSubmitKey;
    submitMutation.mutate();
  }, [card, sessionId, submitEnabled, submitMutation, typingInput]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (exitConfirmOpen) {
          setExitConfirmOpen(false);
          setExitEscHint(false);
          return;
        }
        requestExitIntent("esc");
        return;
      }
      // Any printable key focuses the hidden input
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      focusInput();
    },
    [exitConfirmOpen, requestExitIntent, focusInput],
  );

  // Build character-by-character display for monkeytype effect
  const romajiChars = useMemo(() => {
    const target = typingFeedback.target;
    if (!target) return [];

    const typed = card
      ? getTypingMatchSource(typingInput, card.reading, card.romanization, card.language, typingMode)
      : normalizeTypingInput(typingInput);
    const chars: Array<{ char: string; pos: number; state: "correct" | "wrong" | "cursor" | "pending" }> = [];

    for (let i = 0; i < target.length; i++) {
      if (i < typed.length) {
        chars.push({
          char: target[i],
          pos: i,
          state: typed[i] === target[i] ? "correct" : "wrong",
        });
      } else if (i === typed.length) {
        chars.push({ char: target[i], pos: i, state: "cursor" });
      } else {
        chars.push({ char: target[i], pos: i, state: "pending" });
      }
    }

    // If typed is longer than target, show extra chars as wrong
    if (typed.length > target.length) {
      for (let i = target.length; i < typed.length; i++) {
        chars.push({ char: typed[i], pos: i, state: "wrong" });
      }
    }

    return chars;
  }, [card, typingInput, typingFeedback.target, typingMode]);

  const typingPrompt =
    typingMode === "language_specific" && card?.language === "ja" ? t("practice.type_romaji") : t("practice.type_answer");

  // Session done screen
  if (sessionDone) {
    const completedCards = sessionSummary?.cardsCompleted ?? cardsCompleted;
    const completionTitle = getPracticeCompletionTitle({
      sessionCapped,
      cardsCompleted: completedCards,
      sessionTargetCards,
      t,
    });

    return (
      <section className="fixed inset-0 z-[200] flex cursor-text flex-col items-center justify-center overflow-hidden bg-bg-page" aria-label="Practice complete">
        <div className="flex flex-col items-center gap-4">
          <div className="mb-2 text-5xl text-accent-teal" aria-hidden="true">&#x2714;</div>
          <h1 className="m-0 text-4xl text-text-primary [font-family:var(--font-display)]">{completionTitle}</h1>
          {sessionSummary ? (
            <div className="mt-4 flex gap-10">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[32px] text-accent-orange [font-family:var(--font-display)]">{sessionSummary.cardsCompleted}</span>
                <span className="text-xs uppercase tracking-[0.06em] text-text-secondary">{t("practice.cards")}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[32px] text-accent-orange [font-family:var(--font-display)]">{sessionSummary.avgTypingScore}</span>
                <span className="text-xs uppercase tracking-[0.06em] text-text-secondary">{t("practice.avg_typing")}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[32px] text-accent-orange [font-family:var(--font-display)]">{bestCardStreak}</span>
                <span className="text-xs uppercase tracking-[0.06em] text-text-secondary">{t("practice.best_streak")}</span>
              </div>
            </div>
          ) : null}
          <button type="button" className="mt-8 rounded-[10px] border border-[var(--border-muted)] bg-bg-elevated px-6 py-3 text-sm font-medium text-text-primary hover:border-accent-orange" onClick={() => navigate("/dashboard")}>
            {t("practice.back_to_dashboard")}
            <kbd className="ml-3 rounded border border-[var(--border-strong)] bg-bg-card px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">b</kbd>
          </button>
        </div>
      </section>
    );
  }

  // Loading state
  if (!card) {
    if (startError) {
      return (
        <section className="fixed inset-0 z-[200] flex cursor-text flex-col items-center justify-center overflow-hidden bg-bg-page" aria-label="Practice unavailable">
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <p className="m-0 text-base text-text-secondary">{startError}</p>
            <button
              type="button"
              className="rounded-[10px] border border-[var(--border-muted)] bg-bg-elevated px-6 py-3 text-sm font-medium text-text-primary hover:border-accent-orange"
              onClick={() => navigate("/dashboard")}
            >
              {t("practice.back_to_dashboard")}
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="fixed inset-0 z-[200] flex cursor-text flex-col items-center justify-center overflow-hidden bg-bg-page" aria-label="Loading practice">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-pulse text-base text-text-secondary">{t("common.loading")}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={zoneRef}
      className="fixed inset-0 z-[200] flex cursor-text flex-col items-center justify-center overflow-hidden bg-bg-page"
      tabIndex={-1}
      aria-label="Practice session"
      onKeyDown={handleKeyDown}
      onClick={focusInput}
    >
      {/* Minimal top bar */}
      <div className="fixed inset-x-0 top-0 z-[210] flex items-center justify-between px-6 py-4 opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center rounded-full border border-[var(--border-muted)] bg-bg-page px-3 py-1 text-xs text-text-secondary font-medium"
            aria-label={`Session progress: ${cardsCompleted} of ${sessionTargetCards}`}
          >
            {cardsCompleted}/{sessionTargetCards}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-muted)] bg-bg-page px-3.5 py-1.5 text-sm text-accent-orange font-bold [font-family:var(--font-display)]" aria-label={`Current streak: ${cardStreak}`}>
            {cardStreak > 0 ? (
              <>
                <span className="text-base" aria-hidden="true">🔥</span>
                <span>{cardStreak}</span>
              </>
            ) : (
              <span className="text-text-secondary">0</span>
            )}
          </span>
          {bestCardStreak > 0 ? (
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary opacity-60" aria-label={`Best streak: ${bestCardStreak}`}>
              best: {bestCardStreak}
            </span>
          ) : null}
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-muted)] bg-transparent px-3.5 py-1.5 text-[13px] font-normal text-text-secondary hover:border-[var(--border-strong)] hover:text-text-primary" onClick={() => requestExitIntent("button")}>
          {t("practice.end_session")}
          <kbd className="rounded border border-[var(--border-strong)] bg-bg-card px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">esc</kbd>
        </button>
      </div>
      {finishError ? <div className="fixed left-1/2 top-14 z-[220] -translate-x-1/2 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-toast-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">{finishError}</div> : null}
      {exitEscHint ? (
        <div className="fixed left-1/2 top-14 z-[220] -translate-x-1/2 rounded-lg border border-[var(--border-strong)] bg-bg-elevated px-3 py-2 text-xs text-text-primary">
          {t("practice.esc_hint")}
        </div>
      ) : null}
      {exitConfirmOpen ? (
        <div className="fixed left-1/2 top-16 z-[230] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-[var(--border-strong)] bg-bg-card p-4 shadow-xl">
          <p className="m-0 text-sm text-text-primary">{t("practice.end_confirm_title")}</p>
          <p className="mt-1 mb-0 text-xs text-text-secondary">{t("practice.end_confirm_desc")}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-[var(--border-muted)] px-3 py-1.5 text-xs text-text-secondary hover:border-[var(--border-strong)] hover:text-text-primary"
              onClick={() => {
                setExitConfirmOpen(false);
                setExitEscHint(false);
              }}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-toast-bg)] px-3 py-1.5 text-xs text-[var(--danger-text)]"
              onClick={() => {
                setExitConfirmOpen(false);
                requestFinish();
              }}
            >
              {t("practice.confirm_exit")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Success Glow */}
      <div className={`pointer-events-none fixed inset-0 z-[190] bg-[radial-gradient(circle_at_center,var(--accent-teal)_0%,transparent_40%)] opacity-0 transition-opacity duration-300 ${cardTransition ? "opacity-5" : ""}`} aria-hidden="true" />

      {/* Center focus area */}
      <div className={`relative z-[200] flex flex-col items-center gap-4 transition-all duration-300 ${cardTransition ? "-translate-y-2 opacity-0" : ""}`}>
        {/* Meaning as a subtle hint above */}
        {card.meaning ? (
          <div className="text-base tracking-[0.02em] text-text-secondary">{card.meaning}</div>
        ) : null}

        {/* Large kanji target */}
        <div
          className={`select-none text-5xl leading-tight tracking-[0.04em] text-text-primary md:text-7xl ${card.language === "ja" ? "[font-family:var(--font-jp)]" : ""}`}
          lang={card.language}
        >
          {card.target}
        </div>

        {/* Reading hint (small, below kanji) */}
        {card.reading ? (
          <div
            className={`-mt-1 text-lg text-text-secondary ${card.language === "ja" ? "[font-family:var(--font-jp)]" : ""}`}
            lang={card.language}
          >
            {card.reading}
          </div>
        ) : null}

        {/* Monkeytype-style character display */}
        <div className={`mt-3 flex min-h-[42px] justify-center gap-0.5 font-mono text-[22px] tracking-[0.08em] md:text-[28px] ${lastSubmitAccepted === false ? "animate-shake text-[var(--danger-text)]" : ""}`} aria-hidden="true">
          {romajiChars.map((c) => (
            <span
              key={`${focusKey}-p${c.pos}-${c.char}`}
              className={
                c.state === "correct"
                  ? "text-accent-teal"
                  : c.state === "wrong"
                    ? "text-[var(--danger-text)] underline decoration-[color:color-mix(in_oklab,var(--danger-text)_40%,transparent)]"
                    : c.state === "cursor"
                      ? "text-text-primary underline decoration-accent-orange"
                      : "text-text-secondary"
              }
            >
              {c.char}
            </span>
          ))}
          {romajiChars.length === 0 ? (
            <span className="text-lg tracking-[0.02em] text-text-secondary">
              {typingPrompt}
            </span>
          ) : null}
        </div>

        {/* Hidden input for capturing keystrokes */}
        <label className="absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]" htmlFor="zen-typing-input">
          Type answer for {card.target}
        </label>
        <input
          id="zen-typing-input"
          key={card.wordId}
          ref={hiddenInputRef}
          className="pointer-events-none absolute h-px w-px overflow-hidden border-0 p-0 opacity-0"
          value={typingInput}
          onChange={(event) => setTypingInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              if (exitConfirmOpen) {
                setExitConfirmOpen(false);
                setExitEscHint(false);
              } else {
                requestExitIntent("esc");
              }
            }
          }}
          aria-label={`Type answer for ${card.target}`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Feedback line */}
        <div className="mt-2 min-h-6 text-sm" aria-live="polite">
          {lastSubmitAccepted === false ? (
            <span className="text-sm text-[var(--danger-text)]">{t("practice.not_quite")}</span>
          ) : typingInput && !typingFeedback.onTrack ? (
            <span className="text-[13px] text-[var(--danger-text)]">{t("practice.off_track")}</span>
          ) : typingInput && typingFeedback.onTrack ? (
            <span className="font-mono text-[13px] text-accent-teal">{typingFeedback.progress}%</span>
          ) : null}
        </div>
      </div>

      {/* Subtle progress bar at bottom */}
      <div className="fixed inset-x-0 bottom-0 z-[210]">
        <div className="h-[3px] overflow-hidden bg-bg-page" aria-hidden="true">
          <div
            className={`h-full transition-[width] duration-100 ${typingFeedback.complete ? "bg-accent-teal" : "bg-gradient-to-r from-accent-orange to-accent-teal"}`}
            style={{ width: `${typingFeedback.progress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
