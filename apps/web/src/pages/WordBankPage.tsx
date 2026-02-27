import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { LANGUAGE_LABELS, type LanguageCode, SUPPORTED_LANGUAGES } from "@inko/shared";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { registerShortcut } from "../hooks/useKeyboard";

type AddTab = "single" | "import";
const IMPORT_BATCH_SIZE = 10000;
const WORDS_PAGE_SIZE = 100;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function WordBankPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formId = useId();
  const deckGridRef = useRef<HTMLDivElement>(null);

  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckLanguage, setNewDeckLanguage] = useState<LanguageCode>("ja");
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<{ id: string; name: string; archived: boolean } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<{ id: string; name: string } | null>(null);
  const [addTab, setAddTab] = useState<AddTab>("single");
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [rawImportData, setRawImportData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focusedDeckIndex, setFocusedDeckIndex] = useState(-1);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  const [wordForm, setWordForm] = useState({
    target: "",
    reading: "",
    romanization: "",
    meaning: "",
    example: "",
    audioUrl: "",
    tags: "",
  });

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

  const [wordSearch, setWordSearch] = useState("");
  const [wordsCursor, setWordsCursor] = useState<string | null>(null);
  const [wordsCursorHistory, setWordsCursorHistory] = useState<Array<string | null>>([]);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());

  const decksQuery = useQuery({
    queryKey: ["decks"],
    queryFn: () => api.listDecks(token ?? ""),
  });

  const wordsQuery = useQuery({
    queryKey: ["words-page", selectedDeckId, wordsCursor],
    enabled: !!selectedDeckId,
    queryFn: () =>
      api.listWordsPage(token ?? "", selectedDeckId, {
        cursor: wordsCursor,
        limit: WORDS_PAGE_SIZE,
      }),
  });

  const decks = decksQuery.data ?? [];
  const words = wordsQuery.data?.words ?? [];
  const activeDeck = useMemo(() => decks.find((d) => d.id === selectedDeckId), [decks, selectedDeckId]);
  const isJapaneseDeck = activeDeck?.language === "ja";

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    cleanups.push(registerShortcut({
      key: "d",
      handler: () => {
        if (decks.length > 0) {
          setFocusedDeckIndex(0);
          const firstDeck = deckGridRef.current?.querySelector("[data-deck-index='0']") as HTMLElement;
          firstDeck?.focus();
        }
      },
      description: "Focus first deck",
    }));
    return () => cleanups.forEach(c => c());
  }, [decks.length]);

  const handleDeckKeyDown = (event: React.KeyboardEvent) => {
    const maxIndex = decks.length - 1;
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        setFocusedDeckIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
        break;
      case "ArrowLeft":
        event.preventDefault();
        setFocusedDeckIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
        break;
      case "Enter":
        if (focusedDeckIndex >= 0 && focusedDeckIndex < decks.length) {
          event.preventDefault();
          const deck = decks[focusedDeckIndex];
          if (deck) setSelectedDeckId(deck.id);
        }
        break;
    }
  };

  useEffect(() => {
    if (focusedDeckIndex >= 0) {
      const card = deckGridRef.current?.querySelector(`[data-deck-index='${focusedDeckIndex}']`) as HTMLElement;
      card?.focus();
    }
  }, [focusedDeckIndex]);

  const createDeck = useMutation({
    mutationFn: () => api.createDeck(token ?? "", { name: newDeckName, language: newDeckLanguage }),
    onSuccess: async (deck) => {
      setSelectedDeckId(deck.id);
      setShowNewDeckModal(false);
      setNewDeckName("");
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
  });

  const deleteDeck = useMutation({
    mutationFn: () => api.deleteDeck(token ?? "", deckToDelete!.id),
    onSuccess: async () => {
      if (selectedDeckId === deckToDelete?.id) setSelectedDeckId("");
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
        tags: wordForm.tags.split(",").map((x) => x.trim()).filter(Boolean),
      }),
    onSuccess: async () => {
      setWordForm({ target: "", reading: "", romanization: "", meaning: "", example: "", audioUrl: "", tags: "" });
      await queryClient.invalidateQueries({ queryKey: ["words-page", selectedDeckId] });
    },
  });

  const deleteWord = useMutation({
    mutationFn: (wordId: string) => api.deleteWord(token ?? "", wordId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["words-page", selectedDeckId] });
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
      await queryClient.invalidateQueries({ queryKey: ["words-page", selectedDeckId] });
    },
  });

  const bulkDeleteWords = useMutation({
    mutationFn: async () => {
      if (!selectedDeckId || selectedWordIds.size === 0) return { deleted: 0, failedWordIds: [] };
      return await api.deleteWordsBatch(token ?? "", selectedDeckId, { wordIds: Array.from(selectedWordIds) });
    },
    onSuccess: async () => {
      setSelectedWordIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["words-page", selectedDeckId] });
    },
  });

  const pagedWords = useMemo(() => {
    if (!wordSearch.trim()) return words;
    const searchLower = wordSearch.toLowerCase();
    return words.filter((word: any) =>
      word.target?.toLowerCase().includes(searchLower) ||
      word.reading?.toLowerCase().includes(searchLower) ||
      word.meaning?.toLowerCase().includes(searchLower)
    );
  }, [words, wordSearch]);

  const hasPrevWordsPage = wordsCursorHistory.length > 0;
  const hasNextWordsPage = !!wordsQuery.data?.nextCursor;
  const wordsPageLabel = wordsCursorHistory.length + 1;

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ""; }
      else current += char;
    }
    result.push(current.trim());
    return result;
  };

  const parseImportData = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;
    const allRows = lines.map(line => parseCSVLine(line));
    return { headers: allRows[0] || [], rows: allRows.slice(1) };
  };

  const processImportData = async () => {
    if (!selectedDeckId || !rawImportData) return;
    setImportStatus(t("word_bank.import.importing"));
    let imported = 0;
    const wordsToImport = rawImportData.rows.map(row => ({
      target: row[0] || "",
      reading: row[1] || undefined,
      meaning: row[2] || "",
      romanization: row[3] || undefined,
      example: row[4] || undefined,
      tags: row[5] ? row[5].split(",").map(t => t.trim()).filter(Boolean) : [],
    })).filter(w => w.target && w.meaning);

    if (wordsToImport.length > 0) {
      const batches = chunkArray(wordsToImport, IMPORT_BATCH_SIZE);
      for (const batch of batches) {
        try {
          const result = await api.createWordsBatch(token ?? "", selectedDeckId, { words: batch });
          imported += result.created;
        } catch { /* error handled by status */ }
      }
    }
    setImportStatus(t("word_bank.import.done", { imported, failed: "" }));
    setRawImportData(null);
    await queryClient.invalidateQueries({ queryKey: ["words-page", selectedDeckId] });
    setTimeout(() => setImportStatus(null), 4000);
  };

  const updateField = (field: keyof typeof wordForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setWordForm((prev) => ({ ...prev, [field]: e.target.value }));

  const selectDeck = (id: string) => () => {
    setSelectedDeckId(id);
    setWordsCursor(null);
    setWordsCursorHistory([]);
    setSelectedWordIds(new Set());
    setWordSearch("");
  };

  const modalRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="flex h-screen overflow-hidden -m-5 md:-m-10 bg-bg-page relative">
      {/* Deck Sidebar Panel */}
      <aside 
        ref={sidebarRef}
        className={`hidden md:flex flex-col border-r border-[var(--border-subtle)] bg-bg-card relative h-full ${isPanelCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'} ${isResizing ? '' : 'transition-[width,opacity] duration-150 ease-out'}`}
        style={{ width: isPanelCollapsed ? 0 : sidebarWidth }}
      >
        <div className="flex flex-col h-full overflow-y-auto p-6 gap-8">
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">{t("word_bank.decks.title")}</h2>
              <button 
                type="button" 
                onClick={() => setShowNewDeckModal(true)}
                className="text-accent-orange text-[11px] font-bold uppercase hover:underline bg-transparent p-0 border-0 cursor-pointer"
              >
                + {t("common.new")}
              </button>
            </div>
            
            <nav className="flex flex-col gap-1" ref={deckGridRef} onKeyDown={handleDeckKeyDown}>
              {decks.map((deck, index) => (
                <div
                  key={deck.id}
                  data-deck-index={index}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-all border-0 cursor-pointer ${selectedDeckId === deck.id ? 'bg-bg-elevated text-text-primary border-l-2 border-accent-orange' : 'bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary'}`}
                  onClick={selectDeck(deck.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setSelectedDeckId(deck.id);
                    setWordsCursor(null);
                    setWordsCursorHistory([]);
                    setSelectedWordIds(new Set());
                    setWordSearch("");
                  }}
                  tabIndex={focusedDeckIndex === index ? 0 : -1}
                >
                  <div className="flex flex-col min-w-0">
                    <span className={`truncate font-bold text-sm ${selectedDeckId === deck.id ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>{deck.name}</span>
                    <span className="text-[10px] uppercase opacity-60 font-mono tracking-tighter">{deck.language}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                     <button
                        type="button"
                        className="p-1 text-text-secondary hover:text-text-primary bg-transparent border-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDeck({ id: deck.id, name: deck.name, archived: deck.archived });
                          setShowEditDeckModal(true);
                        }}
                      >
                        <Pencil size={12} />
                     </button>
                  </div>
                </div>
              ))}
            </nav>
          </section>

          {selectedDeckId && (
            <section className="flex flex-col gap-5 border-t border-[var(--border-subtle)] pt-6 pb-10">
              <h2 className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">{t("word_bank.add.title_short")}</h2>
              
              <div className="flex gap-1 rounded-lg bg-bg-elevated p-1" role="tablist">
                <button
                  type="button"
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium border-0 transition-all cursor-pointer ${addTab === "single" ? "bg-bg-card text-text-primary shadow-sm" : "bg-transparent text-text-secondary hover:text-text-primary"}`}
                  onClick={() => setAddTab("single")}
                >
                  {t("word_bank.add.tab_single")}
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium border-0 transition-all cursor-pointer ${addTab === "import" ? "bg-bg-card text-text-primary shadow-sm" : "bg-transparent text-text-secondary hover:text-text-primary"}`}
                  onClick={() => setAddTab("import")}
                >
                  {t("word_bank.add.tab_import")}
                </button>
              </div>

              {addTab === "single" ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-text-secondary uppercase" htmlFor={`${formId}-target`}>{t("word_bank.add.target_word")}</label>
                    <input
                      id={`${formId}-target`}
                      className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors"
                      placeholder={t("word_bank.add.target_placeholder", { example: isJapaneseDeck ? "勉強" : "palabra" })}
                      value={wordForm.target}
                      onChange={updateField("target")}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-text-secondary uppercase" htmlFor={`${formId}-meaning`}>{t("word_bank.add.meaning")}</label>
                    <input id={`${formId}-meaning`} className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors" placeholder={t("word_bank.add.meaning_placeholder")} value={wordForm.meaning} onChange={updateField("meaning")} />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-text-secondary uppercase" htmlFor={`${formId}-reading`}>{t("word_bank.add.reading")}</label>
                      <input id={`${formId}-reading`} className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors" placeholder="べんきょう" value={wordForm.reading} onChange={updateField("reading")} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-text-secondary uppercase" htmlFor={`${formId}-romanization`}>{t("word_bank.add.romanization")}</label>
                      <input id={`${formId}-romanization`} className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors" placeholder="benkyou" value={wordForm.romanization} onChange={updateField("romanization")} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-text-secondary uppercase" htmlFor={`${formId}-example`}>{t("word_bank.add.example")}</label>
                      <textarea id={`${formId}-example`} className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors min-h-[80px] resize-none" placeholder="..." value={wordForm.example} onChange={updateField("example")} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-2 w-full py-2.5 text-sm bg-accent-orange text-text-on-accent border-0 rounded-lg font-bold cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-accent-orange/20"
                    onClick={() => createWord.mutate()}
                    disabled={!wordForm.target || !wordForm.meaning || createWord.isPending}
                  >
                    {t("word_bank.add.submit")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {!rawImportData ? (
                    <>
                      <textarea
                        className="min-h-40 w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-bg-page p-3 font-mono text-xs leading-relaxed outline-none focus:border-accent-orange"
                        placeholder={`target,reading,meaning,romanization,example,tags
食べる,たべる,to eat,taberu,私は寿司を食べます。,verb,n5
飲む,のむ,to drink,nomu,お茶を飲みます。,verb,n5
読む,よむ,to read,yomu,本を読みます。,verb,n5`}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button type="button" className="flex-1 px-3 py-2 text-xs bg-bg-elevated rounded-lg border-0 cursor-pointer text-text-primary" onClick={() => fileInputRef.current?.click()}>{t("word_bank.import.choose_file")}</button>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const content = ev.target?.result as string;
                              if (content) setRawImportData(parseImportData(content));
                            };
                            reader.readAsText(file);
                          }
                        }} />
                        <button 
                          type="button" 
                          className="flex-1 px-3 py-2 text-xs bg-accent-orange text-text-on-accent rounded-lg border-0 font-bold cursor-pointer" 
                          onClick={() => {
                            if (importText.trim()) setRawImportData(parseImportData(importText));
                          }}
                          disabled={!importText.trim()}
                        >
                          {t("word_bank.import.preview")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <button type="button" className="w-full py-2 bg-accent-orange text-text-on-accent border-0 rounded-lg font-bold cursor-pointer" onClick={processImportData}>{t("word_bank.import.submit", { count: rawImportData.rows.length })}</button>
                      <button type="button" className="w-full py-2 bg-bg-elevated text-text-primary border-0 rounded-lg cursor-pointer" onClick={() => setRawImportData(null)}>{t("common.cancel")}</button>
                    </div>
                  )}
                  {importStatus && <p className="text-[11px] text-accent-teal font-medium m-0">{importStatus}</p>}
                </div>
              )}
            </section>
          )}
        </div>
        
        {/* Resize Handle */}
        {!isPanelCollapsed && (
          <div
            className="absolute right-0 top-0 h-full w-6 cursor-col-resize z-30 group"
            onMouseDown={(e) => {
              e.preventDefault();
              isResizingRef.current = true;
              setIsResizing(true);
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
              const startX = e.clientX;
              const startWidth = sidebarWidth;
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                if (!isResizingRef.current) return;
                moveEvent.preventDefault();
                const delta = moveEvent.clientX - startX;
                const newWidth = Math.max(240, Math.min(600, startWidth + delta));
                setSidebarWidth(newWidth);
              };
              
              const handleMouseUp = () => {
                isResizingRef.current = false;
                setIsResizing(false);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="absolute right-0 top-0 h-full w-px bg-[var(--border-subtle)] group-hover:bg-accent-orange transition-colors" />
          </div>
        )}
        
        {/* Toggle Button */}
        <button 
          type="button"
          onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
          className="absolute right-0 top-1/2 z-40 flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-bg-card p-0 text-text-secondary shadow-md hover:text-text-primary cursor-pointer transition-transform duration-300"
          aria-label={isPanelCollapsed ? "Expand panel" : "Collapse panel"}
        >
          <ChevronLeft 
            size={14} 
            className={`transition-transform duration-300 ${isPanelCollapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </aside>

      {/* Main Words Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-bg-page relative">
        {isPanelCollapsed && (
          <button 
            type="button"
            onClick={() => setIsPanelCollapsed(false)}
            className="hidden md:flex absolute left-4 top-20 z-10 h-8 w-8 items-center justify-center rounded-lg bg-bg-card border border-[var(--border-subtle)] p-0 text-text-secondary shadow-md hover:text-text-primary cursor-pointer animate-in fade-in zoom-in-95 duration-200"
          >
            <ChevronRight size={18} />
          </button>
        )}

        <div className="flex flex-col h-full p-5 md:p-10 gap-8 overflow-y-auto pb-32">
          <header className="flex flex-col gap-1">
            <h1 className="m-0 text-3xl font-semibold [font-family:var(--font-display)]">
              {activeDeck ? activeDeck.name : t("word_bank.title")}
            </h1>
            <p className="m-0 text-sm text-text-secondary">
              {activeDeck ? t("word_bank.decks.manage_deck", { name: activeDeck.name }) : t("word_bank.subtitle")}
            </p>
          </header>

          {!selectedDeckId ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-12 bg-bg-card rounded-2xl border border-dashed border-[var(--border-strong)]">
              <div className="text-4xl mb-4 opacity-20">📚</div>
              <h3 className="text-lg font-medium text-text-primary mb-2">{t("word_bank.words.select_deck")}</h3>
              <p className="text-sm text-text-secondary max-w-sm">{t("word_bank.words.select_deck_desc")}</p>
              <div className="md:hidden mt-6 grid grid-cols-1 gap-3 w-full max-w-xs">
                 {decks.map((deck) => (
                    <button key={deck.id} onClick={selectDeck(deck.id)} className="w-full py-3 bg-bg-elevated rounded-xl border-0 text-text-primary font-medium cursor-pointer">
                      {deck.name}
                    </button>
                 ))}
                 <button onClick={() => setShowNewDeckModal(true)} className="w-full py-3 border border-dashed border-accent-orange text-accent-orange rounded-xl bg-transparent font-medium cursor-pointer">
                   + {t("word_bank.decks.new_deck")}
                 </button>
              </div>
            </div>
          ) : (
            <section className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-sm">🔍</span>
                    <input
                      type="text"
                      placeholder={t("word_bank.words.search_placeholder")}
                      value={wordSearch}
                      onChange={(e) => setWordSearch(e.target.value)}
                      className="w-full pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="bg-bg-elevated px-3 py-1.5 text-xs rounded-lg border-0 cursor-pointer text-text-primary hover:bg-bg-hover transition-colors"
                      onClick={() => {
                        const prev = wordsCursorHistory[wordsCursorHistory.length - 1] ?? null;
                        setWordsCursorHistory((h) => h.slice(0, -1));
                        setWordsCursor(prev);
                      }}
                      disabled={!hasPrevWordsPage}
                    >
                      {t("common.prev")}
                    </button>
                    <span className="text-xs text-text-secondary">{t("common.page")} {wordsPageLabel}</span>
                    <button
                      type="button"
                      className="bg-bg-elevated px-3 py-1.5 text-xs rounded-lg border-0 cursor-pointer text-text-primary hover:bg-bg-hover transition-colors"
                      onClick={() => {
                        const next = wordsQuery.data?.nextCursor;
                        if (!next) return;
                        setWordsCursorHistory((h) => [...h, wordsCursor]);
                        setWordsCursor(next);
                      }}
                      disabled={!hasNextWordsPage}
                    >
                      {t("common.next")}
                    </button>
                  </div>
                </div>

                {selectedWordIds.size > 0 && (
                  <div className="flex items-center gap-4 rounded-xl bg-bg-elevated p-3 border border-accent-teal/20 animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-text-primary pl-1">{t("word_bank.words.selected", { count: selectedWordIds.size })}</span>
                    <div className="h-4 w-px bg-[var(--border-subtle)]" />
                    <button
                      type="button"
                      className="text-xs font-bold text-[var(--danger-text)] bg-transparent border-0 hover:underline p-0 cursor-pointer"
                      onClick={() => {
                        if (confirm(t("word_bank.words.delete_selected"))) bulkDeleteWords.mutate();
                      }}
                    >
                      {t("word_bank.words.delete_selected")}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-text-secondary bg-transparent border-0 hover:text-text-primary p-0 cursor-pointer"
                      onClick={() => setSelectedWordIds(new Set())}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                )}

                <div className="rounded-2xl border border-[var(--border-subtle)] bg-bg-card overflow-hidden shadow-sm">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-bg-elevated text-text-secondary border-b border-[var(--border-subtle)]">
                      <tr>
                        <th className="w-12 px-4 py-3 text-left">
                           <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={pagedWords.length > 0 && pagedWords.every((w: any) => selectedWordIds.has(w.id))}
                            onChange={(e) => {
                              const nextIds = new Set(selectedWordIds);
                              if (e.target.checked) pagedWords.forEach(w => nextIds.add(w.id));
                              else pagedWords.forEach(w => nextIds.delete(w.id));
                              setSelectedWordIds(nextIds);
                            }}
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">{t("word_bank.words.target")}</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px] md:table-cell hidden">{t("word_bank.words.reading")}</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">{t("word_bank.words.meaning")}</th>
                        <th className="w-20 px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {pagedWords.map((word: any) => (
                        <tr key={word.id} className="hover:bg-bg-elevated/20 group">
                          <td className="px-4 py-4">
                             <input
                              type="checkbox"
                              className="cursor-pointer"
                              checked={selectedWordIds.has(word.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedWordIds);
                                if (e.target.checked) newSet.add(word.id);
                                else newSet.delete(word.id);
                                setSelectedWordIds(newSet);
                              }}
                            />
                          </td>
                          <td className={`px-4 py-4 font-bold text-text-primary ${activeDeck?.language === "ja" ? "[font-family:var(--font-jp)] text-lg" : ""}`}>{word.target}</td>
                          <td className={`px-4 py-4 text-text-secondary md:table-cell hidden ${activeDeck?.language === "ja" ? "[font-family:var(--font-jp)]" : ""}`}>{word.reading ?? "-"}</td>
                          <td className="px-4 py-4 text-text-secondary">{word.meaning}</td>
                          <td className="px-4 py-4 text-right">
                             <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  className="p-1.5 text-text-secondary hover:text-text-primary rounded-md hover:bg-bg-elevated border-0 bg-transparent cursor-pointer"
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
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="p-1.5 text-text-secondary hover:text-[var(--danger-text)] rounded-md hover:bg-[var(--danger-bg)] border-0 bg-transparent cursor-pointer"
                                  onClick={() => deleteWord.mutate(word.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pagedWords.length === 0 && (
                    <div className="py-20 text-center text-text-secondary">
                      <p>{t("word_bank.words.no_words")}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {selectedDeckId && (
        <button
          type="button"
          className="md:hidden fixed right-6 bottom-24 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent-orange text-text-on-accent shadow-lg shadow-accent-orange/30 border-0 cursor-pointer"
          onClick={() => setIsPanelCollapsed(false)}
          aria-label="Add Word"
        >
          <span className="text-3xl font-light">+</span>
        </button>
      )}

      {showNewDeckModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm border-0" onClick={() => setShowNewDeckModal(false)} />
          <dialog ref={modalRef} className="relative z-[1010] flex w-full max-w-[420px] flex-col gap-6 rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-8 shadow-2xl" open>
            <h2 className="m-0 text-2xl font-semibold [font-family:var(--font-display)]">{t("word_bank.new_deck.title")}</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor={`${formId}-deckname`}>{t("word_bank.new_deck.name")}</label>
                <input id={`${formId}-deckname`} className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none" placeholder={t("word_bank.new_deck.name_placeholder")} value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor={`${formId}-deck-language`}>{t("word_bank.new_deck.language")}</label>
                <select id={`${formId}-deck-language`} className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none" value={newDeckLanguage} onChange={(e) => setNewDeckLanguage(e.target.value as LanguageCode)}>
                  {SUPPORTED_LANGUAGES.map((code) => <option key={code} value={code}>{LANGUAGE_LABELS[code]} ({code.toUpperCase()})</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="bg-bg-elevated text-text-primary px-5 py-2 rounded-lg border-0 cursor-pointer" onClick={() => setShowNewDeckModal(false)}>{t("common.cancel")}</button>
              <button type="button" className="bg-accent-orange text-text-on-accent px-5 py-2 rounded-lg border-0 font-bold cursor-pointer" onClick={() => createDeck.mutate()} disabled={!newDeckName.trim() || createDeck.isPending}>{t("common.create")}</button>
            </div>
          </dialog>
        </div>
      )}

      {showEditDeckModal && editingDeck && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm border-0" onClick={() => setShowEditDeckModal(false)} />
          <dialog className="relative z-[1010] flex w-full max-w-[420px] flex-col gap-6 rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-8 shadow-2xl" open>
            <h2 className="m-0 text-2xl font-semibold [font-family:var(--font-display)]">{t("word_bank.edit_deck.title")}</h2>
            <div className="flex flex-col gap-4">
              <input className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none" value={editingDeck.name} onChange={(e) => setEditingDeck({...editingDeck, name: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="bg-bg-elevated text-text-primary px-5 py-2 rounded-lg border-0 cursor-pointer" onClick={() => setShowEditDeckModal(false)}>{t("common.cancel")}</button>
              <button type="button" className="bg-accent-orange text-text-on-accent px-5 py-2 rounded-lg border-0 font-bold cursor-pointer" onClick={() => navigate(0)}>{t("common.save")}</button>
            </div>
          </dialog>
        </div>
      )}

      {showEditWordModal && editingWord && (
         <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm border-0" onClick={() => setShowEditWordModal(false)} />
          <dialog className="relative z-[1010] flex w-full max-w-[500px] flex-col gap-6 rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-8 shadow-2xl overflow-y-auto max-h-[90vh]" open>
            <h2 className="m-0 text-2xl font-semibold [font-family:var(--font-display)]">{t("word_bank.edit_word.title")}</h2>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-text-secondary font-bold uppercase" htmlFor={`${formId}-edit-target`}>{t("word_bank.add.target_word")} *</label>
                  <input className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none" id={`${formId}-edit-target`} value={editingWord.target} onChange={(e) => setEditingWord({ ...editingWord, target: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-text-secondary font-bold uppercase" htmlFor={`${formId}-edit-meaning`}>{t("word_bank.add.meaning")} *</label>
                  <input className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none" id={`${formId}-edit-meaning`} value={editingWord.meaning} onChange={(e) => setEditingWord({ ...editingWord, meaning: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-text-secondary font-bold uppercase" htmlFor={`${formId}-edit-reading`}>{t("word_bank.add.reading")}</label>
                  <input className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none" id={`${formId}-edit-reading`} value={editingWord.reading} onChange={(e) => setEditingWord({ ...editingWord, reading: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-text-secondary font-bold uppercase" htmlFor={`${formId}-edit-romanization`}>{t("word_bank.add.romanization")}</label>
                  <input className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none" id={`${formId}-edit-romanization`} value={editingWord.romanization} onChange={(e) => setEditingWord({ ...editingWord, romanization: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-text-secondary font-bold uppercase" htmlFor={`${formId}-edit-example`}>{t("word_bank.add.example")}</label>
                <textarea id={`${formId}-edit-example`} className="min-h-[80px] p-3 rounded-lg bg-bg-page border border-[var(--border-subtle)] outline-none focus:border-accent-orange transition-colors resize-none" value={editingWord.example} onChange={(e) => setEditingWord({ ...editingWord, example: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-text-secondary font-bold uppercase" htmlFor={`${formId}-edit-audio`}>{t("word_bank.add.audio_url")}</label>
                <input className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none" id={`${formId}-edit-audio`} value={editingWord.audioUrl} onChange={(e) => setEditingWord({ ...editingWord, audioUrl: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-text-secondary font-bold uppercase" htmlFor={`${formId}-edit-tags`}>{t("word_bank.add.tags")}</label>
                <input className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none" id={`${formId}-edit-tags`} value={editingWord.tags.join(", ")} onChange={(e) => setEditingWord({ ...editingWord, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" className="bg-bg-elevated text-text-primary px-5 py-2 rounded-lg border-0 cursor-pointer" onClick={() => setShowEditWordModal(false)}>{t("common.cancel")}</button>
              <button type="button" className="bg-accent-orange text-text-on-accent px-5 py-2 rounded-lg border-0 font-bold cursor-pointer" onClick={() => updateWord.mutate()} disabled={!editingWord.target.trim() || !editingWord.meaning.trim() || updateWord.isPending}>{t("common.save_changes")}</button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
