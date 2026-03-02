import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, FileArchive, FileSpreadsheet, Layers, Upload } from "lucide-react";
import type { CreateDeckInput, LanguageCode } from "@inko/shared";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from "@inko/shared";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { applyNoIndexMetadata } from "../lib/seo";
import {
  IMPORTABLE_FIELDS,
  buildWordsFromMapping,
  inferFieldMapping,
  parseAnkiPackage,
  parseDelimitedImport,
  type AnkiPackageDataset,
  type ImportDataset,
  type ImportableField,
} from "./ankiImportUtils";

type SourceMode = "community" | "upload" | "paste";

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
}: {
  value: ImportableField;
  onChange: (next: ImportableField) => void;
}) {
  return (
    <select
      className="rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary outline-none"
      value={value}
      onChange={(event) => onChange(event.target.value as ImportableField)}
    >
      {IMPORTABLE_FIELDS.map((field) => (
        <option key={field} value={field}>
          {field === "skip" ? "Skip" : field}
        </option>
      ))}
    </select>
  );
}

export function AnkiImportPage() {
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

  const decksQuery = useQuery({
    queryKey: ["decks"],
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

  const createDeck = useMutation({
    mutationFn: () => api.createDeck(token ?? "", newDeck),
    onSuccess: async (deck) => {
      setSelectedDeckId(deck.id);
      setShowCreateDeck(false);
      setNewDeck({ name: "", language: deck.language });
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
  });

  const importWords = useMutation({
    mutationFn: async () => {
      if (!selectedDeckId || !dataset) throw new Error("Choose a destination deck first.");
      const words = buildWordsFromMapping(dataset, mapping);
      if (words.length === 0) throw new Error("Map at least target and meaning to import notes.");

      let imported = 0;
      for (const batch of chunkWords(words, 500)) {
        const result = await api.createWordsBatch(token ?? "", selectedDeckId, { words: batch });
        imported += result.created;
      }
      return imported;
    },
    onMutate: () => {
      setError(null);
      setStatus("Importing notes...");
    },
    onSuccess: async (imported) => {
      setStatus(`Imported ${imported} cards into your deck.`);
      await queryClient.invalidateQueries({ queryKey: ["words-page", selectedDeckId] });
    },
    onError: (mutationError) => {
      setStatus(null);
      setError(mutationError instanceof Error ? mutationError.message : "Import failed.");
    },
  });

  const selectedCommunityDeck = selectedCommunityDeckQuery.data;
  const activeNoteType = useMemo(
    () => packageData?.noteTypes.find((noteType) => noteType.id === noteTypeId) ?? packageData?.noteTypes[0],
    [noteTypeId, packageData],
  );
  const previewRows = dataset?.rows.slice(0, 6) ?? [];
  const importedWordsCount = dataset ? buildWordsFromMapping(dataset, mapping).length : 0;

  useEffect(() => {
    applyNoIndexMetadata("Import Anki Decks | Inko");
  }, []);

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
    setStatus("Reading file...");

    try {
      if (/\.(apkg|colpkg)$/i.test(file.name)) {
        const nextPackage = await parseAnkiPackage(file);
        setPackageData(nextPackage);
        setNoteTypeId(nextPackage.noteTypes[0]?.id ?? "");
        setNewDeck((current) => ({
          ...current,
          name: current.name || nextPackage.suggestedDeckName,
        }));
        setStatus(`Loaded ${nextPackage.noteTypes.length} note type${nextPackage.noteTypes.length === 1 ? "" : "s"} from ${file.name}.`);
        return;
      }

      const text = await file.text();
      const nextDataset = parseDelimitedImport(file.name, text);
      if (!nextDataset) {
        throw new Error("This file does not contain a usable header row and note rows.");
      }
      setPackageData(null);
      setDataset(nextDataset);
      setMapping(inferFieldMapping(nextDataset.headers));
      setStatus(`Loaded ${nextDataset.rows.length} rows from ${file.name}.`);
    } catch (uploadError) {
      setStatus(null);
      setError(uploadError instanceof Error ? uploadError.message : "Failed to read this file.");
    }
  }

  function handleParsePaste() {
    const nextDataset = parseDelimitedImport("Pasted notes", pastedText);
    if (!nextDataset) {
      setError("Paste a CSV or TSV export with a header row.");
      return;
    }
    setPackageData(null);
    setDataset(nextDataset);
    setMapping(inferFieldMapping(nextDataset.headers));
    setStatus(`Parsed ${nextDataset.rows.length} rows from pasted content.`);
    setError(null);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 md:p-10">
      <header className="grid gap-5 rounded-[28px] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(0,212,170,0.18),transparent_34%),linear-gradient(135deg,var(--bg-card),var(--bg-page))] p-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-accent-teal">Importer</p>
          <h1 className="m-0 text-4xl font-bold [font-family:var(--font-display)] md:text-5xl">Import Anki decks with explicit field mapping.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary md:text-base">
            Upload an `.apkg`, `.colpkg`, `.csv`, or tab-separated note export, inspect the extracted fields, and import only the columns you want.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link to="/community" className="rounded-2xl border border-[var(--border-subtle)] px-4 py-3 text-sm font-medium text-text-primary no-underline">
            Browse community decks
          </Link>
          <button
            type="button"
            onClick={() => navigate("/word-bank")}
            className="rounded-2xl bg-accent-orange px-4 py-3 text-sm font-bold text-text-on-accent"
          >
            Back to word bank
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5 rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-5">
          <div>
            <div className="text-sm font-bold text-text-primary">1. Pick a source</div>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { id: "upload", label: "Upload deck export", icon: FileArchive },
                { id: "paste", label: "Paste CSV / TSV", icon: FileSpreadsheet },
                { id: "community", label: "Use community deck", icon: Layers },
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
            <div className="text-sm font-bold text-text-primary">2. Destination deck</div>
            <select
              className="mt-3 w-full rounded-2xl border border-[var(--border-subtle)] bg-bg-page px-4 py-3 text-sm text-text-primary outline-none"
              value={selectedDeckId}
              onChange={(event) => setSelectedDeckId(event.target.value)}
            >
              <option value="">Choose a deck</option>
              {(decksQuery.data ?? []).map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name} ({deck.language.toUpperCase()})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCreateDeck((current) => !current)}
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm font-medium text-text-primary"
            >
              {showCreateDeck ? "Hide new deck form" : "Create a new destination deck"}
            </button>
            {showCreateDeck ? (
              <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-bg-page p-4">
                <input
                  className="rounded-xl border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm text-text-primary outline-none"
                  placeholder="Deck name"
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
                  Create deck
                </button>
              </div>
            ) : null}
          </div>

          {status ? <p className="m-0 rounded-2xl bg-accent-teal/10 px-4 py-3 text-sm text-accent-teal">{status}</p> : null}
          {error ? <p className="m-0 rounded-2xl bg-[rgba(255,107,53,0.12)] px-4 py-3 text-sm text-accent-orange">{error}</p> : null}
        </aside>

        <div className="flex flex-col gap-6">
          {sourceMode === "upload" ? (
            <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed border-[var(--border-subtle)] bg-bg-page px-6 text-center">
                <Upload size={28} className="text-accent-orange" />
                <div className="mt-4 text-lg font-bold text-text-primary">Drop an Anki package or note export here</div>
                <div className="mt-2 text-sm text-text-secondary">Supports `.apkg`, `.colpkg`, `.csv`, `.tsv`, and text exports with a header row.</div>
                <input
                  type="file"
                  accept=".apkg,.colpkg,.csv,.tsv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFileUpload(file);
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
                placeholder={"Front\tReading\tMeaning\tExample\n食べる\tたべる\tto eat\t私は寿司を食べる。"}
              />
              <button
                type="button"
                onClick={handleParsePaste}
                className="mt-4 rounded-2xl bg-accent-orange px-4 py-3 text-sm font-bold text-text-on-accent"
              >
                Parse pasted notes
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
                      Review public page
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {packageData && packageData.noteTypes.length > 1 ? (
            <section className="rounded-[24px] border border-[var(--border-subtle)] bg-bg-card p-6">
              <div className="text-sm font-bold text-text-primary">3. Note type</div>
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
                    <div className="text-sm font-bold text-text-primary">4. Field mapping</div>
                    <div className="mt-1 text-sm text-text-secondary">
                      Source: {dataset.sourceName} • {dataset.rows.length} rows detected
                    </div>
                  </div>
                  <div className="rounded-full bg-bg-page px-3 py-1 text-sm text-text-secondary">
                    {importedWordsCount} cards will import with the current mapping
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {dataset.headers.map((header, index) => (
                    <div key={`${header}-${index}`} className="rounded-2xl bg-bg-page p-4">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Column {index + 1}</div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">{header || `Column ${index + 1}`}</div>
                      <div className="mt-3">
                        <MappingSelect
                          value={mapping[index] ?? "skip"}
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
                <div className="text-sm font-bold text-text-primary">5. Preview</div>
                <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--border-subtle)]">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-bg-page text-left text-text-secondary">
                      <tr>
                        {dataset.headers.map((header, index) => (
                          <th key={`${header}-${index}`} className="px-4 py-3">
                            <div>{header || `Column ${index + 1}`}</div>
                            <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-accent-teal">{mapping[index] ?? "skip"}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={`preview-${rowIndex}`} className="border-t border-[var(--border-subtle)]">
                          {dataset.headers.map((_, colIndex) => (
                            <td key={`cell-${rowIndex}-${colIndex}`} className="px-4 py-3 text-text-primary">
                              {row[colIndex] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-text-secondary">
                    Required: map at least one column to <span className="font-semibold text-text-primary">target</span> and one to <span className="font-semibold text-text-primary">meaning</span>.
                  </div>
                  <button
                    type="button"
                    onClick={() => importWords.mutate()}
                    disabled={!selectedDeckId || importWords.isPending}
                    className="rounded-2xl bg-accent-orange px-5 py-3 text-sm font-bold text-text-on-accent disabled:opacity-60"
                  >
                    {importWords.isPending ? "Importing..." : "Import cards"}
                  </button>
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-[24px] border border-dashed border-[var(--border-subtle)] bg-bg-card p-8 text-sm leading-6 text-text-secondary">
              Upload a file, paste a note export, or choose a community deck to generate the mapping table and preview.
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
