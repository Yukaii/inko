import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpenText, Check, FileText, Upload } from "lucide-react";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type LanguageCode, type ReadingParagraphDTO } from "@inko/shared";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { authQueryKey } from "../lib/queryKeys";
import { applyNoIndexMetadata } from "../lib/seo";
import { TRANSLATION_LANGUAGE_OPTIONS } from "../lib/translationLanguages";
import { extractReadingFileFromFile, splitReadingParagraphs, type ReadingFileMetadata, type ReadingParagraph } from "./readingUtils";

type ImportStep = "source" | "details" | "review";
type SourceKind = "txt" | "epub" | "paste";

function toDocumentParagraphs(paragraphs: ReadingParagraph[]): Pick<ReadingParagraphDTO, "id" | "source" | "sentences" | "chapterId" | "chapterTitle" | "chapterIndex">[] {
  return paragraphs.map((paragraph) => ({
    id: paragraph.id,
    source: paragraph.source,
    sentences: paragraph.sentences,
    chapterId: paragraph.chapterId,
    chapterTitle: paragraph.chapterTitle,
    chapterIndex: paragraph.chapterIndex,
  }));
}

function detectSourceKind(file: File): SourceKind {
  if (/\.epub$/i.test(file.name) || file.type === "application/epub+zip") return "epub";
  return "txt";
}

