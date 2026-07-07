import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpenText, Eye, EyeOff, Languages, RotateCcw, Volume2, VolumeX } from "lucide-react";
import {
  getDefaultEdgeTtsVoice,
  LANGUAGE_LABELS,
  type EdgeTtsRate,
  type LanguageCode,
  type ReadingDocumentDTO,
  type ReadingParagraphDTO,
} from "@inko/shared";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { authQueryKey } from "../lib/queryKeys";
import { applyNoIndexMetadata } from "../lib/seo";

const READING_TTS_PREFETCH_WINDOW = 5;

type SentenceUnit = {
  paragraph: ReadingParagraphDTO;
  paragraphIndex: number;
  sentence: ReadingParagraphDTO["sentences"][number];
  queueIndex: number;
};

function getParagraphSentences(paragraph: ReadingParagraphDTO) {
  return paragraph.sentences.length > 0
    ? paragraph.sentences
    : [{ id: `${paragraph.id}-s-1`, text: paragraph.source, index: 0 }];
}

function getInitialParagraphIndex(document: ReadingDocumentDTO | undefined) {
  if (!document) return 0;
  const incompleteIndex = document.paragraphs.findIndex(
    (paragraph) => paragraph.translation.trim().length === 0,
  );
  return incompleteIndex >= 0 ? incompleteIndex : 0;
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function buildSentenceQueue(document: ReadingDocumentDTO | undefined) {
  const units: SentenceUnit[] = [];
  document?.paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const sentence of getParagraphSentences(paragraph)) {
      units.push({ paragraph, paragraphIndex, sentence, queueIndex: units.length });
    }
  });
  return units;
}

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("button, a, input, select, textarea, [role='button'], [tabindex]:not([tabindex='-1'])"));
}

