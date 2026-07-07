import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpenText, Check, Download, Languages, Library, Pencil, Plus, RotateCcw, Sparkles, Trash2, Volume2, X } from "lucide-react";
import {
  getDefaultEdgeTtsVoice,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  type ReadingDocumentDTO,
  type ReadingParagraphDTO,
} from "@inko/shared";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { authQueryKey } from "../lib/queryKeys";
import { applyNoIndexMetadata } from "../lib/seo";
import { TRANSLATION_LANGUAGE_OPTIONS } from "../lib/translationLanguages";
import { splitReadingSentences } from "./readingUtils";

const READING_TTS_PREFETCH_WINDOW = 5;

type ReadingSentenceUnit = {
  paragraph: ReadingParagraphDTO;
  sentence: ReadingParagraphDTO["sentences"][number];
  queueIndex: number;
};

function formatExport(document: ReadingDocumentDTO) {
  return document.paragraphs
    .map((paragraph, index) => {
      const translation = paragraph.translation.trim() || paragraph.engineTranslation?.trim() || "[translation pending]";
      return `${index + 1}. ${paragraph.source}\n\n${translation}`;
    })
    .join("\n\n---\n\n");
}

function groupParagraphsByChapter(paragraphs: ReadingParagraphDTO[]) {
  const groups: Array<{ id: string; title: string; index: number; paragraphs: Array<{ paragraph: ReadingParagraphDTO; globalIndex: number }>; completedCount: number }> = [];
  const groupsById = new Map<string, (typeof groups)[number]>();

  paragraphs.forEach((paragraph, globalIndex) => {
    const id = paragraph.chapterId ?? "main";
    let group = groupsById.get(id);
    if (!group) {
      group = {
        id,
        title: paragraph.chapterTitle ?? "Imported text",
        index: paragraph.chapterIndex ?? groups.length,
        paragraphs: [],
        completedCount: 0,
      };
      groupsById.set(id, group);
      groups.push(group);
    }
    group.paragraphs.push({ paragraph, globalIndex });
    if (paragraph.translation.trim().length > 0) {
      group.completedCount += 1;
    }
  });

  return groups.sort((a, b) => a.index - b.index);
}

