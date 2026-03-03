import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, FileArchive, FileSpreadsheet, Layers, Send, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CreateCommunityDeckSubmissionInput, CreateDeckInput, CreateWordInput, LanguageCode } from "@inko/shared";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from "@inko/shared";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { applyNoIndexMetadata } from "../lib/seo";
import { authQueryKey } from "../lib/queryKeys";
import {
  IMPORTABLE_FIELDS,
  buildWordsFromMapping,
  extractPrimaryAnkiSoundReference,
  inferFieldMapping,
  parseAnkiPackage,
  parseDelimitedImport,
  type AnkiPackageDataset,
  type ImportDataset,
  type ImportableField,
} from "./ankiImportUtils";

type SourceMode = "community" | "upload" | "paste";

type SubmissionForm = {
  title: string;
  summary: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  tags: string;
};

function chunkWords<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function MappingSelect({
  value,
  onChange,
  fieldLabels,
}: {
  value: ImportableField;
  onChange: (next: ImportableField) => void;
  fieldLabels: Record<ImportableField, string>;
}) {
  return (
    <select
      className="rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none"
      value={value}
      onChange={(event) => onChange(event.target.value as ImportableField)}
    >
      {IMPORTABLE_FIELDS.map((field) => (
        <option key={field} value={field}>
          {fieldLabels[field]}
        </option>
      ))}
    </select>
  );
}

