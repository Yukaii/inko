import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { LANGUAGE_LABELS, type LanguageCode, SUPPORTED_LANGUAGES } from "@inko/shared";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";
import { registerShortcut } from "../hooks/useKeyboard.js";

type AddTab = "single" | "import";
const NEW_DECK_LANGUAGE_STORAGE_KEY = "inko:new-deck-language";
const IMPORT_PREVIEW_PAGE_SIZE = 20;
const IMPORT_BATCH_SIZE = 1000;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getInitialDeckLanguage(): LanguageCode {
  if (typeof window === "undefined") return "ja";
  const stored = window.localStorage.getItem(NEW_DECK_LANGUAGE_STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored as LanguageCode)) {
    return stored as LanguageCode;
  }
  return "ja";
}

export function WordBankPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formId = useId();
  const deckGridRef = useRef<HTMLDivElement>(null);

  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckLanguage, setNewDeckLanguage] = useState<LanguageCode>(() => getInitialDeckLanguage());
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<{ id: string; name: string; archived: boolean } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<{ id: string; name: string } | null>(null);
  const [addTab, setAddTab] = useState<AddTab>("single");
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"text" | "csv">("text");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focusedDeckIndex, setFocusedDeckIndex] = useState(-1);

  const [wordForm, setWordForm] = useState({
    target: "",
    reading: "",
    romanization: "",
    meaning: "",
    example: "",
    audioUrl: "",
    tags: "",
  });

  // Word editing state
  const [showEditWordModal, setShowEditWordModal] = useState(false);
  const [editingWord, setEditingWord] = useState<{
    id: string;
    target: string;
    reading: string;
    romanization: string;
    meaning: string;
    example: string;
    audioUrl: string;
    tags: string[];
  } | null>(null);

  // Search and filter state
  const [wordSearch, setWordSearch] = useState("");
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());

  // ---- queries ----
  const decksQuery = useQuery({
    queryKey: ["decks"],
    queryFn: () => api.listDecks(token ?? ""),
  });

  const wordsQuery = useQuery({
    queryKey: ["words", selectedDeckId],
    enabled: !!selectedDeckId,
    queryFn: () => api.listWords(token ?? "", selectedDeckId),
  });

  const decks = decksQuery.data ?? [];
  const words = wordsQuery.data ?? [];
  const activeDeck = useMemo(() => decks.find((d) => d.id === selectedDeckId), [decks, selectedDeckId]);
  const activeDeckLanguage = (activeDeck?.language ?? "ja") as LanguageCode;
  const isJapaneseDeck = activeDeckLanguage === "ja";
  const targetLang = activeDeck?.language || undefined;

  // ---- keyboard navigation for decks ----
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // Focus deck grid
    cleanups.push(
      registerShortcut({
        key: "d",
        handler: () => {
          if (decks.length > 0) {
            setFocusedDeckIndex(0);
            const firstDeck = deckGridRef.current?.querySelector("[data-deck-index='0']") as HTMLElement;
            firstDeck?.focus();
          }
        },
        description: "Focus first deck",
      })
    );

    // Tab shortcuts for add words section
    cleanups.push(
      registerShortcut({
        key: "1",
        shift: true,
        handler: () => {
          if (selectedDeckId) {
            setAddTab("single");
          }
        },
        description: "Switch to Single Word tab",
      })
    );

    cleanups.push(
      registerShortcut({
        key: "2",
        shift: true,
        handler: () => {
          if (selectedDeckId) {
            setAddTab("import");
          }
        },
        description: "Switch to Bulk Import tab",
      })
    );

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [decks.length, selectedDeckId]);

  // Handle arrow key navigation within deck grid
  const handleDeckKeyDown = (event: React.KeyboardEvent) => {
    const maxIndex = decks.length;

    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        setFocusedDeckIndex((prev) => {
          const next = prev + 1;
          if (next > maxIndex) return 0;
          return next;
        });
        break;
      case "ArrowLeft":
        event.preventDefault();
        setFocusedDeckIndex((prev) => {
          const next = prev - 1;
          if (next < 0) return maxIndex;
          return next;
        });
        break;
      case "ArrowDown":
        event.preventDefault();
        setFocusedDeckIndex((prev) => {
          if (!deckGridRef.current) return prev;
          const cols = getComputedStyle(deckGridRef.current).gridTemplateColumns.split(" ").length;
          const next = prev + cols;
          if (next > maxIndex) return prev;
          return next;
        });
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusedDeckIndex((prev) => {
          if (!deckGridRef.current) return prev;
          const cols = getComputedStyle(deckGridRef.current).gridTemplateColumns.split(" ").length;
          const next = prev - cols;
          if (next < 0) return prev;
          return next;
        });
        break;
      case "Enter":
      case "e":
        if (focusedDeckIndex === maxIndex) {
          // New deck button
          event.preventDefault();
          setShowNewDeckModal(true);
        } else if (focusedDeckIndex >= 0 && focusedDeckIndex < decks.length) {
          event.preventDefault();
          const deck = decks[focusedDeckIndex];
          if (deck) {
            setSelectedDeckId(deck.id);
          }
        }
        break;
      case "p":
        if (focusedDeckIndex >= 0 && focusedDeckIndex < decks.length) {
          event.preventDefault();
          const deck = decks[focusedDeckIndex];
          if (deck) {
            navigate(`/practice/${deck.id}`);
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
  };

  // Focus the currently selected deck
  useEffect(() => {
    if (focusedDeckIndex >= 0) {
      const card = deckGridRef.current?.querySelector(`[data-deck-index='${focusedDeckIndex}']`) as HTMLElement;
      card?.focus();
    }
  }, [focusedDeckIndex]);

  // ---- mutations ----
  const createDeck = useMutation({
    mutationFn: () => api.createDeck(token ?? "", { name: newDeckName, language: newDeckLanguage }),
    onSuccess: async (deck) => {
      setSelectedDeckId(deck.id);
      setShowNewDeckModal(false);
      setNewDeckName("");
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(NEW_DECK_LANGUAGE_STORAGE_KEY, newDeckLanguage);
  }, [newDeckLanguage]);

  const updateDeck = useMutation({
    mutationFn: (input: { name?: string; archived?: boolean }) =>
      api.updateDeck(token ?? "", editingDeck!.id, input),
    onSuccess: async () => {
      setShowEditDeckModal(false);
      setEditingDeck(null);
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
  });

  const deleteDeck = useMutation({
    mutationFn: () => api.deleteDeck(token ?? "", deckToDelete!.id),
    onSuccess: async () => {
      if (selectedDeckId === deckToDelete?.id) {
        setSelectedDeckId("");
      }
      setShowDeleteConfirm(false);
      setDeckToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
  });

  const createWord = useMutation({
    mutationFn: () =>
      api.createWord(token ?? "", selectedDeckId, {
        target: wordForm.target,
        reading: wordForm.reading || undefined,
        romanization: wordForm.romanization || undefined,
        meaning: wordForm.meaning,
        example: wordForm.example || undefined,
        audioUrl: wordForm.audioUrl || undefined,
        tags: wordForm.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      }),
    onSuccess: async () => {
      setWordForm({ target: "", reading: "", romanization: "", meaning: "", example: "", audioUrl: "", tags: "" });
      await queryClient.invalidateQueries({ queryKey: ["words", selectedDeckId] });
    },
  });

  const deleteWord = useMutation({
    mutationFn: (wordId: string) => api.deleteWord(token ?? "", wordId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["words", selectedDeckId] });
    },
  });

  const updateWord = useMutation({
    mutationFn: () => {
      if (!editingWord) throw new Error("No word being edited");
      return api.updateWord(token ?? "", editingWord.id, {
        target: editingWord.target,
        reading: editingWord.reading || undefined,
        romanization: editingWord.romanization || undefined,
        meaning: editingWord.meaning,
        example: editingWord.example || undefined,
        audioUrl: editingWord.audioUrl || undefined,
        tags: editingWord.tags,
      });
    },
    onSuccess: async () => {
      setShowEditWordModal(false);
      setEditingWord(null);
      await queryClient.invalidateQueries({ queryKey: ["words", selectedDeckId] });
    },
  });

  const bulkDeleteWords = useMutation({
    mutationFn: async () => {
      if (!selectedDeckId || selectedWordIds.size === 0) {
        return { deleted: 0, failedWordIds: [] as string[] };
      }
      return await api.deleteWordsBatch(token ?? "", selectedDeckId, {
        wordIds: Array.from(selectedWordIds),
      });
    },
    onSuccess: async () => {
      setSelectedWordIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["words", selectedDeckId] });
    },
  });

  // ---- filtered words ----
  const filteredWords = useMemo(() => {
    if (!wordSearch.trim()) return words;
    const searchLower = wordSearch.toLowerCase();
    return words.filter((word: any) =>
      word.target?.toLowerCase().includes(searchLower) ||
      word.reading?.toLowerCase().includes(searchLower) ||
      word.meaning?.toLowerCase().includes(searchLower) ||
      word.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
    );
  }, [words, wordSearch]);

  // ---- bulk import ----
  const [importColumnMapping, setImportColumnMapping] = useState<Record<number, string>>({});
  const [rawImportData, setRawImportData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [importPreviewPage, setImportPreviewPage] = useState(1);

  const mapImportRow = useCallback(
    (row: string[]) => {
      const mapped: Record<string, string | undefined> = {
        target: undefined,
        reading: undefined,
        meaning: undefined,
        romanization: undefined,
        example: undefined,
        tags: undefined,
      };

      for (const [colIndex, field] of Object.entries(importColumnMapping)) {
        if (!field) continue;
        const value = row[Number.parseInt(colIndex)]?.trim();
        if (field === "tags") {
          mapped.tags = value;
        } else {
          mapped[field] = value || undefined;
        }
      }

      return mapped;
    },
    [importColumnMapping],
  );

  const mappedImportRows = useMemo(() => {
    if (!rawImportData) return [];
    return rawImportData.rows.map((row) => mapImportRow(row));
  }, [mapImportRow, rawImportData]);

  const totalPreviewPages = Math.max(1, Math.ceil(mappedImportRows.length / IMPORT_PREVIEW_PAGE_SIZE));
  const previewPage = Math.min(importPreviewPage, totalPreviewPages);
  const previewStart = (previewPage - 1) * IMPORT_PREVIEW_PAGE_SIZE;
  const previewRows = mappedImportRows.slice(previewStart, previewStart + IMPORT_PREVIEW_PAGE_SIZE);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const detectDelimiter = (text: string): string => {
    const firstLine = text.split('\n')[0] || '';
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    return tabCount > commaCount ? '\t' : ',';
  };

  const parseImportData = (text: string) => {
    const delimiter = detectDelimiter(text);
    const lines = text.split('\n').filter(l => l.trim());
    
    if (lines.length === 0) return null;

    // Parse all lines
    const allRows = lines.map(line => 
      delimiter === '\t' ? line.split('\t').map(s => s.trim()) : parseCSVLine(line)
    );

    // Detect if first row is a header (contains text like 'target', 'meaning', etc.)
    const firstRow = allRows[0];
    const headerKeywords = ['target', 'word', 'reading', 'meaning', 'definition', 'example', 'sentence', 'romanization', 'romaji', 'tags'];
    const hasHeader = firstRow.some(cell => 
      headerKeywords.some(keyword => cell.toLowerCase().includes(keyword))
    );

    const headers = hasHeader ? firstRow : firstRow.map((_, i) => `Column ${i + 1}`);
    const dataRows = hasHeader ? allRows.slice(1) : allRows;

    return { headers, rows: dataRows };
  };

  const autoMapColumns = (headers: string[]): Record<number, string> => {
    const mapping: Record<number, string> = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());
    
    for (let index = 0; index < lowerHeaders.length; index++) {
      const header = lowerHeaders[index];
      if (header.includes('target') || header.includes('word') || header.includes('kanji') || header.includes('japanese')) {
        mapping[index] = 'target';
      } else if (header.includes('reading') || header.includes('furigana') || header.includes('kana')) {
        mapping[index] = 'reading';
      } else if (header.includes('meaning') || header.includes('definition') || header.includes('english') || header.includes('translation')) {
        mapping[index] = 'meaning';
      } else if (header.includes('romanization') || header.includes('romaji')) {
        mapping[index] = 'romanization';
      } else if (header.includes('example') || header.includes('sentence')) {
        mapping[index] = 'example';
      } else if (header.includes('tag') || header.includes('category')) {
        mapping[index] = 'tags';
      } else {
        mapping[index] = '';
      }
    }

    return mapping;
  };

  const processImportData = async () => {
    if (!selectedDeckId || !rawImportData) return;
    
    setImportStatus("Importing...");
    let imported = 0;
    let failed = 0;

    const wordsToImport = [] as Array<{
      target: string;
      reading?: string;
      meaning: string;
      romanization?: string;
      example?: string;
      tags: string[];
    }>;

    for (const row of rawImportData.rows) {
      const data = mapImportRow(row);
      if (!data.target || !data.meaning) {
        failed++;
        continue;
      }

      wordsToImport.push({
        target: data.target,
        reading: data.reading,
        meaning: data.meaning,
        romanization: data.romanization,
        example: data.example,
        tags: data.tags
          ? data.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      });
    }

    if (wordsToImport.length > 0) {
      const batches = chunkArray(wordsToImport, IMPORT_BATCH_SIZE);
      for (const batch of batches) {
        try {
          const result = await api.createWordsBatch(token ?? "", selectedDeckId, {
            words: batch,
          });
          imported += result.created;
        } catch {
          failed += batch.length;
        }
      }
    }

    setImportStatus(`Done: ${imported} imported${failed ? `, ${failed} failed` : ""}`);
    setRawImportData(null);
    setImportColumnMapping({});
    await queryClient.invalidateQueries({ queryKey: ["words", selectedDeckId] });
    setTimeout(() => setImportStatus(null), 4000);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const parsed = parseImportData(content);
        if (parsed && parsed.rows.length > 0) {
          setRawImportData(parsed);
          const mapping = autoMapColumns(parsed.headers);
          setImportColumnMapping(mapping);
          setImportPreviewPage(1);
        }
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // ---- field updater ----
  const updateField = (field: keyof typeof wordForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setWordForm((prev) => ({ ...prev, [field]: e.target.value }));

  const selectDeck = (id: string) => () => setSelectedDeckId(id);

  // Modal focus trap
  const modalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!showNewDeckModal) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setShowNewDeckModal(false);
      }
    };

    modal.addEventListener("keydown", handleTab);
    window.addEventListener("keydown", handleEscape, { capture: true });
    firstElement?.focus();

    return () => {
      modal.removeEventListener("keydown", handleTab);
      window.removeEventListener("keydown", handleEscape, { capture: true });
    };
  }, [showNewDeckModal]);

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <header className="mb-2">
        <h1 className="m-0 text-4xl font-semibold [font-family:var(--font-display)]">Word Bank</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your decks and vocabulary</p>
      </header>

      {/* Deck Grid */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">Decks</h2>
          <span className="inline-flex items-center gap-1 rounded border border-[var(--border-muted)] bg-bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
            <kbd className="font-mono">d</kbd> to focus
          </span>
        </div>

        <div
          ref={deckGridRef}
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
          onKeyDown={handleDeckKeyDown}
        >
          {decks.map((deck, index) => (
            <div
              key={deck.id}
              data-deck-index={index}
              className={`group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-base border p-4 text-left transition-all ${selectedDeckId === deck.id ? "border-accent-orange shadow-[0_0_0_1px_var(--accent-orange)]" : "border-[var(--border-muted)] bg-bg-card hover:-translate-y-0.5 hover:border-accent-orange"}`}
              onClick={selectDeck(deck.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectDeck(deck.id)();
                }
              }}
              tabIndex={focusedDeckIndex === index ? 0 : -1}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-[0.1em] text-text-secondary">
                  {deck.language.toUpperCase()} · {LANGUAGE_LABELS[deck.language as LanguageCode]}
                </span>
                <span className="text-lg font-semibold text-text-primary [font-family:var(--font-display)]">{deck.name}</span>
              </div>
              <div className="mt-auto flex gap-2">
                <Link to={`/practice/${deck.id}`} onClick={(e) => e.stopPropagation()} className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-lg bg-accent-orange px-2.5 py-2 text-xs font-semibold text-text-on-accent no-underline">
                  <span>Practice</span>
                  <kbd className="shrink-0 rounded border border-[var(--border-strong)] bg-bg-page px-1 py-[1px] font-mono text-[9px] text-text-primary">p</kbd>
                </Link>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-lg bg-bg-elevated px-2.5 py-2 text-xs font-semibold text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDeckId(deck.id);
                  }}
                >
                  <span>Manage</span>
                  <kbd className="shrink-0 rounded border border-[var(--border-muted)] bg-bg-card px-1 py-[1px] font-mono text-[9px] text-text-secondary">Enter</kbd>
                </button>
              </div>
              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-bg-elevated p-0 text-text-secondary hover:text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDeck({ id: deck.id, name: deck.name, archived: deck.archived });
                    setShowEditDeckModal(true);
                  }}
                  aria-label="Edit deck"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-bg-elevated p-0 text-text-secondary hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeckToDelete({ id: deck.id, name: deck.name });
                    setShowDeleteConfirm(true);
                  }}
                  aria-label="Delete deck"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* New deck tile */}
          <button
            type="button"
            data-deck-index={decks.length}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-base border-2 border-dashed border-[var(--border-strong)] bg-transparent p-4 text-text-secondary transition-all hover:border-accent-orange hover:text-text-primary focus:border-accent-orange focus:text-text-primary"
            onClick={() => setShowNewDeckModal(true)}
            tabIndex={focusedDeckIndex === decks.length ? 0 : -1}
          >
            <span className="text-[28px] leading-none font-light">+</span>
            <span className="text-[13px]">New Deck</span>
          </button>
        </div>
      </section>

      {/* Add words section (only when deck selected) */}
      {selectedDeckId && (
        <section className="flex flex-col gap-5 rounded-base bg-bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">Add to {activeDeck?.name ?? "Deck"}</h2>
          </div>

          {/* Tabs */}
          <div className="mb-2 flex gap-1 rounded-xl bg-bg-card p-1" role="tablist" aria-label="Add words tabs">
            <button
              type="button"
              role="tab"
              aria-selected={addTab === "single"}
              className={`relative flex-1 rounded-lg border-0 px-4 py-2.5 text-sm font-medium transition-all ${addTab === "single" ? "bg-bg-elevated text-text-primary" : "bg-transparent text-text-secondary hover:text-text-primary"}`}
              onClick={() => setAddTab("single")}
            >
              Single Word
              <kbd className="ml-2 rounded border border-[var(--border-muted)] bg-bg-elevated px-[5px] py-[1px] font-mono text-[10px] text-text-secondary opacity-70">Shift+1</kbd>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={addTab === "import"}
              className={`relative flex-1 rounded-lg border-0 px-4 py-2.5 text-sm font-medium transition-all ${addTab === "import" ? "bg-bg-elevated text-text-primary" : "bg-transparent text-text-secondary hover:text-text-primary"}`}
              onClick={() => setAddTab("import")}
            >
              Bulk Import
              <kbd className="ml-2 rounded border border-[var(--border-muted)] bg-bg-elevated px-[5px] py-[1px] font-mono text-[10px] text-text-secondary opacity-70">Shift+2</kbd>
            </button>
          </div>

          {addTab === "single" ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-target`}>Target word</label>
                  <input
                    id={`${formId}-target`}
                    placeholder={isJapaneseDeck ? "e.g. 勉強" : "e.g. palabra"}
                    value={wordForm.target}
                    onChange={updateField("target")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-meaning`}>Meaning</label>
                  <input id={`${formId}-meaning`} placeholder="e.g. study; learning" value={wordForm.meaning} onChange={updateField("meaning")} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-reading`}>Reading</label>
                  <input
                    id={`${formId}-reading`}
                    placeholder={isJapaneseDeck ? "e.g. べんきょう" : "Optional pronunciation"}
                    value={wordForm.reading}
                    onChange={updateField("reading")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-romanization`}>Romanization</label>
                  <input id={`${formId}-romanization`} placeholder="e.g. benkyou" value={wordForm.romanization} onChange={updateField("romanization")} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-example`}>Example sentence</label>
                <input
                  id={`${formId}-example`}
                  placeholder={isJapaneseDeck ? "e.g. 毎日日本語を勉強しています。" : "e.g. Estoy aprendiendo cada dia."}
                  value={wordForm.example}
                  onChange={updateField("example")}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-audio`}>Audio URL (optional)</label>
                  <input id={`${formId}-audio`} placeholder="https://..." value={wordForm.audioUrl} onChange={updateField("audioUrl")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-tags`}>Tags (comma separated)</label>
                  <input id={`${formId}-tags`} placeholder="e.g. n5, verb" value={wordForm.tags} onChange={updateField("tags")} />
                </div>
              </div>
              <button
                type="button"
                className="w-fit px-6 py-3 text-sm"
                onClick={() => createWord.mutate()}
                disabled={!wordForm.target || !wordForm.meaning || createWord.isPending}
              >
                {createWord.isPending ? "Adding..." : "Add Word"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {!rawImportData ? (
                <>
                  <div className="flex flex-col gap-3">
                    <p className="m-0 text-[13px] text-text-secondary">
                      Upload a CSV/TSV file or paste data directly. Supported columns: target, reading, meaning, romanization, example, tags
                    </p>
                    
                    {/* File Upload */}
                    <div className="flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.tsv,.txt"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <button
                        type="button"
                        className="px-4 py-2 text-sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Choose File
                      </button>
                      <span className="text-[13px] text-text-secondary">or paste below</span>
                    </div>

                    {/* Text Input */}
                    <textarea
                      className="min-h-40 w-full resize-y rounded-[10px] border border-[var(--border-muted)] bg-bg-page p-[14px] font-mono text-sm leading-relaxed text-inherit"
                      placeholder={`target,reading,meaning,romanization,example,tags
食べる,たべる,to eat,taberu,私は寿司を食べます。,verb,n5
飲む,のむ,to drink,nomu,お茶を飲みます。,verb,n5
読む,よむ,to read,yomu,本を読みます。,verb,n5`}
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                    />
                    
                    <button 
                      type="button" 
                      className="w-fit px-6 py-3 text-sm" 
                      onClick={() => {
                        if (importText.trim()) {
                          const parsed = parseImportData(importText);
                          if (parsed && parsed.rows.length > 0) {
                            setRawImportData(parsed);
                            const mapping = autoMapColumns(parsed.headers);
                            setImportColumnMapping(mapping);
                            setImportPreviewPage(1);
                          }
                        }
                      }} 
                      disabled={!importText.trim()}
                    >
                      Preview Import
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Field Mapping */}
                  <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-muted)] bg-bg-elevated p-4">
                    <h3 className="m-0 text-sm font-semibold">Field Mapping</h3>
                    <p className="m-0 text-[12px] text-text-secondary">Map each column to the correct field:</p>
                    
                     <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {rawImportData.headers.map((header, index) => (
                        <div key={`header-${header}`} className="flex flex-col gap-1">
                          <label htmlFor={`col-map-${index}`} className="text-[11px] text-text-secondary truncate" title={header}>
                            {header}
                          </label>
                          <select
                            id={`col-map-${index}`}
                            className="text-sm py-1 px-2"
                            value={importColumnMapping[index] || ''}
                            onChange={(e) => {
                              setImportColumnMapping(prev => ({
                                ...prev,
                                [index]: e.target.value
                              }));
                              setImportPreviewPage(1);
                            }}
                          >
                            <option value="">-- Skip --</option>
                            <option value="target">Target (required)</option>
                            <option value="reading">Reading</option>
                            <option value="meaning">Meaning (required)</option>
                            <option value="romanization">Romanization</option>
                            <option value="example">Example</option>
                            <option value="tags">Tags</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  {previewRows.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="m-0 text-sm font-semibold">
                          Preview ({previewStart + 1}-{Math.min(previewStart + previewRows.length, mappedImportRows.length)} of {mappedImportRows.length})
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <button
                            type="button"
                            className="bg-bg-elevated px-2 py-1 text-xs"
                            onClick={() => setImportPreviewPage((prev) => Math.max(1, prev - 1))}
                            disabled={previewPage <= 1}
                          >
                            Prev
                          </button>
                          <span>Page {previewPage} / {totalPreviewPages}</span>
                          <button
                            type="button"
                            className="bg-bg-elevated px-2 py-1 text-xs"
                            onClick={() => setImportPreviewPage((prev) => Math.min(totalPreviewPages, prev + 1))}
                            disabled={previewPage >= totalPreviewPages}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                      <div className="max-h-60 overflow-auto rounded-lg border border-[var(--border-muted)]">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-bg-elevated">
                            <tr>
                              <th className="px-3 py-2 text-left text-[11px] text-text-secondary">Target</th>
                              <th className="px-3 py-2 text-left text-[11px] text-text-secondary">Reading</th>
                              <th className="px-3 py-2 text-left text-[11px] text-text-secondary">Meaning</th>
                              <th className="px-3 py-2 text-left text-[11px] text-text-secondary">Example</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, i) => (
                              <tr key={`${previewStart + i}-${row.target ?? ""}-${row.meaning ?? ""}`} className="border-t border-[var(--border-muted)]">
                                <td className={`px-3 py-2 ${isJapaneseDeck ? "[font-family:var(--font-jp)]" : ""}`}>{row.target || "-"}</td>
                                <td className={`px-3 py-2 text-text-secondary ${isJapaneseDeck ? "[font-family:var(--font-jp)]" : ""}`}>{row.reading || "-"}</td>
                                <td className="px-3 py-2 text-text-secondary">{row.meaning || '-'}</td>
                                <td className={`px-3 py-2 text-text-secondary truncate max-w-[200px] ${isJapaneseDeck ? "[font-family:var(--font-jp)]" : ""}`} title={row.example ?? ""}>
                                  {row.example || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Import Actions */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="bg-bg-elevated text-text-primary"
                      onClick={() => {
                        setRawImportData(null);
                        setImportColumnMapping({});
                        setImportPreviewPage(1);
                        setImportText('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={processImportData}
                      disabled={!Object.values(importColumnMapping).includes('target') || !Object.values(importColumnMapping).includes('meaning')}
                    >
                      Import {rawImportData.rows.length} Words
                    </button>
                  </div>
                </>
              )}
              
              {importStatus && (
                <p className="m-0 text-[13px] text-accent-teal">{importStatus}</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Words list */}
      {selectedDeckId && (
        <section className="flex flex-col gap-4">
          {/* Header with search */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">
              Words ({filteredWords.length}{wordSearch ? ` of ${words.length}` : ''})
            </h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search words..."
                value={wordSearch}
                onChange={(e) => setWordSearch(e.target.value)}
                className="w-full md:w-64"
              />
              {wordSearch && (
                <button
                  type="button"
                  className="border-0 bg-transparent p-0 text-text-secondary hover:text-text-primary"
                  onClick={() => setWordSearch('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Bulk actions */}
          {selectedWordIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-bg-elevated p-3">
              <span className="text-sm text-text-secondary">{selectedWordIds.size} selected</span>
              <button
                type="button"
                className="border-0 bg-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/30"
                onClick={() => {
                  if (confirm(`Delete ${selectedWordIds.size} words?`)) {
                    bulkDeleteWords.mutate();
                  }
                }}
                disabled={bulkDeleteWords.isPending}
              >
                {bulkDeleteWords.isPending ? 'Deleting...' : 'Delete Selected'}
              </button>
              <button
                type="button"
                className="border-0 bg-transparent px-3 py-1.5 text-sm text-text-secondary"
                onClick={() => setSelectedWordIds(new Set())}
              >
                Clear selection
              </button>
            </div>
          )}

          {filteredWords.length > 0 ? (
            <div className="rounded-base border border-[var(--border-muted)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg-elevated">
                  <tr>
                    <th className="w-10 px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={filteredWords.length > 0 && filteredWords.every((w: any) => selectedWordIds.has(w.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWordIds(new Set(filteredWords.map((w: any) => w.id)));
                          } else {
                            setSelectedWordIds(new Set());
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-text-secondary">Target</th>
                    <th className="px-3 py-3 text-left font-medium text-text-secondary">Reading</th>
                    <th className="px-3 py-3 text-left font-medium text-text-secondary">Meaning</th>
                    <th className="px-3 py-3 text-left font-medium text-text-secondary">Tags</th>
                    <th className="w-20 px-3 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-muted)]">
                  {filteredWords.map((word: any) => (
                    <>
                      <tr
                        key={word.id}
                        className={`hover:bg-bg-elevated/50 ${expandedWordId === word.id ? 'bg-bg-elevated/30' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedWordIds.has(word.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedWordIds);
                              if (e.target.checked) {
                                newSet.add(word.id);
                              } else {
                                newSet.delete(word.id);
                              }
                              setSelectedWordIds(newSet);
                            }}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className={`px-3 py-3 ${isJapaneseDeck ? "[font-family:var(--font-jp)]" : ""}`} lang={targetLang}>{word.target}</td>
                        <td className={`px-3 py-3 text-text-secondary ${isJapaneseDeck ? "[font-family:var(--font-jp)]" : ""}`} lang={targetLang}>{word.reading ?? "-"}</td>
                        <td className="px-3 py-3 text-text-secondary">{word.meaning}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(word.tags ?? []).slice(0, 3).map((t: string) => (
                              <span key={t} className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">{t}</span>
                            ))}
                            {(word.tags ?? []).length > 3 && (
                              <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">+{(word.tags ?? []).length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded border-0 bg-transparent p-0 text-text-secondary hover:text-text-primary"
                              onClick={() => setExpandedWordId(expandedWordId === word.id ? null : word.id)}
                              aria-label={expandedWordId === word.id ? 'Collapse' : 'Expand'}
                            >
                              {expandedWordId === word.id ? '−' : '+'}
                            </button>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded border-0 bg-transparent p-0 text-text-secondary hover:text-text-primary"
                              onClick={() => {
                                setEditingWord({
                                  id: word.id,
                                  target: word.target,
                                  reading: word.reading ?? '',
                                  romanization: word.romanization ?? '',
                                  meaning: word.meaning,
                                  example: word.example ?? '',
                                  audioUrl: word.audioUrl ?? '',
                                  tags: word.tags ?? [],
                                });
                                setShowEditWordModal(true);
                              }}
                              aria-label="Edit word"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded border-0 bg-transparent p-0 text-text-secondary hover:text-red-400"
                              onClick={() => deleteWord.mutate(word.id)}
                              disabled={deleteWord.isPending}
                              aria-label="Delete word"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedWordId === word.id && (
                        <tr className="bg-bg-elevated/20">
                          <td colSpan={6} className="px-3 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              {word.romanization && (
                                <div>
                                  <span className="text-[11px] uppercase tracking-wider text-text-secondary">Romanization</span>
                                  <p className="mt-1 text-sm">{word.romanization}</p>
                                </div>
                              )}
                              {word.example && (
                                <div>
                                  <span className="text-[11px] uppercase tracking-wider text-text-secondary">Example</span>
                                  <p className={`mt-1 text-sm ${isJapaneseDeck ? "[font-family:var(--font-jp)]" : ""}`} lang={targetLang}>{word.example}</p>
                                </div>
                              )}
                              {word.audioUrl && (
                                <div>
                                  <span className="text-[11px] uppercase tracking-wider text-text-secondary">Audio</span>
                                  <audio controls className="mt-1 h-8 w-full" src={word.audioUrl}>
                                    Your browser does not support the audio element.
                                  </audio>
                                </div>
                              )}
                              {(word.tags ?? []).length > 0 && (
                                <div>
                                  <span className="text-[11px] uppercase tracking-wider text-text-secondary">All Tags</span>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {(word.tags ?? []).map((t: string) => (
                                      <span key={t} className="rounded bg-bg-elevated px-2 py-1 text-[11px] text-text-secondary">{t}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-base bg-bg-card p-10 text-center text-text-secondary">
              {wordSearch ? (
                <>
                  <p>No words match your search.</p>
                  <p className="mt-2 text-[13px]">Try a different search term or clear the filter.</p>
                </>
              ) : (
                <>
                  <p>No words yet.</p>
                  <p className="mt-2 text-[13px]">Add words using the form above.</p>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* No deck selected hint */}
      {!selectedDeckId && decks.length > 0 && (
        <div className="rounded-base bg-bg-card p-10 text-center text-text-secondary">
          <p>Select a deck to view and manage its words.</p>
        </div>
      )}

      {/* New Deck Modal */}
      {showNewDeckModal && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] border-0 bg-[var(--overlay-bg)] p-0"
            onClick={() => setShowNewDeckModal(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowNewDeckModal(false);
              } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowNewDeckModal(false);
              }
            }}
            aria-label="Close new deck modal"
          />
          <dialog
            ref={modalRef}
            className="fixed inset-0 z-[101] m-auto flex h-fit max-h-[90vh] w-[420px] max-w-[90vw] flex-col gap-5 rounded-base border border-[var(--border-muted)] bg-bg-card p-7 text-text-primary"
            open
            aria-label="Create new deck"
          >
            <h2 className="m-0 text-2xl [font-family:var(--font-display)]">Create New Deck</h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-deckname`}>Deck name</label>
              <input
                id={`${formId}-deckname`}
                placeholder="e.g. JLPT N5 Vocabulary"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDeckName.trim()) createDeck.mutate();
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-deck-language`}>Target language</label>
              <select
                id={`${formId}-deck-language`}
                value={newDeckLanguage}
                onChange={(e) => setNewDeckLanguage(e.target.value as LanguageCode)}
              >
                {SUPPORTED_LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {LANGUAGE_LABELS[code]} ({code.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex justify-end gap-2.5">
              <button
                type="button"
                className="bg-bg-elevated text-text-primary"
                onClick={() => setShowNewDeckModal(false)}
              >
                Cancel
              </button>
              <button type="button" onClick={() => createDeck.mutate()} disabled={!newDeckName.trim() || createDeck.isPending}>
                {createDeck.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </dialog>
        </>
      )}

      {/* Edit Deck Modal */}
      {showEditDeckModal && editingDeck && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] border-0 bg-[var(--overlay-bg)] p-0"
            onClick={() => setShowEditDeckModal(false)}
            aria-label="Close edit deck modal"
          />
          <dialog
            className="fixed inset-0 z-[101] m-auto flex h-fit max-h-[90vh] w-[420px] max-w-[90vw] flex-col gap-5 rounded-base border border-[var(--border-muted)] bg-bg-card p-7 text-text-primary"
            open
            aria-label="Edit deck"
          >
            <h2 className="m-0 text-2xl [font-family:var(--font-display)]">Edit Deck</h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-edit-deckname`}>Deck name</label>
              <input
                id={`${formId}-edit-deckname`}
                value={editingDeck.name}
                onChange={(e) => setEditingDeck({ ...editingDeck, name: e.target.value })}
              />
            </div>
            <div className="flex min-w-0 items-start gap-3">
              <input
                type="checkbox"
                id={`${formId}-archive`}
                checked={editingDeck.archived}
                onChange={(e) => setEditingDeck({ ...editingDeck, archived: e.target.checked })}
                className="!mt-0.5 !h-4 !w-4 shrink-0 cursor-pointer"
              />
              <label htmlFor={`${formId}-archive`} className="min-w-0 flex-1 cursor-pointer text-sm text-text-primary">
                Archive deck (hide from dashboard)
              </label>
            </div>
            <div className="mt-2 flex justify-end gap-2.5">
              <button
                type="button"
                className="bg-bg-elevated text-text-primary"
                onClick={() => {
                  setShowEditDeckModal(false);
                  setEditingDeck(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateDeck.mutate({ name: editingDeck.name, archived: editingDeck.archived })}
                disabled={!editingDeck.name.trim() || updateDeck.isPending}
              >
                {updateDeck.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </dialog>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deckToDelete && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] border-0 bg-[var(--overlay-bg)] p-0"
            onClick={() => setShowDeleteConfirm(false)}
            aria-label="Close delete confirmation"
          />
          <dialog
            className="fixed inset-0 z-[101] m-auto flex h-fit max-h-[90vh] w-[420px] max-w-[90vw] flex-col gap-5 rounded-base border border-[var(--border-muted)] bg-bg-card p-7 text-text-primary"
            open
            aria-label="Delete deck confirmation"
          >
            <h2 className="m-0 text-2xl [font-family:var(--font-display)]">Delete Deck</h2>
            <p className="text-text-secondary">
              Are you sure you want to delete "<strong>{deckToDelete.name}</strong>"? This will remove the deck and unlink all words from it. Words in other decks will not be affected.
            </p>
            <div className="mt-2 flex justify-end gap-2.5">
              <button
                type="button"
                className="bg-bg-elevated text-text-primary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeckToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-red-500 text-white hover:bg-red-600"
                onClick={() => deleteDeck.mutate()}
                disabled={deleteDeck.isPending}
              >
                {deleteDeck.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </dialog>
        </>
      )}

      {/* Edit Word Modal */}
      {showEditWordModal && editingWord && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] border-0 bg-[var(--overlay-bg)] p-0"
            onClick={() => {
              setShowEditWordModal(false);
              setEditingWord(null);
            }}
            aria-label="Close edit word modal"
          />
          <dialog
            className="fixed inset-0 z-[101] m-auto flex h-fit max-h-[90vh] w-[500px] max-w-[90vw] flex-col gap-5 overflow-auto rounded-base border border-[var(--border-muted)] bg-bg-card p-7 text-text-primary"
            open
            aria-label="Edit word"
          >
            <h2 className="m-0 text-2xl [font-family:var(--font-display)]">Edit Word</h2>
            
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-edit-target`}>Target word *</label>
                  <input
                    id={`${formId}-edit-target`}
                    value={editingWord.target}
                    onChange={(e) => setEditingWord({ ...editingWord, target: e.target.value })}
                    className={isJapaneseDeck ? "[font-family:var(--font-jp)]" : undefined}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-edit-meaning`}>Meaning *</label>
                  <input
                    id={`${formId}-edit-meaning`}
                    value={editingWord.meaning}
                    onChange={(e) => setEditingWord({ ...editingWord, meaning: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-edit-reading`}>Reading</label>
                  <input
                    id={`${formId}-edit-reading`}
                    value={editingWord.reading}
                    onChange={(e) => setEditingWord({ ...editingWord, reading: e.target.value })}
                    className={isJapaneseDeck ? "[font-family:var(--font-jp)]" : undefined}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-edit-romanization`}>Romanization</label>
                  <input
                    id={`${formId}-edit-romanization`}
                    value={editingWord.romanization}
                    onChange={(e) => setEditingWord({ ...editingWord, romanization: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-edit-example`}>Example sentence</label>
                <input
                  id={`${formId}-edit-example`}
                  value={editingWord.example}
                  onChange={(e) => setEditingWord({ ...editingWord, example: e.target.value })}
                  className={isJapaneseDeck ? "[font-family:var(--font-jp)]" : undefined}
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-edit-audio`}>Audio URL</label>
                <input
                  id={`${formId}-edit-audio`}
                  value={editingWord.audioUrl}
                  onChange={(e) => setEditingWord({ ...editingWord, audioUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-edit-tags`}>Tags (comma separated)</label>
                <input
                  id={`${formId}-edit-tags`}
                  value={editingWord.tags.join(', ')}
                  onChange={(e) => setEditingWord({ ...editingWord, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  placeholder="e.g. n5, verb"
                />
              </div>
            </div>
            
            <div className="mt-2 flex justify-end gap-2.5">
              <button
                type="button"
                className="bg-bg-elevated text-text-primary"
                onClick={() => {
                  setShowEditWordModal(false);
                  setEditingWord(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateWord.mutate()}
                disabled={!editingWord.target.trim() || !editingWord.meaning.trim() || updateWord.isPending}
              >
                {updateWord.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