export function ReadingImportPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>("source");
  const [title, setTitle] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>("ja");
  const [translationLanguage, setTranslationLanguage] = useState("English");
  const [sourceKind, setSourceKind] = useState<SourceKind>("paste");
  const [sourceName, setSourceName] = useState<string | undefined>();
  const [pastedText, setPastedText] = useState("");
  const [paragraphs, setParagraphs] = useState<ReadingParagraph[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    applyNoIndexMetadata("Import Reading | Inko", "Import TXT, EPUB, or pasted text into your reading library.");
  }, []);

  const createDocument = useMutation({
    mutationFn: async () =>
      api.createReadingDocument(token ?? "", {
        title: title.trim() || "Imported reading",
        sourceLanguage,
        translationLanguage,
        sourceKind,
        sourceName,
        paragraphs: toDocumentParagraphs(paragraphs),
      }),
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "reading-documents") });
      navigate(`/reader/${document.id}`);
    },
    onError: (saveError) => {
      setError(saveError instanceof Error ? saveError.message : "Could not save this reading.");
    },
  });

  const previewParagraphs = useMemo(() => paragraphs.slice(0, 3), [paragraphs]);

  function loadParagraphs(nextParagraphs: ReadingParagraph[], input: { kind: SourceKind; name?: string; fallbackTitle: string; metadata?: ReadingFileMetadata }) {
    if (nextParagraphs.length === 0) {
      setError("No readable paragraphs were found.");
      return;
    }
    setParagraphs(nextParagraphs);
    setSourceKind(input.kind);
    setSourceName(input.name);
    setTitle((current) => current || input.metadata?.title || input.fallbackTitle);
    if (input.metadata?.language) {
      setSourceLanguage(input.metadata.language);
    }
    setError(null);
    setStep("details");
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setIsParsing(true);
    setError(null);
    try {
      const extracted = await extractReadingFileFromFile(file);
      loadParagraphs(extracted.paragraphs, {
        kind: detectSourceKind(file),
        name: file.name,
        fallbackTitle: file.name.replace(/\.[^.]+$/, "") || "Imported reading",
        metadata: extracted.metadata,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not read this file.");
    } finally {
      setIsParsing(false);
      setIsDragging(false);
    }
  }

  function handlePasteLoad() {
    loadParagraphs(splitReadingParagraphs(pastedText), {
      kind: "paste",
      fallbackTitle: "Pasted reading",
    });
  }

  const steps: Array<{ key: ImportStep; label: string }> = [
    { key: "source", label: "Source" },
    { key: "details", label: "Details" },
    { key: "review", label: "Review" },
  ];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-5">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-bg-page px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent-teal">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          Reading import
        </div>
        <h1 className="m-0 text-3xl font-semibold text-text-primary">Import a book or text.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Add a TXT, EPUB, or pasted passage to your library before opening it in the paragraph translation workspace.
        </p>
      </header>

      <nav className="grid gap-2 md:grid-cols-3" aria-label="Import steps">
        {steps.map((item, index) => {
          const isActive = item.key === step;
          const isComplete = steps.findIndex((candidate) => candidate.key === step) > index;
          return (
            <button
              key={item.key}
              type="button"
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left ${isActive ? "border-accent-orange bg-bg-elevated text-text-primary" : "border-[var(--border-subtle)] bg-bg-card text-text-secondary"}`}
              onClick={() => {
                if (item.key === "source" || paragraphs.length > 0) setStep(item.key);
              }}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${isComplete ? "bg-accent-teal text-text-on-accent" : "bg-bg-page"}`}>
                {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {error ? <p className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">{error}</p> : null}

      {step === "source" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <label
            className={`flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center transition-colors ${isDragging ? "border-accent-orange bg-bg-elevated" : "border-[var(--border-subtle)] bg-bg-card hover:bg-bg-elevated"}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files[0]);
            }}
          >
            <BookOpenText className="h-10 w-10 text-accent-orange" aria-hidden="true" />
            <span className="text-base font-semibold text-text-primary">{isParsing ? "Parsing file..." : "Upload TXT or EPUB"}</span>
            <span className="max-w-sm text-sm leading-6 text-text-secondary">The browser extracts paragraphs locally, then the cleaned text is saved to your library.</span>
            <input
              type="file"
              className="sr-only"
              accept=".txt,.text,.md,.epub,text/plain,text/markdown,application/epub+zip"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary" htmlFor="reader-paste">
              <FileText className="h-4 w-4 text-accent-teal" aria-hidden="true" />
              Paste shorter text
            </label>
            <textarea
              id="reader-paste"
              className="min-h-52 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm leading-6 text-text-primary outline-none focus:border-accent-orange"
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              placeholder="Paste paragraphs here..."
            />
            <button
              type="button"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-orange px-4 py-2.5 text-sm font-semibold text-text-on-accent transition-opacity hover:opacity-90"
              onClick={handlePasteLoad}
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {step === "details" ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="reader-title">
              Title
              <input
                id="reader-title"
                className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-orange"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="My reading"
              />
            </label>

            <label className="text-sm font-medium text-text-primary" htmlFor="translation-language">
              Translation language
              <select
                id="translation-language"
                className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-orange"
                value={translationLanguage}
                onChange={(event) => setTranslationLanguage(event.target.value)}
              >
                {TRANSLATION_LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-text-primary" htmlFor="source-language">
              Source language
              <select
                id="source-language"
                className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-orange"
                value={sourceLanguage}
                onChange={(event) => setSourceLanguage(event.target.value as LanguageCode)}
              >
                {SUPPORTED_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {LANGUAGE_LABELS[language]}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl bg-bg-page px-3 py-2 text-sm text-text-secondary">
              <span className="block font-medium text-text-primary">Detected content</span>
              <span>{paragraphs.length} paragraphs · {sourceKind.toUpperCase()}{sourceName ? ` · ${sourceName}` : ""}</span>
            </div>
          </div>

          <button
            type="button"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent-orange px-4 py-2.5 text-sm font-semibold text-text-on-accent transition-opacity hover:opacity-90"
            onClick={() => setStep("review")}
          >
            Review import
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="m-0 text-xl font-semibold text-text-primary">{title || "Imported reading"}</h2>
              <p className="m-0 mt-1 text-sm text-text-secondary">
                {paragraphs.length} paragraphs · {LANGUAGE_LABELS[sourceLanguage]} to {translationLanguage}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-orange px-4 py-2.5 text-sm font-semibold text-text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => createDocument.mutate()}
              disabled={createDocument.isPending || paragraphs.length === 0}
            >
              {createDocument.isPending ? "Saving..." : "Save to library"}
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {previewParagraphs.map((paragraph, index) => (
              <article key={paragraph.id} className="rounded-xl bg-bg-page p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Paragraph {index + 1}</div>
                <p className="m-0 whitespace-pre-wrap text-sm leading-7 text-text-primary">{paragraph.source}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