export function AnkiImportPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const presetCommunitySlug = searchParams.get("community") ?? undefined;

  const [sourceMode, setSourceMode] = useState<SourceMode>(presetCommunitySlug ? "community" : "upload");
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [newDeck, setNewDeck] = useState<CreateDeckInput>({ name: "", language: "ja" });
  const [communitySlug, setCommunitySlug] = useState(presetCommunitySlug ?? "");
  const [pastedText, setPastedText] = useState("");
  const [dataset, setDataset] = useState<ImportDataset | null>(null);
  const [packageData, setPackageData] = useState<AnkiPackageDataset | null>(null);
  const [noteTypeId, setNoteTypeId] = useState("");
  const [mapping, setMapping] = useState<ImportableField[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [submissionForm, setSubmissionForm] = useState<SubmissionForm>({
    title: "",
    summary: "",
    description: "",
    difficulty: "Beginner",
    tags: "",
  });
  const fieldLabels: Record<ImportableField, string> = {
    target: t("importer.fields.target"),
    reading: t("importer.fields.reading"),
    meaning: t("importer.fields.meaning"),
    romanization: t("importer.fields.romanization"),
    example: t("importer.fields.example"),
    audioUrl: t("importer.fields.audio_url"),
    tags: t("importer.fields.tags"),
    skip: t("importer.fields.skip"),
  };

  const decksQuery = useQuery({
    queryKey: authQueryKey(token, "decks"),
    queryFn: () => api.listDecks(token ?? ""),
  });

  const communityDecksQuery = useQuery({
    queryKey: ["community-decks-importer"],
    queryFn: () => api.listCommunityDecks(),
  });

  const selectedCommunityDeckQuery = useQuery({
    queryKey: ["community-deck-importer", communitySlug],
    queryFn: () => api.getCommunityDeck(communitySlug),
    enabled: sourceMode === "community" && Boolean(communitySlug),
  });

  const mySubmissionsQuery = useQuery({
    queryKey: authQueryKey(token, "community-submissions", "mine"),
    queryFn: () => api.listMyCommunitySubmissions(token ?? ""),
    enabled: Boolean(token),
  });

  const createDeck = useMutation({
    mutationFn: () => api.createDeck(token ?? "", newDeck),
    onSuccess: async (deck) => {
      setSelectedDeckId(deck.id);
      setShowCreateDeck(false);
      setNewDeck({ name: "", language: deck.language });
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "decks") });
    },
  });

  async function resolveImportedAudioUrls(words: CreateWordInput[]) {
    const mediaFiles = packageData?.mediaFiles;
    if (!mediaFiles?.size) {
      return words.map((word) => {
        const soundReference = extractPrimaryAnkiSoundReference(word.audioUrl);
        return soundReference ? { ...word, audioUrl: undefined } : word;
      });
    }

    const uploadEntries = new Map<string, { filename: string; contentType: string; blob: Blob }>();
    for (const word of words) {
      const soundReference = extractPrimaryAnkiSoundReference(word.audioUrl);
      if (!soundReference) continue;
      const media = mediaFiles.get(soundReference);
      if (media) uploadEntries.set(soundReference, media);
    }

    if (uploadEntries.size === 0) {
      return words.map((word) => {
        const soundReference = extractPrimaryAnkiSoundReference(word.audioUrl);
        return soundReference ? { ...word, audioUrl: undefined } : word;
      });
    }

    setStatus(t("importer.status.uploading_audio", { count: uploadEntries.size }));
    const uploadedByReference = new Map<string, string>();
    for (const uploadBatch of chunkWords(Array.from(uploadEntries.entries()), 4)) {
      const batchResults = await Promise.all(
        uploadBatch.map(async ([soundReference, media]) => {
          const uploaded = await api.uploadImportedAudio(token ?? "", media.blob, media.filename);
          return [soundReference, uploaded.audioUrl] as const;
        }),
      );
      for (const [soundReference, audioUrl] of batchResults) {
        uploadedByReference.set(soundReference, audioUrl);
      }
    }

    return words.map((word) => {
      const soundReference = extractPrimaryAnkiSoundReference(word.audioUrl);
      if (!soundReference) return word;
      return {
        ...word,
        audioUrl: uploadedByReference.get(soundReference),
      };
    });
  }

  const importWords = useMutation({
    mutationFn: async () => {
      if (!selectedDeckId || !dataset) throw new Error(t("importer.errors.choose_destination_deck"));
      const words = await resolveImportedAudioUrls(buildWordsFromMapping(dataset, mapping));
      if (words.length === 0) throw new Error(t("importer.errors.map_target_meaning"));

      let imported = 0;
      for (const batch of chunkWords(words, 500)) {
        const result = await api.createWordsBatch(token ?? "", selectedDeckId, { words: batch });
        imported += result.created;
      }
      return imported;
    },
    onMutate: () => {
      setError(null);
      setStatus(t("importer.status.importing_notes"));
    },
    onSuccess: async (imported) => {
      setStatus(t("importer.status.imported_cards", { count: imported }));
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "words-page", selectedDeckId) });
    },
    onError: (mutationError) => {
      setStatus(null);
      setError(mutationError instanceof Error ? mutationError.message : t("importer.errors.import_failed"));
    },
  });

  const submitDeck = useMutation({
    mutationFn: async () => {
      if (!dataset) throw new Error(t("importer.errors.load_before_submit"));
      const words = (await resolveImportedAudioUrls(buildWordsFromMapping(dataset, mapping))).slice(0, 5000);
      if (words.length === 0) throw new Error(t("importer.errors.map_before_submit"));

      const sourceKind: CreateCommunityDeckSubmissionInput["sourceKind"] =
        sourceMode === "upload"
          ? (/\.(apkg)$/i.test(dataset.sourceName) ? "apkg" : /\.(colpkg)$/i.test(dataset.sourceName) ? "colpkg" : /\.(tsv)$/i.test(dataset.sourceName) ? "tsv" : "csv")
          : sourceMode === "community"
            ? "community_clone"
            : "manual";

      return await api.submitCommunityDeck(token ?? "", {
        title: submissionForm.title.trim(),
        summary: submissionForm.summary.trim(),
        description: submissionForm.description.trim(),
        language:
          selectedDeckId
            ? (decksQuery.data ?? []).find((deck) => deck.id === selectedDeckId)?.language ??
              selectedCommunityDeck?.language ??
              "ja"
            : selectedCommunityDeck?.language ?? "ja",
        difficulty: submissionForm.difficulty,
        sourceKind,
        sourceName: dataset.sourceName,
        tags: submissionForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        noteTypes:
          packageData?.noteTypes.map((noteType) => ({
            name: noteType.name,
            fields: noteType.headers,
          })) ??
          [
            {
              name: "Mapped import",
              fields: dataset.headers,
            },
          ],
        words,
      });
    },
    onMutate: () => {
      setError(null);
      setStatus(t("importer.status.submitting_moderation"));
    },
    onSuccess: async (submission) => {
      setStatus(t("importer.status.submitted_for_moderation", { title: submission.title }));
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "community-submissions", "mine") });
    },
    onError: (mutationError) => {
      setStatus(null);
      setError(mutationError instanceof Error ? mutationError.message : t("importer.errors.submission_failed"));
    },
  });

  const selectedCommunityDeck = selectedCommunityDeckQuery.data;
  const activeNoteType = useMemo(
    () => packageData?.noteTypes.find((noteType) => noteType.id === noteTypeId) ?? packageData?.noteTypes[0],
    [noteTypeId, packageData],
  );
  const previewRows = dataset?.rows.slice(0, 6) ?? [];
  const importedWordsCount = dataset ? buildWordsFromMapping(dataset, mapping).length : 0;
  const currentDeckLanguage =
    (decksQuery.data ?? []).find((deck) => deck.id === selectedDeckId)?.language ?? selectedCommunityDeck?.language ?? "ja";
  const hasDestinationDeck = Boolean(selectedDeckId);
  const hasMappedTarget = mapping.includes("target");
  const hasMappedMeaning = mapping.includes("meaning");
  const isMappingValid = hasMappedTarget && hasMappedMeaning && importedWordsCount > 0;
  const canImport = hasDestinationDeck && Boolean(dataset) && isMappingValid && !importWords.isPending;
  const canSubmitCommunity =
    Boolean(dataset) &&
    isMappingValid &&
    Boolean(submissionForm.title.trim()) &&
    Boolean(submissionForm.summary.trim()) &&
    Boolean(submissionForm.description.trim()) &&
    !submitDeck.isPending;
  const nextStepMessage = !dataset
    ? t("importer.next_step.start_loading")
    : !hasDestinationDeck
      ? t("importer.next_step.choose_destination")
      : !hasMappedTarget || !hasMappedMeaning
        ? t("importer.next_step.map_target_meaning")
        : importedWordsCount === 0
          ? t("importer.next_step.no_cards")
          : t("importer.next_step.ready");

  useEffect(() => {
    applyNoIndexMetadata(t("importer.seo_title"));
  }, [t]);

  useEffect(() => {
    if (!presetCommunitySlug) return;
    setCommunitySlug(presetCommunitySlug);
    setSourceMode("community");
  }, [presetCommunitySlug]);

  useEffect(() => {
    if (communitySlug || !communityDecksQuery.data?.length) return;
    setCommunitySlug(communityDecksQuery.data[0].slug);
  }, [communityDecksQuery.data, communitySlug]);

  useEffect(() => {
    if (!selectedCommunityDeck || sourceMode !== "community") return;
    const nextDataset: ImportDataset = {
      sourceName: selectedCommunityDeck.title,
      headers: ["target", "reading", "meaning", "romanization", "example", "tags"],
      rows: selectedCommunityDeck.words.map((word) => [
        word.target,
        word.reading ?? "",
        word.meaning,
        word.romanization ?? "",
        word.example ?? "",
        word.tags.join(", "),
      ]),
    };
    setDataset(nextDataset);
    setPackageData(null);
    setMapping(inferFieldMapping(nextDataset.headers));
  }, [selectedCommunityDeck, sourceMode]);

  useEffect(() => {
    if (!dataset) return;
    setSubmissionForm((current) => ({
      ...current,
      title: current.title || dataset.sourceName.replace(/\.(apkg|colpkg|csv|tsv|txt)$/i, ""),
      summary: current.summary || t("importer.submission.default_summary", { count: dataset.rows.length }),
      description:
        current.description ||
        t("importer.submission.default_description", {
          sourceName: dataset.sourceName,
          count: buildWordsFromMapping(dataset, mapping).length,
        }),
      tags: current.tags || [currentDeckLanguage, sourceMode].filter(Boolean).join(", "),
    }));
  }, [currentDeckLanguage, dataset, mapping, sourceMode, t]);

  useEffect(() => {
    if (!activeNoteType) return;
    setDataset({
      sourceName: `${packageData?.sourceName ?? "Anki package"} / ${activeNoteType.name}`,
      headers: activeNoteType.headers,
      rows: activeNoteType.rows,
    });
    setMapping(inferFieldMapping(activeNoteType.headers));
  }, [activeNoteType, packageData]);

  async function handleFileUpload(file: File) {
    setError(null);
    setStatus(t("importer.status.reading_file"));

    try {
      if (/\.(apkg|colpkg)$/i.test(file.name)) {
        const nextPackage = await parseAnkiPackage(file);
        setPackageData(nextPackage);
        setNoteTypeId(nextPackage.noteTypes[0]?.id ?? "");
        setNewDeck((current) => ({
          ...current,
          name: current.name || nextPackage.suggestedDeckName,
        }));
        setStatus(t("importer.status.loaded_note_types", { count: nextPackage.noteTypes.length, fileName: file.name }));
        return;
      }

      const text = await file.text();
      const nextDataset = parseDelimitedImport(file.name, text);
      if (!nextDataset) {
        throw new Error(t("importer.errors.invalid_file"));
      }
      setPackageData(null);
      setDataset(nextDataset);
      setMapping(inferFieldMapping(nextDataset.headers));
      setStatus(t("importer.status.loaded_rows", { count: nextDataset.rows.length, fileName: file.name }));
    } catch (uploadError) {
      setStatus(null);
      setError(uploadError instanceof Error ? uploadError.message : t("importer.errors.read_failed"));
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  }

  function handleParsePaste() {
    const nextDataset = parseDelimitedImport("Pasted notes", pastedText);
    if (!nextDataset) {
      setError(t("importer.errors.invalid_paste"));
      return;
    }
    setPackageData(null);
    setDataset(nextDataset);
    setMapping(inferFieldMapping(nextDataset.headers));
    setStatus(t("importer.status.parsed_rows", { count: nextDataset.rows.length }));
    setError(null);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 md:p-10">
      <header className="grid gap-5 rounded-[28px] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(0,212,170,0.18),transparent_34%),linear-gradient(135deg,var(--bg-card),var(--bg-page))] p-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-accent-teal">{t("importer.badge")}</p>
          <h1 className="m-0 text-4xl font-bold [font-family:var(--font-display)] md:text-5xl">{t("importer.title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary md:text-base">
            {t("importer.subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link to="/community" className="rounded-2xl border border-[var(--border-subtle)] px-4 py-3 text-sm font-medium text-text-primary no-underline">
            {t("importer.actions.browse_community")}
          </Link>
          <button
            type="button"
            onClick={() => navigate("/word-bank")}
            className="rounded-2xl bg-accent-orange px-4 py-3 text-sm font-bold text-text-on-accent"
          >
            {t("importer.actions.back_to_word_bank")}
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5 rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-5">
          <div className="rounded-2xl bg-bg-page p-4">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("importer.checklist.title")}</div>
            <div className="mt-3 grid gap-2 text-sm">
              {[
                { label: t("importer.checklist.load_source"), done: Boolean(dataset) },
                { label: t("importer.checklist.choose_destination"), done: hasDestinationDeck },
                { label: t("importer.checklist.map_required"), done: hasMappedTarget && hasMappedMeaning },
                { label: t("importer.checklist.confirm_cards"), done: importedWordsCount > 0 },
              ].map((item) => (
                <div key={item.label} className={`flex items-center gap-2 ${item.done ? "text-text-primary" : "text-text-secondary"}`}>
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${item.done ? "bg-accent-teal/15 text-accent-teal" : "bg-bg-card text-text-secondary"}`}>
                    {item.done ? "✓" : "•"}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-bg-card px-3 py-2 text-sm text-text-secondary">
              {nextStepMessage}
            </div>
          </div>

          <div>
            <div className="text-sm font-bold text-text-primary">{t("importer.steps.pick_source")}</div>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { id: "upload", label: t("importer.source_modes.upload"), icon: FileArchive },
                { id: "paste", label: t("importer.source_modes.paste"), icon: FileSpreadsheet },
                { id: "community", label: t("importer.source_modes.community"), icon: Layers },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSourceMode(id as SourceMode)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm ${sourceMode === id ? "border-accent-orange bg-bg-page text-text-primary" : "border-[var(--border-subtle)] text-text-secondary"}`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-bold text-text-primary">{t("importer.steps.destination_deck")}</div>
            <select
              className="mt-3 w-full rounded-2xl border border-[var(--border-subtle)] bg-bg-page px-4 py-3 text-sm text-text-primary outline-none"
              value={selectedDeckId}
              onChange={(event) => setSelectedDeckId(event.target.value)}
            >
              <option value="">{t("importer.destination.choose_deck")}</option>
              {(decksQuery.data ?? []).map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name} ({deck.language.toUpperCase()})
                </option>
              ))}
            </select>
            {!hasDestinationDeck && dataset ? (
              <p className="mt-2 mb-0 text-xs text-accent-orange">{t("importer.destination.blocked")}</p>
            ) : null}
            <button
              type="button"
              onClick={() => setShowCreateDeck((current) => !current)}
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm font-medium text-text-primary"
            >
              {showCreateDeck ? t("importer.destination.hide_new_deck") : t("importer.destination.create_new")}
            </button>
            {showCreateDeck ? (
              <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-bg-page p-4">
                <input
                  className="rounded-xl border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm text-text-primary outline-none"
                  placeholder={t("importer.destination.deck_name_placeholder")}
                  value={newDeck.name}
                  onChange={(event) => setNewDeck((current) => ({ ...current, name: event.target.value }))}
                />
                <select
                  className="rounded-xl border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm text-text-primary outline-none"
                  value={newDeck.language}
                  onChange={(event) => setNewDeck((current) => ({ ...current, language: event.target.value as LanguageCode }))}
                >
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <option key={language} value={language} className="bg-bg-card text-text-primary">
                      {LANGUAGE_LABELS[language]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => createDeck.mutate()}
                  disabled={!newDeck.name.trim() || createDeck.isPending}
                  className="rounded-xl bg-accent-orange px-3 py-2 text-sm font-bold text-text-on-accent disabled:opacity-60"
                >
                  {createDeck.isPending ? t("common.creating") : t("importer.destination.create_deck")}
                </button>
              </div>
            ) : null}
          </div>

          {status ? (
            <p className="m-0 overflow-hidden break-words rounded-2xl bg-accent-teal/10 px-4 py-3 text-sm text-accent-teal [overflow-wrap:anywhere]">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="m-0 overflow-hidden break-words rounded-2xl bg-[rgba(255,107,53,0.12)] px-4 py-3 text-sm text-accent-orange [overflow-wrap:anywhere]">
              {error}
            </p>
          ) : null}
        </aside>

        <div className="flex flex-col gap-6">
          {sourceMode === "upload" ? (
            <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <label
                className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed px-6 text-center transition-colors ${
                  isDragActive
                    ? "border-accent-orange bg-accent-orange/5"
                    : "border-[var(--border-subtle)] bg-bg-page"
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isDragActive) setIsDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                  setIsDragActive(false);
                }}
                onDrop={handleDrop}
              >
                <Upload size={28} className="text-accent-orange" />
                <div className="mt-4 text-lg font-bold text-text-primary">{t("importer.upload.title")}</div>
                <div className="mt-2 text-sm text-text-secondary">
                  {isDragActive ? t("importer.upload.drop_now") : t("importer.upload.support")}
                </div>
                <input
                  type="file"
                  accept=".apkg,.colpkg,.csv,.tsv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleFileUpload(file);
                      event.target.value = "";
                    }
                  }}
                />
              </label>
            </section>
          ) : null}

          {sourceMode === "paste" ? (
            <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <textarea
                className="min-h-60 w-full rounded-[20px] border border-[var(--border-subtle)] bg-bg-page p-4 font-mono text-sm text-text-primary outline-none"
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                placeholder={t("importer.paste.placeholder")}
              />
              <button
                type="button"
                onClick={handleParsePaste}
                className="mt-4 rounded-2xl bg-accent-orange px-4 py-3 text-sm font-bold text-text-on-accent"
              >
                {t("importer.paste.parse")}
              </button>
            </section>
          ) : null}

          {sourceMode === "community" ? (
            <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {(communityDecksQuery.data ?? []).map((deck) => (
                  <div
                    key={deck.slug}
                    className={`rounded-[20px] border p-5 ${deck.slug === communitySlug ? "border-accent-orange bg-bg-page" : "border-[var(--border-subtle)]"}`}
                  >
                    <button type="button" onClick={() => setCommunitySlug(deck.slug)} className="w-full text-left">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-accent-teal">{deck.language.toUpperCase()}</div>
                      <div className="mt-2 text-xl font-bold text-text-primary">{deck.title}</div>
                      <div className="mt-2 text-sm leading-6 text-text-secondary">{deck.summary}</div>
                    </button>
                    <Link to={`/community/decks/${deck.slug}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent-orange no-underline">
                      {t("importer.community.review_public_page")}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {packageData && packageData.noteTypes.length > 1 ? (
            <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <div className="text-sm font-bold text-text-primary">{t("importer.steps.note_type")}</div>
              <select
                className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-bg-page px-4 py-3 text-sm text-text-primary outline-none"
                value={activeNoteType?.id ?? ""}
                onChange={(event) => setNoteTypeId(event.target.value)}
              >
                {packageData.noteTypes.map((noteType) => (
                  <option key={noteType.id} value={noteType.id}>
                    {noteType.name} ({noteType.rows.length} notes)
                  </option>
                ))}
              </select>
            </section>
          ) : null}

          {dataset ? (
            <>
              <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-sm font-bold text-text-primary">{t("importer.steps.field_mapping")}</div>
                    <div className="mt-1 text-sm text-text-secondary">
                      {t("importer.mapping.source_summary", { sourceName: dataset.sourceName, count: dataset.rows.length })}
                    </div>
                  </div>
                  <div className="rounded-full bg-bg-page px-3 py-1 text-sm text-text-secondary">
                    {t("importer.mapping.cards_ready", { count: importedWordsCount })}
                  </div>
                </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {dataset.headers.map((header, index) => (
                    <div key={`${header}-${index}`} className="rounded-2xl bg-bg-page p-4">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("importer.mapping.column", { index: index + 1 })}</div>
                      <div className="mt-2 break-words text-sm font-semibold text-text-primary">{header || t("importer.mapping.untitled_column", { index: index + 1 })}</div>
                      <div className="mt-3">
                        <MappingSelect
                          value={mapping[index] ?? "skip"}
                          fieldLabels={fieldLabels}
                          onChange={(next) =>
                            setMapping((current) => {
                              const copy = [...current];
                              copy[index] = next;
                              return copy;
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
                <div className="text-sm font-bold text-text-primary">{t("importer.steps.preview")}</div>
                <div className="mt-4 overflow-x-auto rounded-[20px] border border-[var(--border-subtle)]">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead className="bg-bg-page text-left text-text-secondary">
                      <tr>
                        {dataset.headers.map((header, index) => (
                          <th key={`${header}-${index}`} className="max-w-56 px-4 py-3 align-top">
                            <div className="break-words">{header || t("importer.mapping.untitled_column", { index: index + 1 })}</div>
                            <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-accent-teal">{fieldLabels[mapping[index] ?? "skip"]}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={`preview-${rowIndex}`} className="border-t border-[var(--border-subtle)]">
                          {dataset.headers.map((_, colIndex) => (
                            <td key={`cell-${rowIndex}-${colIndex}`} className="max-w-56 px-4 py-3 align-top text-text-primary">
                              <div className="max-h-32 overflow-hidden break-words whitespace-pre-wrap">{row[colIndex] || "-"}</div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-text-secondary">
                    {t("importer.preview.required_prefix")} <span className="font-semibold text-text-primary">{fieldLabels.target}</span> {t("importer.preview.required_joiner")} <span className="font-semibold text-text-primary">{fieldLabels.meaning}</span>.
                  </div>
                  <button
                    type="button"
                    onClick={() => importWords.mutate()}
                    disabled={!canImport}
                    className="rounded-2xl bg-accent-orange px-5 py-3 text-sm font-bold text-text-on-accent disabled:opacity-60"
                  >
                    {importWords.isPending ? t("importer.actions.importing") : t("importer.actions.import_cards")}
                  </button>
                </div>
                {!canImport ? (
                  <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-bg-page px-4 py-3 text-sm text-text-secondary">
                    {nextStepMessage}
                  </div>
                ) : null}
              </section>

              <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-text-primary">{t("importer.steps.submit_community")}</div>
                    <div className="mt-1 text-sm text-text-secondary">
                      {t("importer.submission.subtitle")}
                    </div>
                  </div>
                  <Link to="/community/moderation" className="text-sm font-medium text-accent-orange no-underline">{t("importer.submission.open_moderation")}</Link>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("importer.submission.title_label")}</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none"
                        value={submissionForm.title}
                        onChange={(event) => setSubmissionForm((current) => ({ ...current, title: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("importer.submission.summary_label")}</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none"
                        value={submissionForm.summary}
                        onChange={(event) => setSubmissionForm((current) => ({ ...current, summary: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("importer.submission.description_label")}</label>
                      <textarea
                        className="mt-2 min-h-32 w-full rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none"
                        value={submissionForm.description}
                        onChange={(event) => setSubmissionForm((current) => ({ ...current, description: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("importer.submission.difficulty_label")}</label>
                      <select
                        className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none"
                        value={submissionForm.difficulty}
                        onChange={(event) => setSubmissionForm((current) => ({ ...current, difficulty: event.target.value as SubmissionForm["difficulty"] }))}
                      >
                        <option value="Beginner">{t("importer.difficulty.beginner")}</option>
                        <option value="Intermediate">{t("importer.difficulty.intermediate")}</option>
                        <option value="Advanced">{t("importer.difficulty.advanced")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{t("importer.submission.tags_label")}</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none"
                        value={submissionForm.tags}
                        onChange={(event) => setSubmissionForm((current) => ({ ...current, tags: event.target.value }))}
                        placeholder={t("importer.submission.tags_placeholder")}
                      />
                    </div>
                    <div className="rounded-2xl bg-bg-page p-4 text-sm text-text-secondary">
                      <div className="break-words [overflow-wrap:anywhere]">
                        {t("importer.submission.language")}: <span className="font-semibold text-text-primary">{currentDeckLanguage.toUpperCase()}</span>
                      </div>
                      <div className="mt-1 break-words [overflow-wrap:anywhere]">
                        {t("importer.submission.mapped_notes")}: <span className="font-semibold text-text-primary">{importedWordsCount}</span>
                      </div>
                      <div className="mt-1 break-words [overflow-wrap:anywhere]">
                        {t("importer.submission.source")}: <span className="font-semibold text-text-primary">{dataset.sourceName}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => submitDeck.mutate()}
                      disabled={!canSubmitCommunity}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-orange px-5 py-3 text-sm font-bold text-text-on-accent disabled:opacity-60"
                    >
                      <Send size={16} />
                      {submitDeck.isPending ? t("importer.actions.submitting") : t("importer.actions.submit_community")}
                    </button>
                    {!canSubmitCommunity ? (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-card px-3 py-2 text-sm text-text-secondary">
                        {nextStepMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-[24px] border border-dashed border-[var(--border-subtle)] bg-bg-card p-8 text-sm leading-6 text-text-secondary">
              {t("importer.empty_state")}
            </section>
          )}

          {mySubmissionsQuery.data?.length ? (
            <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <div className="text-sm font-bold text-text-primary">{t("importer.submission.recent_title")}</div>
              <div className="mt-4 grid gap-3">
                {mySubmissionsQuery.data.slice(0, 4).map((submission) => (
                  <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg-page px-4 py-3 text-sm">
                    <div>
                      <div className="font-semibold text-text-primary">{submission.title}</div>
                      <div className="text-text-secondary">{t("importer.submission.recent_meta", { count: submission.cardCount, sourceName: submission.sourceName })}</div>
                    </div>
                    <div className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-medium text-text-secondary">
                      {t(`importer.submission.status.${submission.status}`)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
