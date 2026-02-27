import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";
import { registerShortcut } from "../hooks/useKeyboard.js";

type AddTab = "single" | "import";

export function WordBankPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formId = useId();
  const deckGridRef = useRef<HTMLDivElement>(null);

  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
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
    mutationFn: () => api.createDeck(token ?? "", { name: newDeckName, language: "ja" }),
    onSuccess: async (deck) => {
      setSelectedDeckId(deck.id);
      setShowNewDeckModal(false);
      setNewDeckName("");
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
  });

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

  // ---- bulk import ----
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>> | null>(null);
  const [importColumnMapping, setImportColumnMapping] = useState<Record<number, string>>({});
  const [rawImportData, setRawImportData] = useState<{ headers: string[]; rows: string[][] } | null>(null);

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

    for (const row of rawImportData.rows) {
      const data: Record<string, string | undefined> = {
        target: undefined,
        reading: undefined,
        meaning: undefined,
        romanization: undefined,
        example: undefined,
        tags: undefined,
      };

      // Map columns to fields
      for (const [colIndex, field] of Object.entries(importColumnMapping)) {
        if (field && field !== '') {
          const value = row[Number.parseInt(colIndex)];
          if (field === 'tags') {
            data.tags = value;
          } else {
            data[field] = value || undefined;
          }
        }
      }

      if (!data.target || !data.meaning) {
        failed++;
        continue;
      }

      try {
        await api.createWord(token ?? "", selectedDeckId, {
          target: data.target,
          reading: data.reading,
          meaning: data.meaning,
          romanization: data.romanization,
          example: data.example,
          tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        });
        imported++;
      } catch {
        failed++;
      }
    }

    setImportStatus(`Done: ${imported} imported${failed ? `, ${failed} failed` : ""}`);
    setImportPreview(null);
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
          
          // Generate preview
          const preview = parsed.rows.slice(0, 5).map(row => {
            const item: Record<string, string> = {};
            for (const [colIndex, field] of Object.entries(mapping)) {
              if (field && field !== '') {
                item[field] = row[Number.parseInt(colIndex)] || '';
              }
            }
            return item;
          });
          setImportPreview(preview);
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
          <span className="inline-flex items-center gap-1 rounded border border-[#2f2f2f] bg-bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
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
              className={`group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-base border p-4 text-left transition-all ${selectedDeckId === deck.id ? "border-accent-orange shadow-[0_0_0_1px_#ff6b35]" : "border-[#2f2f2f] bg-bg-card hover:-translate-y-0.5 hover:border-accent-orange"}`}
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
                <span className="text-[11px] uppercase tracking-[0.1em] text-text-secondary">{deck.language.toUpperCase()}</span>
                <span className="text-lg font-semibold text-text-primary [font-family:var(--font-display)]">{deck.name}</span>
              </div>
              <div className="mt-auto flex gap-2">
                <Link to={`/practice/${deck.id}`} onClick={(e) => e.stopPropagation()} className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-lg bg-accent-orange px-2.5 py-2 text-xs font-semibold text-text-on-accent no-underline">
                  <span>Practice</span>
                  <kbd className="shrink-0 rounded border border-white/10 bg-black/30 px-1 py-[1px] font-mono text-[9px] opacity-70">p</kbd>
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
                  <kbd className="shrink-0 rounded border border-white/10 bg-black/30 px-1 py-[1px] font-mono text-[9px] opacity-70">Enter</kbd>
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
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-base border-2 border-dashed border-[#3a3a3a] bg-transparent p-4 text-text-secondary transition-all hover:border-accent-orange hover:text-text-primary focus:border-accent-orange focus:text-text-primary"
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
              <kbd className="ml-2 rounded border border-[#2f2f2f] bg-bg-elevated px-[5px] py-[1px] font-mono text-[10px] text-text-secondary opacity-70">Shift+1</kbd>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={addTab === "import"}
              className={`relative flex-1 rounded-lg border-0 px-4 py-2.5 text-sm font-medium transition-all ${addTab === "import" ? "bg-bg-elevated text-text-primary" : "bg-transparent text-text-secondary hover:text-text-primary"}`}
              onClick={() => setAddTab("import")}
            >
              Bulk Import
              <kbd className="ml-2 rounded border border-[#2f2f2f] bg-bg-elevated px-[5px] py-[1px] font-mono text-[10px] text-text-secondary opacity-70">Shift+2</kbd>
            </button>
          </div>

          {addTab === "single" ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-target`}>Target word</label>
                  <input id={`${formId}-target`} placeholder="e.g. 勉強" value={wordForm.target} onChange={updateField("target")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-meaning`}>Meaning</label>
                  <input id={`${formId}-meaning`} placeholder="e.g. study; learning" value={wordForm.meaning} onChange={updateField("meaning")} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-reading`}>Reading</label>
                  <input id={`${formId}-reading`} placeholder="e.g. べんきょう" value={wordForm.reading} onChange={updateField("reading")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-romanization`}>Romanization</label>
                  <input id={`${formId}-romanization`} placeholder="e.g. benkyou" value={wordForm.romanization} onChange={updateField("romanization")} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-example`}>Example sentence</label>
                <input id={`${formId}-example`} placeholder="e.g. 毎日日本語を勉強しています。" value={wordForm.example} onChange={updateField("example")} />
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
                      className="min-h-40 w-full resize-y rounded-[10px] border border-[#2f2f2f] bg-[#141414] p-[14px] font-mono text-sm leading-relaxed text-inherit"
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
                            
                            // Generate preview
                            const preview = parsed.rows.slice(0, 5).map(row => {
                              const item: Record<string, string> = {};
                              for (const [colIndex, field] of Object.entries(mapping)) {
                                if (field && field !== '') {
                                  item[field] = row[Number.parseInt(colIndex)] || '';
                                }
                              }
                              return item;
                            });
                            setImportPreview(preview);
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
                  <div className="flex flex-col gap-3 rounded-lg border border-[#2f2f2f] bg-bg-elevated p-4">
                    <h3 className="m-0 text-sm font-semibold">Field Mapping</h3>
                    <p className="m-0 text-[12px] text-text-secondary">Map each column to the correct field:</p>
                    
                     <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {rawImportData.headers.map((header, index) => (
                        <div key={`header-${header}-${index}`} className="flex flex-col gap-1">
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
                  {importPreview && importPreview.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h3 className="m-0 text-sm font-semibold">Preview ({importPreview.length} of {rawImportData.rows.length} rows)</h3>
                      <div className="max-h-60 overflow-auto rounded-lg border border-[#2f2f2f]">
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
                            {importPreview.map((row, i) => (
                              <tr key={i} className="border-t border-[#2f2f2f]">
                                <td className="px-3 py-2 [font-family:var(--font-jp)]">{row.target || '-'}</td>
                                <td className="px-3 py-2 text-text-secondary [font-family:var(--font-jp)]">{row.reading || '-'}</td>
                                <td className="px-3 py-2 text-text-secondary">{row.meaning || '-'}</td>
                                <td className="px-3 py-2 text-text-secondary [font-family:var(--font-jp)] truncate max-w-[200px]" title={row.example}>
                                  {row.example || '-'}
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
                        setImportPreview(null);
                        setImportColumnMapping({});
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
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 text-[22px] font-semibold [font-family:var(--font-display)]">Words ({words.length})</h2>
          </div>

          {words.length > 0 ? (
            <div className="flex flex-col gap-2">
              {words.map((word) => (
                <div key={word.id} className="grid grid-cols-1 items-center gap-3 rounded-xl bg-bg-card px-5 py-4 md:grid-cols-[1fr_auto_auto] md:gap-5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xl [font-family:var(--font-jp)]" lang="ja">{word.target}</span>
                    <span className="text-[13px] text-text-secondary [font-family:var(--font-jp)]" lang="ja">{word.reading ?? "-"}</span>
                  </div>
                  <div className="text-sm text-text-secondary">{word.meaning}</div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(word.tags ?? []).map((t: string) => (
                        <span key={t} className="rounded-md bg-bg-elevated px-2.5 py-[3px] text-[11px] text-text-secondary">{t}</span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="border-0 bg-transparent px-2 py-1 text-xl leading-none text-[#666] hover:text-[#ff6b6b]"
                      onClick={() => deleteWord.mutate(word.id)}
                      disabled={deleteWord.isPending}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-base bg-bg-card p-10 text-center text-text-secondary">
              <p>No words yet.</p>
              <p className="mt-2 text-[13px]">Add words using the form above.</p>
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
            className="fixed inset-0 z-[100] border-0 bg-black/60 p-0"
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
            className="fixed left-1/2 top-1/2 z-[101] flex w-[420px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-base border border-[#2f2f2f] bg-bg-card p-7 text-text-primary"
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
            <div className="mt-2 flex justify-end gap-2.5">
              <button type="button" className="bg-bg-elevated text-text-primary" onClick={() => setShowNewDeckModal(false)}>
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
            className="fixed inset-0 z-[100] border-0 bg-black/60 p-0"
            onClick={() => setShowEditDeckModal(false)}
            aria-label="Close edit deck modal"
          />
          <dialog
            className="fixed left-1/2 top-1/2 z-[101] flex w-[420px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-base border border-[#2f2f2f] bg-bg-card p-7 text-text-primary"
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${formId}-archive`}
                checked={editingDeck.archived}
                onChange={(e) => setEditingDeck({ ...editingDeck, archived: e.target.checked })}
              />
              <label htmlFor={`${formId}-archive`} className="mb-0">Archive deck (hide from dashboard)</label>
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
            className="fixed inset-0 z-[100] border-0 bg-black/60 p-0"
            onClick={() => setShowDeleteConfirm(false)}
            aria-label="Close delete confirmation"
          />
          <dialog
            className="fixed left-1/2 top-1/2 z-[101] flex w-[420px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-base border border-[#2f2f2f] bg-bg-card p-7 text-text-primary"
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
    </div>
  );
}
