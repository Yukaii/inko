import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Headphones, Keyboard, Radio, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { registerShortcut } from "../hooks/useKeyboard";
import {
  EDGE_TTS_RATE_PRESETS,
  EDGE_TTS_VOICE_OPTIONS_BY_LANGUAGE,
  PRACTICE_SESSION_CARD_CAP_DEFAULT,
  getTypingMatchSource,
  getTypingMatchTarget,
  isTypingMatch,
  normalizeTypingInput,
  type EdgeTtsRate,
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

export function getNextCleanStreak(previousStreak: number, hadMistake: boolean) {
  return hadMistake ? 0 : previousStreak + 1;
}

function isReplayTtsShortcut(event: Pick<KeyboardEvent, "key" | "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">) {
  return event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && (event.code === "KeyR" || event.key.toLowerCase() === "r");
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

function getTtsCacheKey(deckId: string, wordId: string, voice: string, rate: EdgeTtsRate) {
  return `${deckId}:${wordId}:${voice}:${rate}`;
}

function getInitialTtsAudioWarmupCards(card: PracticeCard | null, upcomingCards: PracticeCard[] | undefined) {
  return [card, ...(upcomingCards ?? [])].filter((value): value is PracticeCard => value !== null).slice(0, 8);
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
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsVoice, setTtsVoice] = useState("ja-JP-NanamiNeural");
  const [ttsRate, setTtsRate] = useState<EdgeTtsRate>("default");
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
  const [cardHadMistake, setCardHadMistake] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [advancedPracticeEnabled, setAdvancedPracticeEnabled] = useState(false);

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
        const initialCard = res.card as PracticeCard;
        const initialUpcomingCards = (res.upcomingCards as PracticeCard[] | undefined) ?? [];
        const initialVoice = res.ttsVoice ?? EDGE_TTS_VOICE_OPTIONS_BY_LANGUAGE[(initialCard.language ?? "ja") as LanguageCode][0].value;
        const initialRate = res.ttsRate ?? "default";

        for (const practiceCard of getInitialTtsAudioWarmupCards(initialCard, initialUpcomingCards)) {
          const cacheKey = getTtsCacheKey(deckId, practiceCard.wordId, initialVoice, initialRate);
          if (ttsUrlCacheRef.current.has(cacheKey) || ttsPromiseCacheRef.current.has(cacheKey)) {
            continue;
          }

          const promise = api.fetchWordTts(token, practiceCard.wordId, deckId, initialVoice, initialRate).then((blob) => {
            const objectUrl = URL.createObjectURL(blob);
            ttsUrlCacheRef.current.set(cacheKey, objectUrl);
            ttsPromiseCacheRef.current.delete(cacheKey);
            return objectUrl;
          }).catch((error) => {
            ttsPromiseCacheRef.current.delete(cacheKey);
            throw error;
          });

          ttsPromiseCacheRef.current.set(cacheKey, promise);
          void promise.catch(() => {
            // Ignore warmup failures; playback will retry on demand.
          });
        }

        setSessionId(res.sessionId);
        setCard(initialCard);
        setUpcomingCards(initialUpcomingCards);
        setTypingMode((res.typingMode as TypingMode | undefined) ?? "language_specific");
        setTtsEnabled(res.ttsEnabled ?? true);
        setTtsVoice(initialVoice);
        setTtsRate(initialRate);
        setSessionTargetCards(res.sessionTargetCards ?? PRACTICE_SESSION_CARD_CAP_DEFAULT);
        setCardsCompleted(res.cardsCompleted ?? 0);
        setSessionCapped(false);
        setCardHadMistake(false);
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
          const next = getNextCleanStreak(prev, cardHadMistake);
          setBestCardStreak((best) => Math.max(best, next));
          return next;
        });

        setCardTransition(true);
        setTimeout(() => {
          setTypingInput("");
          setCardHadMistake(false);
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
        setCardHadMistake(true);
        if (res.sessionCapped) {
          requestFinish();
        }
      }
    },
  });

  const updateDeckTtsMutation = useMutation({
    mutationFn: async (input: { ttsEnabled?: boolean; ttsVoice?: string; ttsRate?: EdgeTtsRate }) => {
      if (!token) throw new Error("Not authenticated");
      if (!deckId) throw new Error("No deck selected");
      return await api.updateDeck(token, deckId, input);
    },
    onMutate: async (input) => {
      const previous = { ttsEnabled, ttsVoice, ttsRate };
      if (input.ttsEnabled !== undefined) setTtsEnabled(input.ttsEnabled);
      if (input.ttsVoice !== undefined) setTtsVoice(input.ttsVoice);
      if (input.ttsRate !== undefined) setTtsRate(input.ttsRate);
      return previous;
    },
    onSuccess: (updated) => {
      setTtsEnabled(updated.ttsEnabled);
      setTtsVoice(updated.ttsVoice);
      setTtsRate(updated.ttsRate);
    },
    onError: (_error, _input, previous) => {
      if (!previous) return;
      setTtsEnabled(previous.ttsEnabled);
      setTtsVoice(previous.ttsVoice);
      setTtsRate(previous.ttsRate);
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
      setFinishError(error instanceof Error ? error.message : t("practice.finish_failed"));
      finishRequestedRef.current = false;
    },
  });

  const requestFinish = useCallback(() => {
    if (!sessionId) {
      setFinishError(t("practice.session_starting"));
      return;
    }
    if (!token) {
      setFinishError(t("practice.not_authenticated"));
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

  const voiceOptions = useMemo(
    () => EDGE_TTS_VOICE_OPTIONS_BY_LANGUAGE[card?.language ?? "ja"],
    [card?.language],
  );

  const getOrPrefetchAudioUrl = useCallback(async (practiceCard: PracticeCard) => {
    if (!token) throw new Error("Not authenticated");
    if (!deckId) throw new Error("Deck not selected");
    const cacheKey = getTtsCacheKey(deckId, practiceCard.wordId, ttsVoice, ttsRate);

    const cachedUrl = ttsUrlCacheRef.current.get(cacheKey);
    if (cachedUrl) return cachedUrl;

    const cachedPromise = ttsPromiseCacheRef.current.get(cacheKey);
    if (cachedPromise) return await cachedPromise;

    const promise = api.fetchWordTts(token, practiceCard.wordId, deckId, ttsVoice, ttsRate).then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      ttsUrlCacheRef.current.set(cacheKey, objectUrl);
      ttsPromiseCacheRef.current.delete(cacheKey);
      return objectUrl;
    }).catch((error) => {
      ttsPromiseCacheRef.current.delete(cacheKey);
      throw error;
    });

    ttsPromiseCacheRef.current.set(cacheKey, promise);
    return await promise;
  }, [deckId, token, ttsRate, ttsVoice]);

  useEffect(() => {
    if (!ttsEnabled) return;
    for (const practiceCard of [card, ...upcomingCards].filter((value): value is PracticeCard => value !== null).slice(0, 8)) {
      void getOrPrefetchAudioUrl(practiceCard).catch(() => {
        // Ignore prefetch failures; playback will retry on demand.
      });
    }
  }, [card, getOrPrefetchAudioUrl, upcomingCards, ttsEnabled]);

  const replayCardAudio = useCallback(async (practiceCard: PracticeCard | null) => {
    if (!practiceCard || !ttsEnabled) return;

    audioRef.current?.pause();
    audioRef.current = null;

    try {
      const source = await getOrPrefetchAudioUrl(practiceCard);
      const audio = new Audio(source);
      audioRef.current = audio;
      await audio.play();
    } catch {
      // Ignore autoplay and synthesis failures so practice can continue.
    }
  }, [getOrPrefetchAudioUrl, ttsEnabled]);

  useEffect(() => {
    if (sessionDone || !card) return;

    const handleReplayShortcut = (event: KeyboardEvent) => {
      if (!isReplayTtsShortcut(event)) return;
      event.preventDefault();
      void replayCardAudio(card);
    };

    window.addEventListener("keydown", handleReplayShortcut, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleReplayShortcut, { capture: true });
    };
  }, [card, replayCardAudio, sessionDone]);

  useEffect(() => {
    if (!ttsEnabled && advancedPracticeEnabled) {
      setAdvancedPracticeEnabled(false);
    }
  }, [advancedPracticeEnabled, ttsEnabled]);

  useEffect(() => {
    if (!typingInput || typingFeedback.onTrack || cardHadMistake) return;
    setCardHadMistake(true);
  }, [cardHadMistake, typingFeedback.onTrack, typingInput]);

  useEffect(() => {
    if (!card) return;

    let cancelled = false;

    if (!ttsEnabled) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }

    void replayCardAudio(card).then(() => {
      if (cancelled && audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    });

    return () => {
      cancelled = true;
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [card, replayCardAudio, ttsEnabled]);

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

  useEffect(() => {
    audioRef.current?.pause();
    for (const objectUrl of ttsUrlCacheRef.current.values()) {
      URL.revokeObjectURL(objectUrl);
    }
    ttsUrlCacheRef.current.clear();
    ttsPromiseCacheRef.current.clear();
  }, [deckId, ttsRate, ttsVoice]);

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
        if (showShortcutHelp) {
          setShowShortcutHelp(false);
          return;
        }
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
    [card, exitConfirmOpen, focusInput, replayCardAudio, requestExitIntent, showShortcutHelp],
  );

  // Build character-by-character display for monkeytype effect
  const isAudioChallengeActive = advancedPracticeEnabled && ttsEnabled;
  const typingPrompt =
    advancedPracticeEnabled
      ? t("practice.audio_challenge_prompt", "listen and type what you hear...")
      : typingMode === "language_specific" && card?.language === "ja"
        ? t("practice.type_romaji")
        : t("practice.type_answer");

  const romajiChars = useMemo(() => {
    const target = typingFeedback.target;
    if (!target) return [];

    const typed = card
      ? getTypingMatchSource(typingInput, card.reading, card.romanization, card.language, typingMode)
      : normalizeTypingInput(typingInput);

    if (isAudioChallengeActive) {
      if (!typed) return [];

      return typed.split("").map((char, index) => ({
        char,
        pos: index,
        state: typed[index] === target[index] ? "correct" : "wrong",
      })) as Array<{ char: string; pos: number; state: "correct" | "wrong" | "cursor" | "pending" }>;
    }

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
  }, [card, isAudioChallengeActive, typingInput, typingFeedback.target, typingMode]);

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
      <div className="fixed inset-x-0 top-0 z-[210] flex flex-col gap-2 px-3 py-3 opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span
            className="inline-flex items-center rounded-full border border-[var(--border-muted)] bg-bg-page px-3 py-1 text-xs text-text-secondary font-medium"
            aria-label={`Session progress: ${cardsCompleted} of ${sessionTargetCards}`}
          >
            {cardsCompleted}/{sessionTargetCards}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-muted)] bg-bg-page px-3.5 py-1.5 text-sm text-accent-orange font-bold [font-family:var(--font-display)]" aria-label={`${t("practice.clean_streak", "Clean streak")}: ${cardStreak}`}>
            {cardStreak > 0 ? (
              <>
                <span className="text-base" aria-hidden="true">🔥</span>
                <span>{cardStreak}</span>
              </>
            ) : (
              <span className="text-text-secondary">0</span>
            )}
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
              {t("practice.clean_streak", "Clean streak")}
            </span>
          </span>
          {bestCardStreak > 0 ? (
            <span className="hidden text-[11px] font-bold uppercase tracking-wider text-text-secondary opacity-60 sm:inline" aria-label={`${t("practice.best_clean_streak", "Best clean")}: ${bestCardStreak}`}>
              {t("practice.best_clean_streak", "Best clean")}: {bestCardStreak}
            </span>
          ) : null}
          <button
            type="button"
            className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 text-[11px] text-text-secondary font-medium outline-none hover:border-[var(--border-strong)] hover:text-text-primary focus:outline-none focus-visible:outline-none sm:px-3 sm:text-xs"
            onClick={() => updateDeckTtsMutation.mutate({ ttsEnabled: !ttsEnabled })}
            aria-pressed={ttsEnabled}
            title={t("practice.tts_toggle", "Toggle pronunciation audio")}
          >
            <span className="inline-flex items-center gap-1.5">
              {ttsEnabled ? <Radio size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}
              <span>{ttsEnabled ? t("practice.tts_on", "TTS on") : t("practice.tts_off", "TTS off")}</span>
            </span>
          </button>
          {ttsEnabled ? (
            <>
              <button
                type="button"
                className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-medium outline-none focus:outline-none focus-visible:outline-none sm:gap-2 sm:px-3 sm:text-xs ${
                  advancedPracticeEnabled
                    ? "border-accent-orange bg-bg-page text-text-primary"
                    : "border-[var(--border-muted)] bg-bg-page text-text-secondary hover:border-[var(--border-strong)] hover:text-text-primary"
                }`}
                onClick={() => setAdvancedPracticeEnabled((prev) => !prev)}
                aria-pressed={advancedPracticeEnabled}
                title={t("practice.audio_challenge_toggle", "Toggle audio challenge mode")}
              >
                <Headphones size={13} aria-hidden="true" />
                <span className="hidden sm:inline">{t("practice.audio_challenge", "Audio challenge")}</span>
              </button>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 text-[11px] text-text-secondary font-medium outline-none hover:border-[var(--border-strong)] hover:text-text-primary focus:outline-none focus-visible:outline-none sm:gap-2 sm:px-3 sm:text-xs"
                onClick={() => void replayCardAudio(card)}
                title={t("practice.tts_replay", "Replay pronunciation audio")}
                aria-label={t("practice.tts_replay", "Replay pronunciation audio")}
              >
                <RotateCcw size={13} aria-hidden="true" />
                <span className="hidden sm:inline">{t("practice.tts_replay", "Replay")}</span>
                <kbd className="hidden border-0 bg-transparent px-0 py-0 font-mono text-[10px] text-text-primary shadow-none outline-none sm:inline-block">alt+r</kbd>
              </button>
              <label
                className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 text-[11px] text-text-secondary sm:gap-2 sm:px-3 sm:text-xs"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <span className="shrink-0 hidden sm:inline">{t("practice.tts_voice", "Voice")}</span>
                <span className="shrink-0 sm:hidden">{t("practice.tts_voice_short", "V")}</span>
                <select
                  className="min-w-0 appearance-none border-0 bg-transparent text-xs leading-none text-text-primary outline-none ring-0 focus:outline-none focus:ring-0"
                  value={ttsVoice}
                  onChange={(event) => updateDeckTtsMutation.mutate({ ttsVoice: event.target.value })}
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  disabled={updateDeckTtsMutation.isPending}
                >
                  {voiceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 text-[11px] text-text-secondary sm:gap-2 sm:px-3 sm:text-xs"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <span className="shrink-0 hidden sm:inline">{t("practice.tts_speed", "Speed")}</span>
                <span className="shrink-0 sm:hidden">{t("practice.tts_speed_short", "S")}</span>
                <select
                  className="min-w-0 appearance-none border-0 bg-transparent text-xs leading-none text-text-primary outline-none ring-0 focus:outline-none focus:ring-0"
                  value={ttsRate}
                  onChange={(event) => updateDeckTtsMutation.mutate({ ttsRate: event.target.value as EdgeTtsRate })}
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  disabled={updateDeckTtsMutation.isPending}
                >
                  {EDGE_TTS_RATE_PRESETS.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate === "-20%" ? t("practice.tts_speed_slow", "Slow") : rate === "+20%" ? t("practice.tts_speed_fast", "Fast") : t("practice.tts_speed_normal", "Normal")}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 text-[11px] text-text-secondary font-medium outline-none hover:border-[var(--border-strong)] hover:text-text-primary focus:outline-none focus-visible:outline-none sm:gap-2 sm:px-3 sm:text-xs"
            onClick={() => setShowShortcutHelp((prev) => !prev)}
            aria-expanded={showShortcutHelp}
            aria-controls="practice-shortcuts-panel"
            title={t("practice.shortcuts_help", "Practice shortcuts")}
          >
            <Keyboard size={13} aria-hidden="true" />
            <span className="hidden sm:inline">{t("practice.shortcuts_help", "Shortcuts")}</span>
          </button>
        </div>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center justify-center gap-2 self-end whitespace-nowrap rounded-lg border border-[var(--border-muted)] bg-transparent px-3 text-xs font-normal text-text-secondary hover:border-[var(--border-strong)] hover:text-text-primary sm:h-auto sm:self-auto sm:px-3.5 sm:py-1.5 sm:text-[13px]"
          onClick={() => requestExitIntent("button")}
        >
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
      {showShortcutHelp ? (
        <div
          id="practice-shortcuts-panel"
          className="fixed left-3 top-14 z-[225] w-[min(92vw,22rem)] rounded-2xl border border-[var(--border-strong)] bg-bg-card/95 p-4 shadow-xl backdrop-blur-sm sm:left-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-medium text-text-primary">{t("practice.shortcuts_help", "Practice shortcuts")}</p>
              <p className="mt-1 mb-0 text-xs text-text-secondary">{t("practice.shortcuts_desc", "Quick controls for audio and exit.")}</p>
            </div>
            <button
              type="button"
              className="rounded-full border border-[var(--border-strong)] bg-bg-page p-1 text-text-primary hover:border-accent-orange hover:text-text-primary"
              onClick={() => setShowShortcutHelp(false)}
              aria-label={t("common.close", "Close")}
            >
              <RotateCcw size={12} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-4 space-y-2 text-xs text-text-secondary">
            {ttsEnabled ? (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-muted)] bg-bg-page/80 px-3 py-2">
                <span>{t("practice.shortcut_replay_audio", "Replay pronunciation")}</span>
                <kbd className="rounded border border-[var(--border-strong)] bg-bg-card px-1.5 py-0.5 font-mono text-[10px] text-text-primary">alt+r</kbd>
              </div>
            ) : null}
            {ttsEnabled ? (
              <div className="rounded-xl border border-[var(--border-muted)] bg-bg-page/80 px-3 py-2 text-[11px] leading-5 text-text-secondary">
                {t("practice.audio_challenge_desc", "Audio challenge hides the prompt so you answer from sound alone.")}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-muted)] bg-bg-page/80 px-3 py-2">
              <span>{t("practice.shortcut_end_session", "Exit session")}</span>
              <kbd className="rounded border border-[var(--border-strong)] bg-bg-card px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">esc esc</kbd>
            </div>
            <div className="rounded-xl border border-[var(--border-muted)] bg-bg-page/80 px-3 py-2 text-[11px] leading-5 text-text-secondary">
              {t("practice.clean_streak_desc", "Clean streak only increases when you finish a card without ever going off track.")}
            </div>
          </div>
        </div>
      ) : null}
      {exitConfirmOpen ? (
        <div className="fixed left-1/2 top-16 z-[230] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-[var(--border-strong)] bg-bg-card p-4 shadow-xl">
          <p className="m-0 text-sm text-text-primary">{t("practice.end_confirm_title")}</p>
          <p className="mt-1 mb-0 text-xs text-text-secondary">{t("practice.end_confirm_desc")}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-[var(--border-strong)] bg-bg-page px-3 py-1.5 text-xs font-medium text-text-primary hover:border-accent-orange hover:text-text-primary"
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
        {isAudioChallengeActive ? (
          <div className="flex max-w-[min(90vw,32rem)] flex-col items-center gap-3 rounded-[28px] border border-[var(--border-strong)] bg-bg-card/80 px-6 py-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-muted)] bg-bg-page text-accent-orange">
              <Headphones size={18} aria-hidden="true" />
            </div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              {t("practice.audio_challenge", "Audio challenge")}
            </p>
            <h2 className="m-0 text-2xl leading-tight text-text-primary [font-family:var(--font-display)]">
              {t("practice.audio_challenge_title", "Listen first. Type from memory.")}
            </h2>
            <p className="m-0 text-sm leading-6 text-text-secondary">
              {t("practice.audio_challenge_body", "The prompt is hidden in this mode. Replay the audio if you need another pass, then type the word exactly.")}
            </p>
          </div>
        ) : (
          <>
            {card.meaning ? (
              <div className="text-base tracking-[0.02em] text-text-secondary">{card.meaning}</div>
            ) : null}
            <div
              className={`select-none text-5xl leading-tight tracking-[0.04em] text-text-primary md:text-7xl ${card.language === "ja" ? "[font-family:var(--font-jp)]" : ""}`}
              lang={card.language}
            >
              {card.target}
            </div>
            {card.reading ? (
              <div
                className={`-mt-1 text-lg text-text-secondary ${card.language === "ja" ? "[font-family:var(--font-jp)]" : ""}`}
                lang={card.language}
              >
                {card.reading}
              </div>
            ) : null}
            {card.example ? (
              <div className="mt-2 max-w-[min(90vw,42rem)] rounded-2xl border border-[var(--border-muted)] bg-bg-card/70 px-4 py-3 text-center text-sm leading-6 text-text-secondary backdrop-blur-sm md:px-5">
                <p className={`m-0 ${card.language === "ja" ? "[font-family:var(--font-jp)]" : ""}`} lang={card.language}>
                  {card.example}
                </p>
              </div>
            ) : null}
          </>
        )}

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
          {isAudioChallengeActive ? t("practice.type_answer_generic", "Type answer") : `Type answer for ${card.target}`}
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
              event.stopPropagation();
              if (showShortcutHelp) {
                setShowShortcutHelp(false);
                return;
              }
              if (exitConfirmOpen) {
                setExitConfirmOpen(false);
                setExitEscHint(false);
              } else {
                requestExitIntent("esc");
              }
            }
          }}
          aria-label={isAudioChallengeActive ? t("practice.type_answer_generic", "Type answer") : `Type answer for ${card.target}`}
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
