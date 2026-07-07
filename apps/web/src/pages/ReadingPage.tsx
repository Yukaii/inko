import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpenText, Download, Languages, Library, Plus, Sparkles } from "lucide-react";
import {
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

function formatExport(document: ReadingDocumentDTO) {
  return document.paragraphs
    .map((paragraph, index) => {
      const translation = paragraph.translation.trim() || paragraph.engineTranslation?.trim() || "[translation pending]";
      return `${index + 1}. ${paragraph.source}\n\n${translation}`;
    })
    .join("\n\n---\n\n");
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
            to="/reader/import"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-orange px-4 py-2 text-sm font-semibold text-text-on-accent transition-opacity hover:opacity-90"
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
            {documentsQuery.data?.length ? documentsQuery.data.map((document) => (
              <button
                key={document.id}
                type="button"
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${documentId === document.id ? "border-accent-orange bg-bg-elevated text-text-primary" : "border-[var(--border-subtle)] bg-bg-page text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}
                onClick={() => navigate(`/reader/${document.id}`)}
              >
                <span className="block truncate text-sm font-medium">{document.title}</span>
                <span className="mt-1 block text-xs">
                  {document.completedCount}/{document.paragraphCount} paragraphs · {LANGUAGE_LABELS[document.sourceLanguage]}
                </span>
              </button>
            )) : (
              <div className="rounded-xl bg-bg-page p-3 text-sm leading-6 text-text-secondary">
                <p className="m-0">No readings saved yet.</p>
                <Link to="/reader/import" className="mt-2 inline-flex text-accent-orange hover:underline">
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
            <div className="flex min-h-[30rem] flex-col items-center justify-center gap-3 p-8 text-center">
              <BookOpenText className="h-10 w-10 text-text-secondary" aria-hidden="true" />
              <h2 className="m-0 text-xl font-semibold text-text-primary">No reading selected.</h2>
              <p className="m-0 max-w-md text-sm leading-6 text-text-secondary">
                Upload a file, paste a passage, or select a saved reading from your library.
              </p>
            </div>
          ) : (
            <ol className="m-0 flex list-none flex-col divide-y divide-[var(--border-subtle)] p-0">
              {currentDocument.paragraphs.map((paragraph, index) => (
                <li key={paragraph.id} className="grid gap-4 p-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <article className="rounded-xl bg-bg-page p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Paragraph {index + 1}</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => translateParagraph.mutate(paragraph)}
                        disabled={translateParagraph.isPending && activeTranslationParagraphId === paragraph.id}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-accent-orange" aria-hidden="true" />
                        {translateParagraph.isPending && activeTranslationParagraphId === paragraph.id ? "Translating..." : "Translate"}
                      </button>
                    </div>
                    <p className="m-0 whitespace-pre-wrap text-base leading-8 text-text-primary" lang={sourceLanguage}>
                      {paragraph.source}
                    </p>

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
          )}
        </div>
      </div>
    </section>
  );
}