export function ReadingPracticePage() {
  const { token } = useAuth();
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [typedInput, setTypedInput] = useState("");
  const [activeTtsSentenceId, setActiveTtsSentenceId] = useState<string | null>(null);
  const [loadingTtsSentenceId, setLoadingTtsSentenceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsRate, setTtsRate] = useState<EdgeTtsRate>("default");
  const [cardTransition, setCardTransition] = useState(false);
  const [lastSubmitAccepted, setLastSubmitAccepted] = useState<boolean | null>(null);

  const hiddenInputRef = useRef<HTMLTextAreaElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef(new Map<string, string>());
  const audioInFlightRef = useRef(new Map<string, Promise<string>>());

  useEffect(() => {
    applyNoIndexMetadata("Reading Practice | Inko", "Practice typing Japanese sentences from imported readings.");
  }, []);

  const documentQuery = useQuery({
    queryKey: authQueryKey(token, "reading-document", documentId),
    queryFn: () => api.getReadingDocument(token ?? "", documentId ?? ""),
    enabled: Boolean(token && documentId),
  });

  const currentDocument = documentQuery.data;
  const sentenceQueue = useMemo(() => buildSentenceQueue(currentDocument), [currentDocument]);

  const activeParagraph = currentDocument?.paragraphs[paragraphIndex];
  const activeSentences = activeParagraph ? getParagraphSentences(activeParagraph) : [];
  const activeSentence = activeSentences[sentenceIndex];
  const activeUnit = activeSentence
    ? sentenceQueue.find((unit) => unit.sentence.id === activeSentence.id)
    : undefined;
  const activeSentenceTranslation = activeSentence
    ? activeParagraph?.sentenceTranslations[activeSentence.index]?.translation
    : undefined;
  const completedCount = currentDocument?.completedCount ?? 0;
  const sourceLanguage: LanguageCode = currentDocument?.sourceLanguage ?? "ja";
  const chapterLabel = activeParagraph?.chapterTitle ?? "Imported text";

  // Character analysis for monkeytype display
  const sourceText = activeSentence?.text ?? "";
  const sourceChars = useMemo(() => [...sourceText], [sourceText]);

  const charStates = useMemo(() => {
    const typed = [...typedInput];
    return sourceChars.map((char, i) => {
      if (i < typed.length) {
        return typed[i] === char ? "correct" : "wrong";
      }
      if (i === typed.length) return "cursor";
      return "pending";
    });
  }, [sourceChars, typedInput]);

  const isComplete = typedInput === sourceText && sourceText.length > 0;

  // Reset state when changing paragraph
  useEffect(() => {
    if (!currentDocument) return;
    setParagraphIndex((current) => {
      if (currentDocument.paragraphs[current]) return current;
      return getInitialParagraphIndex(currentDocument);
    });
  }, [currentDocument]);

  useEffect(() => {
    setSentenceIndex(0);
    setTypedInput("");
    setLastSubmitAccepted(null);
  }, [paragraphIndex]);

  useEffect(() => {
    setTypedInput("");
    setLastSubmitAccepted(null);
    window.requestAnimationFrame(() => hiddenInputRef.current?.focus());
  }, [sentenceIndex]);

  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      for (const url of audioCacheRef.current.values()) URL.revokeObjectURL(url);
      audioCacheRef.current.clear();
      audioInFlightRef.current.clear();
    };
  }, []);

  const updateDocument = useMutation({
    mutationFn: async (input: {
      documentId: string;
      patch: Parameters<typeof api.updateReadingDocument>[2];
    }) => api.updateReadingDocument(token ?? "", input.documentId, input.patch),
    onSuccess: async (document) => {
      queryClient.setQueryData(authQueryKey(token, "reading-document", document.id), document);
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "reading-documents") });
    },
  });

  const translateParagraph = useMutation({
    mutationFn: async (paragraph: ReadingParagraphDTO) => {
      if (!currentDocument) throw new Error("No reading selected.");
      return api.translateReadingParagraph(token ?? "", {
        sourceLanguage: currentDocument.sourceLanguage,
        translationLanguage: currentDocument.translationLanguage,
        paragraph: paragraph.source,
      });
    },
    onSuccess: async (translation, paragraph) => {
      if (!currentDocument) return;
      const paragraphs = currentDocument.paragraphs.map((item) =>
        item.id === paragraph.id
          ? {
              ...item,
              engineTranslation: translation.translation,
              sentenceTranslations: translation.sentenceTranslations,
              meaningHints: translation.meaningHints,
            }
          : item,
      );
      await updateDocument.mutateAsync({
        documentId: currentDocument.id,
        patch: { paragraphs },
      });
    },
    onError: (translationError) => {
      setError(translationError instanceof Error ? translationError.message : "Translation failed.");
    },
  });

  // Pre-fetch translations: translate current + next paragraph proactively
  useEffect(() => {
    if (!currentDocument) return;

    // Translate current paragraph if needed
    if (
      activeParagraph &&
      !activeParagraph.sentenceTranslations.length &&
      !activeParagraph.engineTranslation &&
      !translateParagraph.isPending
    ) {
      translateParagraph.mutate(activeParagraph);
    }

    // Pre-fetch next paragraph's translation when on last sentence
    const nextParagraph = currentDocument.paragraphs[paragraphIndex + 1];
    if (
      sentenceIndex >= activeSentences.length - 1 &&
      nextParagraph &&
      !nextParagraph.sentenceTranslations.length &&
      !nextParagraph.engineTranslation &&
      !translateParagraph.isPending
    ) {
      translateParagraph.mutate(nextParagraph);
    }
  }, [activeParagraph, paragraphIndex, sentenceIndex, activeSentences.length, currentDocument, translateParagraph]);

  const markSentenceComplete = useCallback(async () => {
    if (!currentDocument || !activeParagraph) return;

    const nextSentenceIndex = sentenceIndex + 1;
    const newTranslation = activeSentences
      .slice(0, nextSentenceIndex)
      .map(() => "✓")
      .join("");

    const paragraphs = currentDocument.paragraphs.map((paragraph) =>
      paragraph.id === activeParagraph.id
        ? { ...paragraph, translation: newTranslation }
        : paragraph,
    );

    queryClient.setQueryData(authQueryKey(token, "reading-document", currentDocument.id), {
      ...currentDocument,
      paragraphs,
      completedCount: paragraphs.filter((p) => p.translation.trim().length > 0).length,
      updatedAt: Date.now(),
    });

    await updateDocument.mutateAsync({
      documentId: currentDocument.id,
      patch: { paragraphs },
    });
  }, [
    activeParagraph,
    activeSentences,
    currentDocument,
    sentenceIndex,
    queryClient,
    token,
    updateDocument,
  ]);

  const getSentenceAudio = useCallback(
    async (unit: SentenceUnit) => {
      const cached = audioCacheRef.current.get(unit.sentence.id);
      if (cached) return cached;

      const pending = audioInFlightRef.current.get(unit.sentence.id);
      if (pending) return pending;

      if (!currentDocument) throw new Error("No reading selected.");
      const voice = getDefaultEdgeTtsVoice(currentDocument.sourceLanguage);
      const request = api
        .fetchReadingSentenceTts(
          token ?? "",
          currentDocument.id,
          unit.paragraph.id,
          unit.sentence.id,
          voice,
          ttsRate,
        )
        .then((audio) => {
          const url = URL.createObjectURL(audio);
          audioCacheRef.current.set(unit.sentence.id, url);
          return url;
        })
        .finally(() => {
          audioInFlightRef.current.delete(unit.sentence.id);
        });
      audioInFlightRef.current.set(unit.sentence.id, request);
      return request;
    },
    [currentDocument, token, ttsRate],
  );

  const prefetchFrom = useCallback(
    (queueIndex: number) => {
      for (const unit of sentenceQueue.slice(queueIndex, queueIndex + READING_TTS_PREFETCH_WINDOW)) {
        void getSentenceAudio(unit).catch(() => undefined);
      }
    },
    [getSentenceAudio, sentenceQueue],
  );

  const playSentence = useCallback(
    async (unit: SentenceUnit) => {
      if (!ttsEnabled) return;
      try {
        setLoadingTtsSentenceId(unit.sentence.id);
        const url = await getSentenceAudio(unit);
        setLoadingTtsSentenceId(null);
        setActiveTtsSentenceId(unit.sentence.id);

        audioRef.current?.pause();
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setActiveTtsSentenceId(null);
        await audio.play();
      } catch {
        setLoadingTtsSentenceId(null);
        setActiveTtsSentenceId(null);
      }
    },
    [getSentenceAudio, ttsEnabled],
  );

  const playCurrentSentence = useCallback(() => {
    if (activeUnit) void playSentence(activeUnit);
  }, [activeUnit, playSentence]);

  // Prefetch TTS and auto-play
  useEffect(() => {
    if (activeUnit) prefetchFrom(activeUnit.queueIndex);
  }, [activeUnit, prefetchFrom]);

  useEffect(() => {
    if (ttsEnabled && activeUnit) {
      void playSentence(activeUnit);
    }
  }, [ttsEnabled, activeUnit, playSentence]);

  // Auto-advance on complete match
  useEffect(() => {
    if (!isComplete || !activeParagraph) return;

    setLastSubmitAccepted(true);
    void markSentenceComplete();

    setCardTransition(true);
    setTimeout(() => {
      const nextIndex = sentenceIndex + 1;
      if (nextIndex >= activeSentences.length) {
        if (paragraphIndex < (currentDocument?.paragraphs.length ?? 0) - 1) {
          setParagraphIndex(paragraphIndex + 1);
        }
      } else {
        setSentenceIndex(nextIndex);
      }
      setCardTransition(false);
    }, 350);
  }, [isComplete, activeParagraph, sentenceIndex, activeSentences, paragraphIndex, currentDocument, markSentenceComplete]);

  const skipSentence = useCallback(() => {
    if (!activeParagraph) return;
    setLastSubmitAccepted(null);
    const nextIndex = sentenceIndex + 1;
    if (nextIndex >= activeSentences.length) {
      if (paragraphIndex < (currentDocument?.paragraphs.length ?? 0) - 1) {
        setParagraphIndex(paragraphIndex + 1);
      }
    } else {
      setSentenceIndex(nextIndex);
    }
  }, [activeParagraph, activeSentences, paragraphIndex, sentenceIndex, currentDocument]);

  const goToParagraph = useCallback(
    (nextIndex: number) => {
      if (!currentDocument) return;
      const clamped = clampIndex(nextIndex, currentDocument.paragraphs.length);
      setParagraphIndex(clamped);
      setError(null);
    },
    [currentDocument],
  );

  const focusInput = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isInteractiveElement(event.target)) return;
      focusInput();
    },
    [focusInput],
  );

  if (documentQuery.isLoading) {
    return (
      <section className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-page">
        <p className="m-0 text-sm text-text-secondary">Loading reading...</p>
      </section>
    );
  }

  if (!currentDocument || !activeParagraph || !activeSentence) {
    return (
      <section className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-page px-6 text-center">
        <div>
          <BookOpenText className="mx-auto mb-3 h-10 w-10 text-text-secondary" aria-hidden="true" />
          <p className="m-0 text-sm text-text-secondary">This reading could not be loaded.</p>
          <Link
            to="/reader"
            className="mt-4 inline-flex rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm text-text-primary"
          >
            Back to library
          </Link>
        </div>
      </section>
    );
  }

  const progressPercent = activeSentences.length > 0
    ? Math.round(((sentenceIndex) / activeSentences.length) * 100)
    : 0;

  return (
    <section
      className="fixed inset-0 z-[200] flex cursor-text flex-col items-center justify-start overflow-hidden bg-bg-page sm:justify-center"
      tabIndex={-1}
      aria-label="Reading practice"
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        if (isInteractiveElement(event.target)) return;
        focusInput();
      }}
    >
      {/* Top bar - low opacity, brightens on hover — matching PracticePage style */}
      <div className="fixed inset-x-0 top-0 z-[210] flex flex-col gap-2 px-3 py-3 opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          {/* Title + chapter info */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-muted)] bg-bg-page px-3 py-1 text-xs text-text-secondary font-medium">
            {currentDocument.title}
          </span>

          {/* Language */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 py-1 text-xs text-text-secondary">
            <Languages className="h-3 w-3" aria-hidden="true" />
            {LANGUAGE_LABELS[sourceLanguage]}
          </span>

          {/* Progress */}
          <span className="inline-flex items-center rounded-full border border-[var(--border-muted)] bg-bg-page px-3 py-1 text-xs text-text-secondary font-medium">
            S{sentenceIndex + 1}/{activeSentences.length} · P{paragraphIndex + 1}/{currentDocument.paragraphCount}
          </span>

          {/* Completed count */}
          <span className="inline-flex items-center rounded-full border border-[var(--border-muted)] bg-bg-page px-3 py-1 text-xs text-text-secondary font-medium">
            {completedCount}/{currentDocument.paragraphCount} done
          </span>

          {/* TTS toggle */}
          <button
            type="button"
            className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 text-[11px] text-text-secondary font-medium outline-none hover:border-[var(--border-strong)] hover:text-text-primary sm:px-3 sm:text-xs"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            aria-pressed={ttsEnabled}
          >
            <span className="inline-flex items-center gap-1.5">
              {ttsEnabled ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}
              <span className="hidden sm:inline">{ttsEnabled ? "Audio on" : "Audio off"}</span>
            </span>
          </button>

          {/* Replay */}
          {ttsEnabled ? (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 text-[11px] text-text-secondary font-medium outline-none hover:border-[var(--border-strong)] hover:text-text-primary sm:px-3 sm:text-xs"
              onClick={playCurrentSentence}
              disabled={loadingTtsSentenceId === activeSentence.id}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span className="hidden sm:inline">Replay</span>
            </button>
          ) : null}

          {/* Translation toggle */}
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 text-[11px] text-text-secondary font-medium outline-none hover:border-[var(--border-strong)] hover:text-text-primary sm:px-3 sm:text-xs"
            onClick={() => setShowTranslation(!showTranslation)}
          >
            {showTranslation ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
            <span className="hidden sm:inline">{showTranslation ? "Hide" : "Show"}</span>
          </button>

          {/* Skip */}
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-muted)] bg-bg-page px-2.5 text-[11px] text-text-secondary font-medium outline-none hover:border-[var(--border-strong)] hover:text-text-primary sm:px-3 sm:text-xs"
            onClick={skipSentence}
          >
            Skip
          </button>
        </div>

        {/* Exit */}
        <Link
          to={`/reader/${currentDocument.id}`}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-2 self-end whitespace-nowrap rounded-lg border border-[var(--border-muted)] bg-transparent px-3 text-xs font-normal text-text-secondary hover:border-[var(--border-strong)] hover:text-text-primary sm:h-auto sm:self-auto sm:px-3.5 sm:py-1.5 sm:text-[13px]"
        >
          Exit
        </Link>
      </div>

      {/* Translation panel - shown by default, below typing box */}

      {/* Error */}
      {error ? (
        <div className="fixed left-1/2 top-14 z-[220] -translate-x-1/2 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-toast-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
          {error}
        </div>
      ) : null}

      {/* Success glow */}
      <div
        className={`pointer-events-none fixed inset-0 z-[190] bg-[radial-gradient(circle_at_center,var(--accent-teal)_0%,transparent_40%)] opacity-0 transition-opacity duration-300 ${cardTransition ? "opacity-5" : ""}`}
        aria-hidden="true"
      />

      {/* Center focus area */}
      <div className="relative z-[200] mt-[clamp(7rem,18svh,9.5rem)] flex max-h-[calc(100svh-8rem)] w-[min(92vw,44rem)] flex-col items-center justify-start gap-4 overflow-y-auto overflow-x-hidden px-2 text-center transition-all duration-300 sm:mt-0 sm:max-h-[min(86svh,40rem)] sm:justify-center">
        {/* Chapter label */}
        <div className="max-w-full truncate text-base tracking-[0.02em] text-text-secondary">
          {chapterLabel}
        </div>

        {/* Source text - the model */}
        <div
          className={`max-w-full select-none text-2xl leading-relaxed tracking-[0.04em] text-text-primary md:text-3xl md:leading-relaxed ${sourceLanguage === "ja" ? "[font-family:var(--font-jp)]" : ""}`}
          lang={sourceLanguage}
        >
          {activeSentence.text}
        </div>

        {/* Monkeytype-style character feedback */}
        <div
          className={`mt-1 flex min-h-[42px] max-w-full flex-wrap justify-center gap-0.5 font-mono text-[20px] tracking-[0.06em] md:text-[26px] ${lastSubmitAccepted === false ? "animate-shake text-[var(--danger-text)]" : ""}`}
          aria-hidden="true"
        >
          {sourceChars.map((char, i) => {
            const state = charStates[i];
            const displayChar = char === " " ? "\u00A0" : char;
            return (
              <span
                key={i}
                className={`whitespace-pre ${
                  state === "correct"
                    ? "text-accent-teal"
                    : state === "wrong"
                      ? "text-[var(--danger-text)] underline decoration-[color:color-mix(in_oklab,var(--danger-text)_40%,transparent)]"
                      : state === "cursor"
                        ? "text-text-primary underline decoration-accent-orange"
                        : "text-text-secondary"
                }`}
              >
                {displayChar}
              </span>
            );
          })}
          {typedInput.length > sourceChars.length
            ? [...typedInput.slice(sourceChars.length)].map((char, i) => (
                <span key={`extra-${i}`} className="text-[var(--danger-text)]">
                  {char}
                </span>
              ))
            : null}
        </div>

        {/* Placeholder when empty */}
        {!typedInput ? (
          <p className="text-sm text-text-secondary">
            Start typing the sentence above
          </p>
        ) : null}

        {/* Translation - shown below typing box */}
        {showTranslation ? (
          <div className="mt-2 w-full max-w-xl rounded-xl border border-[var(--border-subtle)] bg-bg-card/80 p-4 text-left">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                <Languages className="h-3 w-3" aria-hidden="true" />
                Translation
              </div>
              <button
                type="button"
                className="rounded-full border border-[var(--border-muted)] bg-bg-page p-1 text-text-secondary hover:text-text-primary"
                onClick={() => setShowTranslation(false)}
                aria-label="Hide translation"
              >
                <EyeOff size={12} aria-hidden="true" />
              </button>
            </div>
            {translateParagraph.isPending ? (
              <p className="m-0 text-sm text-text-secondary">Translating...</p>
            ) : (
              <>
                {activeSentenceTranslation ? (
                  <p className="m-0 text-sm leading-6 text-text-secondary">{activeSentenceTranslation}</p>
                ) : activeParagraph?.engineTranslation ? (
                  <p className="m-0 text-sm leading-6 text-text-secondary">{activeParagraph.engineTranslation}</p>
                ) : null}

                {activeParagraph?.meaningHints.filter(
                  (hint) => hint.meaning !== "Add or confirm this meaning while translating.",
                ).length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activeParagraph.meaningHints
                      .filter((hint) => hint.meaning !== "Add or confirm this meaning while translating.")
                      .map((hint) => (
                        <span
                          key={`${activeParagraph.id}-${hint.term}`}
                          className="rounded-full border border-[var(--border-muted)] bg-bg-page px-2 py-0.5 text-[11px] text-text-secondary"
                        >
                          <strong className="text-text-primary">{hint.term}</strong>: {hint.meaning}
                        </span>
                      ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Hidden textarea - preserves spaces unlike input */}
      <label className="absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]" htmlFor="reading-typing-input">
        Type the sentence
      </label>
      <textarea
        id="reading-typing-input"
        key={`${paragraphIndex}-${sentenceIndex}`}
        ref={hiddenInputRef as React.Ref<HTMLTextAreaElement>}
        className="pointer-events-none absolute h-px w-px overflow-hidden border-0 p-0 opacity-0"
        rows={1}
        value={typedInput}
        onChange={(event) => {
          // textarea preserves whitespace as-is
          setTypedInput(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
          // Allow Enter to pass through (no newlines in typing)
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        aria-label="Type the sentence"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        lang={sourceLanguage}
        onCompositionStart={() => {}}
        onCompositionUpdate={() => {}}
      />

      {/* Progress bar */}
      <div className="fixed inset-x-0 bottom-0 z-[210]">
        <div className="h-[3px] overflow-hidden bg-bg-page" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-accent-orange to-accent-teal transition-[width] duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}