export function ReadingPage() {
  const { token } = useAuth();
  const { documentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>("ja");
  const [translationLanguage, setTranslationLanguage] = useState("English");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTtsSentenceId, setActiveTtsSentenceId] = useState<string | null>(null);
  const [loadingTtsSentenceId, setLoadingTtsSentenceId] = useState<string | null>(null);
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);
  const [editedSource, setEditedSource] = useState("");
  const [confirmDeleteParagraphId, setConfirmDeleteParagraphId] = useState<string | null>(null);
  const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sentenceAudioCacheRef = useRef(new Map<string, string>());
  const sentenceAudioInFlightRef = useRef(new Map<string, Promise<string>>());

  useEffect(() => {
    applyNoIndexMetadata("Library | Inko", "View imported books and texts, then open a reading workspace for sentence-level translation.");
  }, []);

  const documentsQuery = useQuery({
    queryKey: authQueryKey(token, "reading-documents"),
    queryFn: () => api.listReadingDocuments(token ?? ""),
    enabled: Boolean(token),
  });

  const documentQuery = useQuery({
    queryKey: authQueryKey(token, "reading-document", documentId),
    queryFn: () => api.getReadingDocument(token ?? "", documentId ?? ""),
    enabled: Boolean(token && documentId),
  });

  useEffect(() => {
    const document = documentQuery.data;
    if (!document) return;
    setTitle(document.title);
    setSourceLanguage(document.sourceLanguage);
    setTranslationLanguage(document.translationLanguage);
  }, [documentQuery.data]);

  const updateDocument = useMutation({
    mutationFn: async (input: { documentId: string; patch: Parameters<typeof api.updateReadingDocument>[2] }) =>
      api.updateReadingDocument(token ?? "", input.documentId, input.patch),
    onSuccess: async (document) => {
      queryClient.setQueryData(authQueryKey(token, "reading-document", document.id), document);
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "reading-documents") });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: string) => api.deleteReadingDocument(token ?? "", documentId),
    onSuccess: async (_result, documentId) => {
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "reading-documents") });
      navigate("/reader", { replace: true });
    },
  });

  const translateParagraph = useMutation({
    mutationFn: async (paragraph: ReadingParagraphDTO) =>
      api.translateReadingParagraph(token ?? "", {
        sourceLanguage,
        translationLanguage,
        paragraph: paragraph.source,
      }),
    onSuccess: async (translation, paragraph) => {
      const current = documentQuery.data;
      if (!current) return;
      const paragraphs = current.paragraphs.map((item) =>
        item.id === paragraph.id
          ? {
              ...item,
              engineTranslation: translation.translation,
              sentenceTranslations: translation.sentenceTranslations,
              meaningHints: translation.meaningHints,
            }
          : item,
      );
      await updateDocument.mutateAsync({ documentId: current.id, patch: { paragraphs } });
    },
    onError: (translationError) => {
      setError(translationError instanceof Error ? translationError.message : "Translation failed.");
    },
  });

  const currentDocument = documentQuery.data;
  const completedCount = currentDocument?.completedCount ?? 0;
  const progressPercent = currentDocument && currentDocument.paragraphCount > 0
    ? Math.round((completedCount / currentDocument.paragraphCount) * 100)
    : 0;

  const activeTranslationParagraphId = useMemo(() => {
    return translateParagraph.variables?.id ?? null;
  }, [translateParagraph.variables]);
  const chapterGroups = useMemo(() => groupParagraphsByChapter(currentDocument?.paragraphs ?? []), [currentDocument?.paragraphs]);
  const sentenceQueue = useMemo<ReadingSentenceUnit[]>(() => {
    const units: ReadingSentenceUnit[] = [];
    for (const paragraph of currentDocument?.paragraphs ?? []) {
      const sentences = paragraph.sentences.length > 0
        ? paragraph.sentences
        : [{ id: `${paragraph.id}-s-1`, text: paragraph.source, index: 0 }];
      for (const sentence of sentences) {
        units.push({ paragraph, sentence, queueIndex: units.length });
      }
    }
    return units;
  }, [currentDocument?.paragraphs]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      for (const url of sentenceAudioCacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      sentenceAudioCacheRef.current.clear();
      if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
    };
  }, []);

  async function saveMetadata() {
    if (!currentDocument) return;
    await updateDocument.mutateAsync({
      documentId: currentDocument.id,
      patch: { title, sourceLanguage, translationLanguage },
    });
    setStatus("Reading details saved.");
  }

  function updateParagraphTranslation(paragraphId: string, translation: string) {
    if (!currentDocument) return;
    const paragraphs = currentDocument.paragraphs.map((paragraph) => paragraph.id === paragraphId ? { ...paragraph, translation } : paragraph);
    queryClient.setQueryData(authQueryKey(token, "reading-document", currentDocument.id), {
      ...currentDocument,
      paragraphs,
      completedCount: paragraphs.filter((paragraph) => paragraph.translation.trim().length > 0).length,
      updatedAt: Date.now(),
    });
  }

  async function saveParagraphTranslations() {
    if (!currentDocument) return;
    const cachedDocument = queryClient.getQueryData<ReadingDocumentDTO>(authQueryKey(token, "reading-document", currentDocument.id)) ?? currentDocument;
    await updateDocument.mutateAsync({ documentId: cachedDocument.id, patch: { paragraphs: cachedDocument.paragraphs } });
  }

  function removeParagraph(paragraphId: string) {
    if (!currentDocument) return;
    const paragraphs = currentDocument.paragraphs.filter((p) => p.id !== paragraphId);
    const updatedDocument = {
      ...currentDocument,
      paragraphs,
      paragraphCount: paragraphs.length,
      completedCount: paragraphs.filter((p) => p.translation.trim().length > 0).length,
      updatedAt: Date.now(),
    };
    queryClient.setQueryData(authQueryKey(token, "reading-document", currentDocument.id), updatedDocument);
    updateDocument.mutate({ documentId: currentDocument.id, patch: { paragraphs } });
  }

  function clearAllTranslations() {
    if (!currentDocument) return;
    const paragraphs = currentDocument.paragraphs.map((p) => ({
      ...p,
      translation: "",
      engineTranslation: undefined,
      sentenceTranslations: [],
    }));
    const updatedDocument = {
      ...currentDocument,
      paragraphs,
      completedCount: 0,
      updatedAt: Date.now(),
    };
    queryClient.setQueryData(authQueryKey(token, "reading-document", currentDocument.id), updatedDocument);
    updateDocument.mutate({ documentId: currentDocument.id, patch: { paragraphs } });
  }

  function clearChapterTranslations(chapterId: string) {
    if (!currentDocument) return;
    const paragraphs = currentDocument.paragraphs.map((p) =>
      (p.chapterId ?? "main") === chapterId
        ? { ...p, translation: "", engineTranslation: undefined, sentenceTranslations: [] }
        : p,
    );
    const updatedDocument = {
      ...currentDocument,
      paragraphs,
      completedCount: paragraphs.filter((p) => p.translation.trim().length > 0).length,
      updatedAt: Date.now(),
    };
    queryClient.setQueryData(authQueryKey(token, "reading-document", currentDocument.id), updatedDocument);
    updateDocument.mutate({ documentId: currentDocument.id, patch: { paragraphs } });
  }

  function startEditingSource(paragraph: ReadingParagraphDTO) {
    setEditingParagraphId(paragraph.id);
    setEditedSource(paragraph.source);
  }

  function saveEditedSource() {
    if (!currentDocument || !editingParagraphId) return;
    const newSource = editedSource.trim();
    if (!newSource) return;
    const newSentences = splitReadingSentences(newSource).map((text, index) => ({
      id: `${editingParagraphId}-s-${index + 1}`,
      text,
      index,
    }));
    const paragraphs = currentDocument.paragraphs.map((p) =>
      p.id === editingParagraphId
        ? { ...p, source: newSource, sentences: newSentences, sentenceTranslations: [], engineTranslation: undefined }
        : p,
    );
    const updatedDocument = {
      ...currentDocument,
      paragraphs,
      updatedAt: Date.now(),
    };
    queryClient.setQueryData(authQueryKey(token, "reading-document", currentDocument.id), updatedDocument);
    updateDocument.mutate({ documentId: currentDocument.id, patch: { paragraphs } });
    setEditingParagraphId(null);
    setEditedSource("");
  }

  function cancelEditingSource() {
    setEditingParagraphId(null);
    setEditedSource("");
  }

  function getSentenceTranslation(paragraph: ReadingParagraphDTO, sentenceIndex: number) {
    return paragraph.sentenceTranslations[sentenceIndex]?.translation;
  }

  async function getSentenceAudio(unit: ReadingSentenceUnit) {
    const cached = sentenceAudioCacheRef.current.get(unit.sentence.id);
    if (cached) return cached;

    const pending = sentenceAudioInFlightRef.current.get(unit.sentence.id);
    if (pending) return pending;

    if (!currentDocument) throw new Error("No reading selected.");
    const voice = getDefaultEdgeTtsVoice(currentDocument.sourceLanguage);
    const request = api
      .fetchReadingSentenceTts(token ?? "", currentDocument.id, unit.paragraph.id, unit.sentence.id, voice, "default")
      .then((audio) => {
        const url = URL.createObjectURL(audio);
        sentenceAudioCacheRef.current.set(unit.sentence.id, url);
        return url;
      })
      .finally(() => {
        sentenceAudioInFlightRef.current.delete(unit.sentence.id);
      });
    sentenceAudioInFlightRef.current.set(unit.sentence.id, request);
    return request;
  }

  function prefetchSentenceAudioFrom(queueIndex: number) {
    const upcoming = sentenceQueue.slice(queueIndex, queueIndex + READING_TTS_PREFETCH_WINDOW);
    for (const unit of upcoming) {
      void getSentenceAudio(unit).catch(() => undefined);
    }
  }

  async function playSentence(unit: ReadingSentenceUnit) {
    try {
      setError(null);
      setLoadingTtsSentenceId(unit.sentence.id);
      const url = await getSentenceAudio(unit);
      setLoadingTtsSentenceId(null);
      setActiveTtsSentenceId(unit.sentence.id);
      prefetchSentenceAudioFrom(unit.queueIndex + 1);

      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        const nextUnit = sentenceQueue[unit.queueIndex + 1];
        if (nextUnit) {
          void playSentence(nextUnit);
        } else {
          setActiveTtsSentenceId(null);
        }
      };
      await audio.play();
    } catch (ttsError) {
      setLoadingTtsSentenceId(null);
      setActiveTtsSentenceId(null);
      setError(ttsError instanceof Error ? ttsError.message : "Could not play audio.");
    }
  }

  function playParagraphSentences(paragraph: ReadingParagraphDTO) {
    const firstUnit = sentenceQueue.find((unit) => unit.paragraph.id === paragraph.id);
    if (firstUnit) void playSentence(firstUnit);
  }

  function exportTranslations() {
    if (!currentDocument) return;
    const blob = new Blob([formatExport(currentDocument)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${currentDocument.title.trim() || "inko-reading-translations"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-bg-page px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent-teal">
            <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
            Reading workspace
          </div>
          <h1 className="m-0 text-3xl font-semibold text-text-primary">Manage books and translate as you read.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Browse imported readings, generate sentence-level translation, then type your own paragraph translation with meaning hints nearby.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={currentDocument ? `/reader/${currentDocument.id}/practice` : "/reader"}
            className={`inline-flex items-center gap-2 rounded-xl bg-accent-orange px-4 py-2 text-sm font-semibold text-text-on-accent transition-opacity hover:opacity-90 ${!currentDocument ? "pointer-events-none opacity-60" : ""}`}
            aria-disabled={!currentDocument}
          >
            <BookOpenText className="h-4 w-4" aria-hidden="true" />
            {currentDocument ? "Start reading" : "Select a book"}
          </Link>
          <Link
            to="/reader/import"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-bg-page px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Import text
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-bg-page px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
            onClick={exportTranslations}
            disabled={!currentDocument}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-bg-page px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
            onClick={clearAllTranslations}
            disabled={!currentDocument}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Clear all translations
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => currentDocument && deleteDocument.mutate(currentDocument.id)}
            disabled={!currentDocument || deleteDocument.isPending}
          >
            Delete
          </button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-3">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Library className="h-4 w-4 text-accent-teal" aria-hidden="true" />
              Library
            </div>
            <Link to="/reader/import" className="text-xs font-medium text-accent-orange hover:underline">
              Import
            </Link>
          </div>
          <div className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto">
            {documentsQuery.data?.length ? documentsQuery.data.map((document) => {
              const docProgress = document.paragraphCount > 0
                ? Math.round((document.completedCount / document.paragraphCount) * 100)
                : 0;
              const isSelected = documentId === document.id;
              return (
                <button
                  key={document.id}
                  type="button"
                  className={`group flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-accent-orange bg-bg-elevated shadow-[0_8px_24px_-12px_var(--accent-orange)]"
                      : "border-[var(--border-subtle)] bg-bg-page hover:border-[var(--border-strong)]"
                  }`}
                  onClick={() => navigate(`/reader/${document.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`block truncate text-sm font-semibold ${isSelected ? "text-text-primary" : "text-text-primary group-hover:text-text-primary"}`}>
                        {document.title}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-text-secondary">
                      {LANGUAGE_LABELS[document.sourceLanguage]}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border-subtle)]">
                      <div
                        className={`h-full rounded-full transition-all ${isSelected ? "bg-accent-teal" : "bg-accent-teal/60 group-hover:bg-accent-teal"}`}
                        style={{ width: `${docProgress}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-text-secondary">
                      {document.completedCount}/{document.paragraphCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-accent-orange text-text-on-accent"
                          : "bg-bg-elevated text-text-secondary group-hover:text-text-primary group-hover:bg-bg-card"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/reader/${document.id}/practice`);
                      }}
                    >
                      <BookOpenText className="h-3 w-3" aria-hidden="true" />
                      Practice
                    </span>
                  </div>
                </button>
              );
            }) : (
              <div className="flex flex-col items-center gap-3 rounded-xl bg-bg-page p-5 text-center">
                <BookOpenText className="h-8 w-8 text-text-secondary" aria-hidden="true" />
                <p className="m-0 text-sm leading-6 text-text-secondary">No readings saved yet.</p>
                <Link
                  to="/reader/import"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-orange px-4 py-2 text-xs font-semibold text-text-on-accent transition-opacity hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Import your first text
                </Link>
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-bg-card">
          <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[var(--border-subtle)] bg-bg-card/95 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-text-primary">
                <Languages className="h-4 w-4 text-accent-teal" aria-hidden="true" />
                {LANGUAGE_LABELS[sourceLanguage]} to {translationLanguage || "translation"}
              </div>
              {currentDocument ? (
                <div className="grid gap-2 lg:grid-cols-[minmax(10rem,1fr)_12rem_12rem_auto]">
                  <input
                    className="rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-orange"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    aria-label="Reading title"
                  />
                  <select
                    className="rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-orange"
                    value={sourceLanguage}
                    onChange={(event) => setSourceLanguage(event.target.value as LanguageCode)}
                    aria-label="Source language"
                  >
                    {SUPPORTED_LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {LANGUAGE_LABELS[language]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-orange"
                    value={translationLanguage}
                    onChange={(event) => setTranslationLanguage(event.target.value)}
                    aria-label="Translation language"
                  >
                    {TRANSLATION_LANGUAGE_OPTIONS.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void saveMetadata()}
                    disabled={updateDocument.isPending}
                  >
                    Save
                  </button>
                </div>
              ) : null}
              <p className="m-0 mt-1 text-xs text-text-secondary">
                {completedCount}/{currentDocument?.paragraphCount ?? 0} paragraphs translated
              </p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-page md:w-52">
              <div className="h-full rounded-full bg-accent-teal transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {status ? <p className="mx-4 mt-4 rounded-xl border border-[color:color-mix(in_oklab,var(--accent-teal)_35%,var(--border-subtle))] bg-bg-page px-3 py-2 text-sm text-accent-teal">{status}</p> : null}
          {error ? <p className="mx-4 mt-4 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">{error}</p> : null}

          {!currentDocument ? (
            <div className="flex min-h-[30rem] flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="rounded-2xl bg-bg-page p-4">
                <BookOpenText className="h-10 w-10 text-text-secondary" aria-hidden="true" />
              </div>
              <div>
                <h2 className="m-0 text-xl font-semibold text-text-primary">No reading selected.</h2>
                <p className="m-0 mt-2 max-w-md text-sm leading-6 text-text-secondary">
                  Pick a book from your library or import a new one to get started.
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/reader/import"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-orange px-4 py-2 text-sm font-semibold text-text-on-accent transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Import a text
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
              {chapterGroups.map((chapter) => (
                <section key={chapter.id} className="flex flex-col">
                  <header className="border-b border-[var(--border-subtle)] bg-bg-page/60 px-4 py-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="m-0 text-lg font-semibold text-text-primary">{chapter.title}</h2>
                        <p className="m-0 mt-1 text-xs text-text-secondary">
                          {chapter.completedCount}/{chapter.paragraphs.length} paragraphs translated
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {chapter.completedCount > 0 ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                            onClick={() => clearChapterTranslations(chapter.id)}
                          >
                            <RotateCcw className="h-3 w-3" aria-hidden="true" />
                            Clear chapter
                          </button>
                        ) : null}
                        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-card md:w-48">
                          <div
                            className="h-full rounded-full bg-accent-teal transition-all"
                            style={{ width: `${chapter.paragraphs.length ? Math.round((chapter.completedCount / chapter.paragraphs.length) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </header>
                  <ol className="m-0 flex list-none flex-col divide-y divide-[var(--border-subtle)] p-0">
                    {chapter.paragraphs.map(({ paragraph, globalIndex }) => (
                      <li key={paragraph.id} className="grid gap-4 p-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <article className="rounded-xl bg-bg-page p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Paragraph {globalIndex + 1}</span>
                      <div className="flex flex-wrap gap-2">
                        {editingParagraphId === paragraph.id ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-accent-teal bg-accent-teal/10 px-2.5 py-1.5 text-xs font-medium text-accent-teal transition-colors hover:bg-accent-teal/20"
                              onClick={saveEditedSource}
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              Save
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated"
                              onClick={cancelEditingSource}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
                              onClick={() => startEditingSource(paragraph)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => playParagraphSentences(paragraph)}
                              disabled={paragraph.sentences.length === 0 || loadingTtsSentenceId?.startsWith(`${paragraph.id}-s-`)}
                            >
                              <Volume2 className="h-3.5 w-3.5 text-accent-teal" aria-hidden="true" />
                              {loadingTtsSentenceId?.startsWith(`${paragraph.id}-s-`) ? "Loading..." : "Listen sentences"}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => translateParagraph.mutate(paragraph)}
                              disabled={translateParagraph.isPending && activeTranslationParagraphId === paragraph.id}
                            >
                              <Sparkles className="h-3.5 w-3.5 text-accent-orange" aria-hidden="true" />
                              {translateParagraph.isPending && activeTranslationParagraphId === paragraph.id ? "Translating..." : "Translate"}
                            </button>
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                confirmDeleteParagraphId === paragraph.id
                                  ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
                                  : "border-[var(--border-subtle)] bg-bg-card text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                              }`}
                              onClick={() => {
                                if (confirmDeleteParagraphId === paragraph.id) {
                                  removeParagraph(paragraph.id);
                                  setConfirmDeleteParagraphId(null);
                                  if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
                                } else {
                                  setConfirmDeleteParagraphId(paragraph.id);
                                  if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
                                  confirmDeleteTimerRef.current = setTimeout(() => setConfirmDeleteParagraphId(null), 3000);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              {confirmDeleteParagraphId === paragraph.id ? "Confirm delete" : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingParagraphId === paragraph.id ? (
                      <textarea
                        className="min-h-32 w-full resize-y rounded-xl border border-accent-teal bg-bg-card px-3 py-2 text-base leading-7 text-text-primary outline-none"
                        value={editedSource}
                        onChange={(event) => setEditedSource(event.target.value)}
                        lang={sourceLanguage}
                        aria-label="Edit paragraph source"
                      />
                    ) : (
                      <div className="flex flex-col gap-2" lang={sourceLanguage}>
                        {(paragraph.sentences.length > 0 ? paragraph.sentences : [{ id: `${paragraph.id}-s-1`, text: paragraph.source, index: 0 }]).map((sentence) => {
                          const unit = sentenceQueue.find((item) => item.sentence.id === sentence.id);
                          const sentenceTranslation = getSentenceTranslation(paragraph, sentence.index);
                          const isActiveSentence = activeTtsSentenceId === sentence.id;
                          const isLoadingSentence = loadingTtsSentenceId === sentence.id;
                          return (
                            <div
                              key={sentence.id}
                              className={`rounded-lg border px-3 py-2 transition-colors ${isActiveSentence ? "border-accent-teal bg-bg-card" : "border-[var(--border-subtle)] bg-transparent"}`}
                            >
                              <div className="flex items-start gap-2">
                                <button
                                  type="button"
                                  className="mt-1 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[var(--border-subtle)] bg-bg-card text-text-primary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
                                  onClick={() => unit && void playSentence(unit)}
                                  disabled={!unit || isLoadingSentence}
                                  aria-label={`Listen to sentence ${sentence.index + 1}`}
                                >
                                  <Volume2 className="h-3.5 w-3.5 text-accent-teal" aria-hidden="true" />
                                </button>
                                <div className="min-w-0">
                                  <p className="m-0 whitespace-pre-wrap text-base leading-7 text-text-primary">{sentence.text}</p>
                                  {sentenceTranslation ? (
                                    <p className="m-0 mt-1 text-sm leading-6 text-text-secondary">{sentenceTranslation}</p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {paragraph.sentenceTranslations.length > 0 || paragraph.engineTranslation ? (
                      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-bg-card p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent-teal">Engine translation</div>
                        {paragraph.sentenceTranslations.length > 0 ? (
                          <div className="flex flex-col gap-3">
                            {paragraph.sentenceTranslations.map((sentence, sentenceIndex) => (
                              <div key={`${paragraph.id}-sentence-${sentenceIndex}`} className="text-sm leading-6">
                                <p className="m-0 text-text-secondary">{sentence.source}</p>
                                <p className="m-0 text-text-primary">{sentence.translation}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="m-0 text-sm leading-6 text-text-primary">{paragraph.engineTranslation}</p>
                        )}
                      </div>
                    ) : null}
                  </article>

                  <div className="flex min-h-56 flex-col gap-3">
                    <label className="flex min-h-44 flex-1 flex-col rounded-xl border border-[var(--border-subtle)] bg-bg-page focus-within:border-accent-orange" htmlFor={`translation-${paragraph.id}`}>
                      <span className="border-b border-[var(--border-subtle)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                        Your translation
                      </span>
                      <textarea
                        id={`translation-${paragraph.id}`}
                        className="min-h-40 flex-1 resize-y rounded-b-xl bg-transparent px-4 py-3 text-base leading-7 text-text-primary outline-none"
                        value={paragraph.translation}
                        onChange={(event) => updateParagraphTranslation(paragraph.id, event.target.value)}
                        onBlur={() => void saveParagraphTranslations()}
                        placeholder={paragraph.engineTranslation || "Type as you read..."}
                      />
                    </label>

                    {paragraph.meaningHints.length > 0 ? (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-page p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Meaning hints</div>
                        <div className="flex flex-wrap gap-2">
                          {paragraph.meaningHints.map((hint) => (
                            <span key={`${paragraph.id}-${hint.term}`} className="rounded-full border border-[var(--border-subtle)] bg-bg-card px-3 py-1 text-xs text-text-secondary">
                              <strong className="text-text-primary">{hint.term}</strong>: {hint.meaning}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
