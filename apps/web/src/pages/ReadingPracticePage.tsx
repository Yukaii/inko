import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpenText, Languages, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import {
  getDefaultEdgeTtsVoice,
  LANGUAGE_LABELS,
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
  const incompleteIndex = document.paragraphs.findIndex((paragraph) => paragraph.translation.trim().length === 0);
  return incompleteIndex >= 0 ? incompleteIndex : 0;
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function getTranslationPreview(paragraph: ReadingParagraphDTO) {
  return paragraph.engineTranslation || paragraph.sentenceTranslations.map((sentence) => sentence.translation).join(" ");
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

export function ReadingPracticePage() {
  const { token } = useAuth();
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [draftTranslation, setDraftTranslation] = useState("");
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [loadingSentenceId, setLoadingSentenceId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const typingRef = useRef<HTMLTextAreaElement | null>(null);
  const audioCacheRef = useRef(new Map<string, string>());
  const audioInFlightRef = useRef(new Map<string, Promise<string>>());

  useEffect(() => {
    applyNoIndexMetadata("Reading Practice | Inko", "Focused reading and translation typing workspace.");
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
  const activeQueueIndex = activeSentenceId ? sentenceQueue.find((unit) => unit.sentence.id === activeSentenceId)?.queueIndex : undefined;
  const completedCount = currentDocument?.completedCount ?? 0;
  const progressPercent = currentDocument && currentDocument.paragraphCount > 0
    ? Math.round((completedCount / currentDocument.paragraphCount) * 100)
    : 0;
  const sourceLanguage: LanguageCode = currentDocument?.sourceLanguage ?? "ja";

  useEffect(() => {
    if (!currentDocument) return;
    setParagraphIndex((current) => {
      if (currentDocument.paragraphs[current]) return current;
      return getInitialParagraphIndex(currentDocument);
    });
  }, [currentDocument]);

  useEffect(() => {
    if (!activeParagraph) return;
    setDraftTranslation(activeParagraph.translation);
    setActiveSentenceId((current) => current ?? activeSentences[0]?.id ?? null);
    window.requestAnimationFrame(() => typingRef.current?.focus());
  }, [activeParagraph?.id]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      for (const url of audioCacheRef.current.values()) URL.revokeObjectURL(url);
      audioCacheRef.current.clear();
      audioInFlightRef.current.clear();
    };
  }, []);

  const updateDocument = useMutation({
    mutationFn: async (input: { documentId: string; patch: Parameters<typeof api.updateReadingDocument>[2] }) =>
      api.updateReadingDocument(token ?? "", input.documentId, input.patch),
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
      await updateDocument.mutateAsync({ documentId: currentDocument.id, patch: { paragraphs } });
      setStatus("Engine translation added.");
    },
    onError: (translationError) => {
      setError(translationError instanceof Error ? translationError.message : "Translation failed.");
    },
  });

  const saveActiveParagraph = useCallback(async () => {
    if (!currentDocument || !activeParagraph) return;
    const paragraphs = currentDocument.paragraphs.map((paragraph) =>
      paragraph.id === activeParagraph.id ? { ...paragraph, translation: draftTranslation } : paragraph,
    );
    queryClient.setQueryData(authQueryKey(token, "reading-document", currentDocument.id), {
      ...currentDocument,
      paragraphs,
      completedCount: paragraphs.filter((paragraph) => paragraph.translation.trim().length > 0).length,
      updatedAt: Date.now(),
    });
    await updateDocument.mutateAsync({ documentId: currentDocument.id, patch: { paragraphs } });
    setStatus("Translation saved.");
  }, [activeParagraph, currentDocument, draftTranslation, queryClient, token, updateDocument]);

  const goToParagraph = useCallback(async (nextIndex: number) => {
    if (!currentDocument) return;
    await saveActiveParagraph();
    const clamped = clampIndex(nextIndex, currentDocument.paragraphs.length);
    setParagraphIndex(clamped);
    setActiveSentenceId(getParagraphSentences(currentDocument.paragraphs[clamped])?.[0]?.id ?? null);
    setStatus(null);
  }, [currentDocument, saveActiveParagraph]);

  const getSentenceAudio = useCallback(async (unit: SentenceUnit) => {
    const cached = audioCacheRef.current.get(unit.sentence.id);
    if (cached) return cached;

    const pending = audioInFlightRef.current.get(unit.sentence.id);
    if (pending) return pending;

    if (!currentDocument) throw new Error("No reading selected.");
    const voice = getDefaultEdgeTtsVoice(currentDocument.sourceLanguage);
    const request = api
      .fetchReadingSentenceTts(token ?? "", currentDocument.id, unit.paragraph.id, unit.sentence.id, voice, "default")
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
  }, [currentDocument, token]);

  const prefetchFrom = useCallback((queueIndex: number) => {
    for (const unit of sentenceQueue.slice(queueIndex, queueIndex + READING_TTS_PREFETCH_WINDOW)) {
      void getSentenceAudio(unit).catch(() => undefined);
    }
  }, [getSentenceAudio, sentenceQueue]);

  const playSentence = useCallback(async (unit: SentenceUnit) => {
    try {
      setError(null);
      setLoadingSentenceId(unit.sentence.id);
      const url = await getSentenceAudio(unit);
      setLoadingSentenceId(null);
      setActiveSentenceId(unit.sentence.id);
      setParagraphIndex(unit.paragraphIndex);
      prefetchFrom(unit.queueIndex + 1);

      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        const nextUnit = sentenceQueue[unit.queueIndex + 1];
        if (nextUnit) {
          void playSentence(nextUnit);
        }
      };
      await audio.play();
    } catch (ttsError) {
      setLoadingSentenceId(null);
      setError(ttsError instanceof Error ? ttsError.message : "Could not play audio.");
    }
  }, [getSentenceAudio, prefetchFrom, sentenceQueue]);

  useEffect(() => {
    const firstUnit = activeSentenceId
      ? sentenceQueue.find((unit) => unit.sentence.id === activeSentenceId)
      : activeParagraph
        ? sentenceQueue.find((unit) => unit.paragraph.id === activeParagraph.id)
        : undefined;
    if (firstUnit) prefetchFrom(firstUnit.queueIndex);
  }, [activeParagraph?.id, activeSentenceId, prefetchFrom, sentenceQueue]);

  if (documentQuery.isLoading) {
    return (
      <section className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-page">
        <p className="m-0 text-sm text-text-secondary">Loading reading...</p>
      </section>
    );
  }

  if (!currentDocument || !activeParagraph) {
    return (
      <section className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-page px-6 text-center">
        <div>
          <BookOpenText className="mx-auto mb-3 h-10 w-10 text-text-secondary" aria-hidden="true" />
          <p className="m-0 text-sm text-text-secondary">This reading could not be loaded.</p>
          <Link to="/reader" className="mt-4 inline-flex rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm text-text-primary">
            Back to library
          </Link>
        </div>
      </section>
    );
  }

  const firstActiveUnit = sentenceQueue.find((unit) => unit.paragraph.id === activeParagraph.id);
  const activeSentenceIndex = activeSentences.findIndex((sentence) => sentence.id === activeSentenceId);
  const activeSentenceTranslation = activeParagraph.sentenceTranslations[activeSentenceIndex]?.translation;
  const chapterLabel = activeParagraph.chapterTitle ?? "Imported text";
  const translationPreview = getTranslationPreview(activeParagraph);

  return (
    <section className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-bg-page" aria-label="Reading practice">
      <header className="flex flex-col gap-3 border-b border-[var(--border-subtle)] bg-bg-page/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium text-text-secondary">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-bg-card px-2.5 py-1">
              <Languages className="h-3.5 w-3.5 text-accent-teal" aria-hidden="true" />
              {LANGUAGE_LABELS[currentDocument.sourceLanguage]} to {currentDocument.translationLanguage}
            </span>
            <span>{chapterLabel}</span>
          </div>
          <h1 className="m-0 truncate text-lg font-semibold text-text-primary">{currentDocument.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--border-subtle)] bg-bg-card px-3 py-1 text-xs text-text-secondary">
            {paragraphIndex + 1}/{currentDocument.paragraphCount} paragraphs
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-bg-card px-3 py-2 text-xs font-medium text-text-primary hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => firstActiveUnit && void playSentence(firstActiveUnit)}
            disabled={!firstActiveUnit || loadingSentenceId !== null}
          >
            <Volume2 className="h-3.5 w-3.5 text-accent-teal" aria-hidden="true" />
            {loadingSentenceId ? "Loading..." : "Listen from here"}
          </button>
          <Link
            to={`/reader/${currentDocument.id}`}
            className="rounded-xl border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
          >
            Exit
          </Link>
        </div>
      </header>

      <div className="h-1 bg-bg-card">
        <div className="h-full bg-accent-teal transition-all" style={{ width: `${progressPercent}%` }} />
      </div>

      <main className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
        <section className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6 lg:px-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Read</p>
              <p className="m-0 mt-1 text-sm text-text-secondary">{completedCount}/{currentDocument.paragraphCount} translated</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-bg-card px-3 py-2 text-xs font-medium text-text-primary hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => translateParagraph.mutate(activeParagraph)}
              disabled={translateParagraph.isPending}
            >
              <Sparkles className="h-3.5 w-3.5 text-accent-orange" aria-hidden="true" />
              {translateParagraph.isPending ? "Translating..." : "Translate"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {activeSentences.map((sentence) => {
              const unit = sentenceQueue.find((item) => item.sentence.id === sentence.id);
              const isActive = activeSentenceId === sentence.id;
              const sentenceTranslation = activeParagraph.sentenceTranslations[sentence.index]?.translation;
              return (
                <button
                  key={sentence.id}
                  type="button"
                  className={`rounded-xl border p-4 text-left transition-colors ${isActive ? "border-accent-teal bg-bg-card shadow-sm" : "border-[var(--border-subtle)] bg-transparent hover:bg-bg-card"}`}
                  onClick={() => {
                    setActiveSentenceId(sentence.id);
                    if (unit) void playSentence(unit);
                  }}
                >
                  <p className="m-0 whitespace-pre-wrap text-xl leading-9 text-text-primary sm:text-2xl" lang={sourceLanguage}>
                    {sentence.text}
                  </p>
                  {sentenceTranslation ? (
                    <p className="m-0 mt-2 text-sm leading-6 text-text-secondary">{sentenceTranslation}</p>
                  ) : null}
                </button>
              );
            })}
          </div>

          {translationPreview ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-card p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-accent-teal">Engine translation</p>
              <p className="m-0 mt-2 text-sm leading-7 text-text-primary">{translationPreview}</p>
            </div>
          ) : null}

          {activeParagraph.meaningHints.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeParagraph.meaningHints.map((hint) => (
                <span key={`${activeParagraph.id}-${hint.term}`} className="rounded-full border border-[var(--border-subtle)] bg-bg-card px-3 py-1 text-xs text-text-secondary">
                  <strong className="text-text-primary">{hint.term}</strong>: {hint.meaning}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="flex min-h-0 flex-col border-t border-[var(--border-subtle)] bg-bg-card lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 sm:px-6">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Type</p>
              <p className="m-0 mt-1 text-sm text-text-secondary">Your paragraph translation</p>
            </div>
            {status ? <span className="text-xs text-accent-teal">{status}</span> : null}
          </div>
          {error ? <p className="mx-4 mt-4 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)] sm:mx-6">{error}</p> : null}
          <textarea
            ref={typingRef}
            className="min-h-[18rem] flex-1 resize-none bg-transparent px-4 py-4 text-lg leading-8 text-text-primary outline-none sm:px-6"
            value={draftTranslation}
            onChange={(event) => {
              setDraftTranslation(event.target.value);
              setStatus(null);
            }}
            onBlur={() => void saveActiveParagraph()}
            placeholder={activeSentenceTranslation || translationPreview || "Type your translation as you read..."}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-4 py-3 sm:px-6">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-bg-page px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void goToParagraph(paragraphIndex - 1)}
              disabled={paragraphIndex === 0 || updateDocument.isPending}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-bg-page px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                const unit = activeQueueIndex === undefined ? firstActiveUnit : sentenceQueue[activeQueueIndex];
                if (unit) void playSentence(unit);
              }}
              disabled={!firstActiveUnit || loadingSentenceId !== null}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Replay
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-orange px-4 py-2 text-sm font-semibold text-text-on-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void goToParagraph(paragraphIndex + 1)}
              disabled={paragraphIndex >= currentDocument.paragraphs.length - 1 || updateDocument.isPending}
            >
              Next
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>
    </section>
  );
}
