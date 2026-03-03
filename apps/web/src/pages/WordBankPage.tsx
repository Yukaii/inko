import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, ChevronLeft, ChevronRight, Search, BookOpen, ArrowLeft, Download } from "lucide-react";
import { LANGUAGE_LABELS, type CreateCommunityDeckSubmissionInput, type LanguageCode, SUPPORTED_LANGUAGES } from "@inko/shared";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { registerShortcut } from "../hooks/useKeyboard";
import { authQueryKey } from "../lib/queryKeys";
import { downloadDeckCsv, fetchAllDeckWords } from "./wordBankExport";

type AddTab = "single" | "import";
const IMPORT_BATCH_SIZE = 10000;
const WORDS_PAGE_SIZE = 100;

type PublishDeckForm = {
  title: string;
  summary: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  tags: string;
};

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
  const { deckId: routeDeckId } = useParams<{ deckId?: string }>();
  const queryClient = useQueryClient();
  const formId = useId();
  const deckGridRef = useRef<HTMLDivElement>(null);

  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckLanguage, setNewDeckLanguage] = useState<LanguageCode>("ja");
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<{ id: string; name: string; language: LanguageCode; archived: boolean } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showPublishDeckModal, setShowPublishDeckModal] = useState(false);
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
  const [publishDeckForm, setPublishDeckForm] = useState<PublishDeckForm>({
    title: "",
    summary: "",
    description: "",
    difficulty: "Beginner",
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
  const [showMobileAddModal, setShowMobileAddModal] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showDeckActionsHint, setShowDeckActionsHint] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("inko_word_bank_hide_deck_actions_hint") !== "1";
  });

  const decksQuery = useQuery({
    queryKey: authQueryKey(token, "decks"),
    queryFn: () => api.listDecks(token ?? ""),
  });

  const wordsQuery = useQuery({
    queryKey: authQueryKey(token, "words-page", selectedDeckId, wordsCursor),
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
    if (!routeDeckId) {
      setSelectedDeckId("");
      return;
    }
    if (decks.length === 0) return;
    const exists = decks.some((deck) => deck.id === routeDeckId);
    if (!exists) {
      navigate("/word-bank", { replace: true });
      return;
    }
    setSelectedDeckId(routeDeckId);
  }, [routeDeckId, decks, navigate]);

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
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "decks") });
    },
  });

  const deleteDeck = useMutation({
    mutationFn: () => api.deleteDeck(token ?? "", deckToDelete!.id),
    onSuccess: async () => {
      if (selectedDeckId === deckToDelete?.id) setSelectedDeckId("");
      setShowDeleteConfirm(false);
      setDeckToDelete(null);
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "decks") });
    },
  });

  const updateDeck = useMutation({
    mutationFn: () => {
      if (!editingDeck) throw new Error("No deck being edited");
      return api.updateDeck(token ?? "", editingDeck.id, {
        name: editingDeck.name,
        language: editingDeck.language,
        archived: editingDeck.archived,
      });
    },
    onSuccess: async (deck) => {
      setShowEditDeckModal(false);
      setEditingDeck(null);
      if (selectedDeckId === deck.id) {
        await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "words-page", selectedDeckId) });
      }
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "decks") });
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
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "words-page", selectedDeckId) });
    },
  });

  const deleteWord = useMutation({
    mutationFn: (wordId: string) => api.deleteWord(token ?? "", wordId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "words-page", selectedDeckId) });
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
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "words-page", selectedDeckId) });
    },
  });

  const bulkDeleteWords = useMutation({
    mutationFn: async () => {
      if (!selectedDeckId || selectedWordIds.size === 0) return { deleted: 0, failedWordIds: [] };
      return await api.deleteWordsBatch(token ?? "", selectedDeckId, { wordIds: Array.from(selectedWordIds) });
    },
    onSuccess: async () => {
      setSelectedWordIds(new Set());
      await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "words-page", selectedDeckId) });
    },
  });

  const exportDeck = useMutation({
    mutationFn: async () => {
      if (!selectedDeckId || !activeDeck) throw new Error("No deck selected");
      const exportedWords = await fetchAllDeckWords(selectedDeckId, (deckId, options) =>
        api.listWordsPage(token ?? "", deckId, options),
      );
      downloadDeckCsv(activeDeck, exportedWords);
    },
    onMutate: () => {
      setExportError(null);
    },
    onError: () => {
      setExportError(
        t("word_bank.export.error"),
      );
    },
  });

  const publishDeck = useMutation({
    mutationFn: async () => {
      if (!selectedDeckId || !activeDeck) throw new Error(t("word_bank.publish.no_deck"));
      const publishedWords = await fetchAllDeckWords(selectedDeckId, (deckId, options) =>
        api.listWordsPage(token ?? "", deckId, options),
      );
      if (publishedWords.length === 0) throw new Error(t("word_bank.publish.empty_deck"));

      const noteTypes: CreateCommunityDeckSubmissionInput["noteTypes"] = [
        {
          name: activeDeck.name,
          fields: ["target", "reading", "meaning", "romanization", "example", "audioUrl", "tags"],
        },
      ];

      return await api.submitCommunityDeck(token ?? "", {
        title: publishDeckForm.title.trim(),
        summary: publishDeckForm.summary.trim(),
        description: publishDeckForm.description.trim(),
        language: activeDeck.language,
        difficulty: publishDeckForm.difficulty,
        sourceKind: "manual",
        sourceName: activeDeck.name,
        tags: publishDeckForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        noteTypes,
        words: publishedWords.map((word) => ({
          target: word.target,
          reading: word.reading,
          meaning: word.meaning,
          romanization: word.romanization,
          example: word.example,
          audioUrl: word.audioUrl,
          tags: word.tags ?? [],
        })),
      });
    },
    onMutate: () => {
      setPublishError(null);
      setPublishStatus(t("word_bank.publish.submitting"));
    },
    onSuccess: (submission) => {
      setShowPublishDeckModal(false);
      setPublishStatus(t("word_bank.publish.submitted", { title: submission.title }));
    },
    onError: (mutationError) => {
      setPublishStatus(null);
      setPublishError(mutationError instanceof Error ? mutationError.message : t("word_bank.publish.submit_failed"));
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
  const totalWordsCount = wordsQuery.data?.totalCount ?? null;
  const isWordsLoading = wordsQuery.isLoading;
  const showWordActionsColumn = isWordsLoading || pagedWords.length > 0;
  const wordsTableColumnCount = showWordActionsColumn ? 6 : 5;
  const canPublishDeck =
    Boolean(activeDeck) &&
    Boolean(publishDeckForm.title.trim()) &&
    Boolean(publishDeckForm.summary.trim()) &&
    Boolean(publishDeckForm.description.trim()) &&
    !publishDeck.isPending;

  useEffect(() => {
    if (!activeDeck) return;
    setPublishDeckForm((current) => ({
      title: current.title || activeDeck.name,
      summary: current.summary || t("word_bank.publish.default_summary", { name: activeDeck.name }),
      description:
        current.description ||
        t("word_bank.publish.default_description", {
          name: activeDeck.name,
          language: activeDeck.language.toUpperCase(),
        }),
      difficulty: current.difficulty,
      tags: current.tags || activeDeck.language,
    }));
  }, [activeDeck, t]);

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
    await queryClient.invalidateQueries({ queryKey: authQueryKey(token, "words-page", selectedDeckId) });
    setTimeout(() => setImportStatus(null), 4000);
  };

  const updateField = (field: keyof typeof wordForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setWordForm((prev) => ({ ...prev, [field]: e.target.value }));

  const selectDeck = (id: string) => () => {
    navigate(`/word-bank/${id}`);
    setSelectedDeckId(id);
    setWordsCursor(null);
    setWordsCursorHistory([]);
    setSelectedWordIds(new Set());
    setWordSearch("");
  };

  const modalRef = useRef<HTMLDialogElement>(null);
  const dismissDeckActionsHint = () => {
    setShowDeckActionsHint(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("inko_word_bank_hide_deck_actions_hint", "1");
    }
  };

  return (
    <div className="relative -m-5 flex min-h-full overflow-visible bg-bg-page md:-m-10 md:h-screen md:overflow-hidden">
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
              <div className="flex items-center gap-3">
                <Link
                  to="/imports/anki"
                  className="text-[11px] font-bold uppercase text-text-secondary hover:text-text-primary no-underline"
                >
                  {t("word_bank.decks.import")}
                </Link>
                <button 
                  type="button" 
                  onClick={() => setShowNewDeckModal(true)}
                  className="text-accent-orange text-[11px] font-bold uppercase hover:underline bg-transparent p-0 border-0 cursor-pointer"
                >
                  + {t("common.new")}
                </button>
              </div>
            </div>

            {showDeckActionsHint ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-page p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-text-primary">{t("word_bank.decks.create_or_import_title")}</div>
                    <div className="mt-1 text-xs leading-5 text-text-secondary">
                      {t("word_bank.decks.create_or_import_desc")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={dismissDeckActionsHint}
                    className="rounded-md border-0 bg-transparent px-1 py-0.5 text-sm text-text-secondary cursor-pointer"
                    aria-label={t("word_bank.decks.dismiss_actions_help")}
                  >
                    ×
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewDeckModal(true)}
                    className="flex-1 rounded-lg bg-bg-elevated px-3 py-2 text-xs font-bold text-text-primary border-0 cursor-pointer"
                  >
                    + {t("common.new")}
                  </button>
                  <Link
                    to="/imports/anki"
                    className="flex-1 rounded-lg bg-accent-orange px-3 py-2 text-center text-xs font-bold text-text-on-accent no-underline"
                  >
                    {t("word_bank.decks.import_anki")}
                  </Link>
                </div>
              </div>
            ) : null}
            
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
                    navigate(`/word-bank/${deck.id}`);
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
                          setEditingDeck({ id: deck.id, name: deck.name, language: deck.language, archived: deck.archived });
                          setShowEditDeckModal(true);
                        }}
                      >
                        <Pencil size={12} />
                     </button>
                     <button
                        type="button"
                        className="p-1 text-text-secondary hover:text-[var(--danger-text)] bg-transparent border-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeckToDelete({ id: deck.id, name: deck.name });
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <Trash2 size={12} />
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
                  <p className="m-0 text-[11px] text-text-secondary">{t("word_bank.import.format_hint")}</p>
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
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-page overflow-hidden">
                        <div className="border-b border-[var(--border-subtle)] bg-bg-elevated px-3 py-2">
                          <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                            {t("word_bank.import.preview_title")}
                          </p>
                        </div>
                        <div className="max-h-56 overflow-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead className="bg-bg-elevated/60 text-text-secondary">
                              <tr>
                                {rawImportData.headers.map((header, index) => (
                                  <th key={`${header}-${index}`} className="px-3 py-2 text-left font-semibold">
                                    {header || `Column ${index + 1}`}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)]">
                              {rawImportData.rows.slice(0, 8).map((row, rowIndex) => (
                                <tr key={`preview-row-${rowIndex}`}>
                                  {rawImportData.headers.map((_, colIndex) => (
                                    <td key={`preview-cell-${rowIndex}-${colIndex}`} className="px-3 py-2 text-text-primary align-top">
                                      {row[colIndex] || "-"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
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
          aria-label={isPanelCollapsed ? t("word_bank.aria.expand_panel") : t("word_bank.aria.collapse_panel")}
        >
          <ChevronLeft 
            size={14} 
            className={`transition-transform duration-300 ${isPanelCollapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </aside>

      {/* Main Words Content Area */}
      <main className="relative flex flex-1 flex-col overflow-visible bg-bg-page md:h-full md:overflow-hidden">
        {isPanelCollapsed && (
          <button 
            type="button"
            onClick={() => setIsPanelCollapsed(false)}
            className="hidden md:flex absolute left-4 top-20 z-10 h-8 w-8 items-center justify-center rounded-lg bg-bg-card border border-[var(--border-subtle)] p-0 text-text-secondary shadow-md hover:text-text-primary cursor-pointer animate-in fade-in zoom-in-95 duration-200"
          >
            <ChevronRight size={18} />
          </button>
        )}

        <div className="flex h-full flex-col gap-8 overflow-y-visible p-5 pb-16 md:overflow-y-auto md:p-10 md:pb-10">
          <header className="flex flex-col gap-1">
            {selectedDeckId ? (
              <button
                type="button"
                onClick={() => navigate("/word-bank")}
                className="mb-3 flex w-fit items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text-secondary md:hidden"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span>{t("word_bank.decks.title")} / {activeDeck?.name ?? ""}</span>
              </button>
            ) : null}
            <h1 className="m-0 text-3xl font-semibold [font-family:var(--font-display)]">
              {selectedDeckId ? t("word_bank.title") : activeDeck ? activeDeck.name : t("word_bank.title")}
            </h1>
            <p className={`m-0 text-sm text-text-secondary ${selectedDeckId ? "hidden md:block" : ""}`}>
              {activeDeck ? t("word_bank.decks.manage_deck", { name: activeDeck.name }) : t("word_bank.subtitle")}
            </p>
          </header>

          {!selectedDeckId ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-12 bg-bg-card rounded-2xl border border-dashed border-[var(--border-strong)]">
              <BookOpen className="mb-4 h-10 w-10 opacity-20" aria-hidden="true" />
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
                 <Link
                   to="/imports/anki"
                   className="w-full py-3 bg-accent-orange text-text-on-accent rounded-xl font-medium text-center no-underline"
                 >
                   {t("word_bank.decks.import_anki_deck")}
                 </Link>
              </div>
              <div className="hidden md:flex mt-6 flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewDeckModal(true)}
                  className="rounded-xl border border-dashed border-accent-orange bg-transparent px-4 py-3 text-sm font-medium text-accent-orange cursor-pointer"
                >
                  + {t("word_bank.decks.new_deck")}
                </button>
                <Link
                  to="/imports/anki"
                  className="rounded-xl bg-accent-orange px-4 py-3 text-sm font-medium text-text-on-accent no-underline"
                >
                  {t("word_bank.decks.import_anki_deck")}
                </Link>
              </div>
            </div>
          ) : (
            <section className="flex flex-1 min-h-0 flex-col gap-6">
              <div className="flex flex-1 min-h-0 flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
                    <input
                      type="text"
                      placeholder={t("word_bank.words.search_placeholder")}
                      value={wordSearch}
                      onChange={(e) => setWordSearch(e.target.value)}
                      className="w-full pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 bg-bg-elevated px-3 py-1.5 text-xs rounded-lg border-0 cursor-pointer text-text-primary hover:bg-bg-hover transition-colors"
                      onClick={() => setShowPublishDeckModal(true)}
                      disabled={isWordsLoading || totalWordsCount === 0}
                    >
                      <span>{t("word_bank.publish.button")}</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 bg-bg-elevated px-3 py-1.5 text-xs rounded-lg border-0 cursor-pointer text-text-primary hover:bg-bg-hover transition-colors"
                      onClick={() => exportDeck.mutate()}
                      disabled={exportDeck.isPending || isWordsLoading || totalWordsCount === 0}
                    >
                      <Download size={14} aria-hidden="true" />
                      <span>
                        {exportDeck.isPending
                          ? t("word_bank.export.downloading")
                          : t("word_bank.export.button")}
                      </span>
                    </button>
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
                    <span className="text-xs text-text-secondary">
                      {totalWordsCount === null
                        ? t("word_bank.words.page_summary_no_total", { page: wordsPageLabel, shown: pagedWords.length })
                        : t("word_bank.words.page_summary", { page: wordsPageLabel, shown: pagedWords.length, total: totalWordsCount })}
                    </span>
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

                {exportError ? <p className="m-0 text-sm text-[var(--danger-text)]">{exportError}</p> : null}
                {publishStatus ? <p className="m-0 text-sm text-accent-teal">{publishStatus}</p> : null}
                {publishError ? <p className="m-0 text-sm text-[var(--danger-text)]">{publishError}</p> : null}

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

                <div className="flex flex-1 min-h-0 rounded-2xl border border-[var(--border-subtle)] bg-bg-card overflow-hidden shadow-sm">
                  <div className="h-full w-full overflow-y-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-bg-elevated text-text-secondary border-b border-[var(--border-subtle)]">
                      <tr>
                        <th className="sticky top-0 z-20 w-12 px-4 py-3 text-left bg-bg-elevated">
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
                        <th className="sticky top-0 z-20 px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px] bg-bg-elevated">{t("word_bank.words.target")}</th>
                        <th className="sticky top-0 z-20 px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px] md:table-cell hidden bg-bg-elevated">{t("word_bank.words.reading")}</th>
                        <th className="sticky top-0 z-20 px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px] bg-bg-elevated">{t("word_bank.words.meaning")}</th>
                        <th className="sticky top-0 z-20 px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px] lg:table-cell hidden bg-bg-elevated">{t("word_bank.add.tags")}</th>
                        {showWordActionsColumn ? <th className="sticky top-0 z-20 w-20 px-4 py-3 bg-bg-elevated"></th> : null}
                      </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                      {isWordsLoading ? (
                        <tr>
                          <td className="px-4 py-10 text-center text-text-secondary" colSpan={wordsTableColumnCount}>
                            {t("common.loading")}
                          </td>
                        </tr>
                      ) : pagedWords.length === 0 ? (
                        <tr>
                          <td className="h-56 px-4 text-center align-middle text-text-secondary" colSpan={wordsTableColumnCount}>
                            <p className="m-0">{t("word_bank.words.no_words")}</p>
                          </td>
                        </tr>
                      ) : pagedWords.map((word: any) => (
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
                          <td className="px-4 py-4 text-text-secondary lg:table-cell hidden max-w-[240px] truncate">{(word.tags ?? []).length > 0 ? word.tags.join(", ") : "-"}</td>
                          {showWordActionsColumn ? (
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
                          ) : null}
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>
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
          onClick={() => setShowMobileAddModal(true)}
          aria-label={t("word_bank.aria.add_word")}
        >
          <span className="text-3xl font-light">+</span>
        </button>
      )}

      {showMobileAddModal && selectedDeckId && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center p-0 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowMobileAddModal(false)}
          />
          <dialog className="relative z-[1010] flex w-full max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-2xl border border-[var(--border-subtle)] bg-bg-card p-5" open>
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-lg font-semibold">{t("word_bank.add.title_short")}</h2>
              <button type="button" className="border-0 bg-transparent p-1 text-text-secondary" onClick={() => setShowMobileAddModal(false)}>×</button>
            </div>
            <div className="flex flex-col gap-3">
              <input
                className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors"
                placeholder={t("word_bank.add.target_placeholder", { example: isJapaneseDeck ? "勉強" : "palabra" })}
                value={wordForm.target}
                onChange={updateField("target")}
              />
              <input
                className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors"
                placeholder={t("word_bank.add.meaning_placeholder")}
                value={wordForm.meaning}
                onChange={updateField("meaning")}
              />
              <input
                className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors"
                placeholder={t("word_bank.add.reading")}
                value={wordForm.reading}
                onChange={updateField("reading")}
              />
              <input
                className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors"
                placeholder={t("word_bank.add.romanization")}
                value={wordForm.romanization}
                onChange={updateField("romanization")}
              />
              <textarea
                className="min-h-[84px] text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors resize-none"
                placeholder={t("word_bank.add.example")}
                value={wordForm.example}
                onChange={updateField("example")}
              />
              <input
                className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors"
                placeholder={t("word_bank.add.audio_url")}
                value={wordForm.audioUrl}
                onChange={updateField("audioUrl")}
              />
              <input
                className="text-sm py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none transition-colors"
                placeholder={t("word_bank.add.tags")}
                value={wordForm.tags}
                onChange={updateField("tags")}
              />
              <button
                type="button"
                className="mt-1 w-full py-2.5 text-sm bg-accent-orange text-text-on-accent border-0 rounded-lg font-bold cursor-pointer"
                onClick={() => createWord.mutate(undefined, { onSuccess: () => setShowMobileAddModal(false) })}
                disabled={!wordForm.target || !wordForm.meaning || createWord.isPending}
              >
                {t("word_bank.add.submit")}
              </button>
            </div>
          </dialog>
        </div>
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
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor={`${formId}-edit-deck-name`}>{t("word_bank.new_deck.name")}</label>
                <input
                  id={`${formId}-edit-deck-name`}
                  className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none"
                  value={editingDeck.name}
                  onChange={(e) => setEditingDeck({ ...editingDeck, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor={`${formId}-edit-deck-language`}>{t("word_bank.new_deck.language")}</label>
                <select
                  id={`${formId}-edit-deck-language`}
                  className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none"
                  value={editingDeck.language}
                  onChange={(e) => setEditingDeck({ ...editingDeck, language: e.target.value as LanguageCode })}
                >
                  {SUPPORTED_LANGUAGES.map((code) => (
                    <option key={code} value={code}>
                      {LANGUAGE_LABELS[code]} ({code.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="bg-bg-elevated text-text-primary px-5 py-2 rounded-lg border-0 cursor-pointer" onClick={() => setShowEditDeckModal(false)}>{t("common.cancel")}</button>
              <button
                type="button"
                className="bg-accent-orange text-text-on-accent px-5 py-2 rounded-lg border-0 font-bold cursor-pointer"
                onClick={() => updateDeck.mutate()}
                disabled={!editingDeck.name.trim() || updateDeck.isPending}
              >
                {t("common.save")}
              </button>
            </div>
          </dialog>
        </div>
      )}

      {showPublishDeckModal && activeDeck && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm border-0"
            onClick={() => setShowPublishDeckModal(false)}
          />
          <dialog className="relative z-[1010] flex w-full max-w-[560px] flex-col gap-6 rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-8 shadow-2xl" open>
            <h2 className="m-0 text-2xl font-semibold [font-family:var(--font-display)]">{t("word_bank.publish.title")}</h2>
            <p className="m-0 text-sm leading-relaxed text-text-secondary">{t("word_bank.publish.description")}</p>
            <div className="grid gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">{t("word_bank.publish.deck")}</label>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-bg-page px-3 py-2 text-sm text-text-primary">
                  {activeDeck.name} ({activeDeck.language.toUpperCase()})
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor={`${formId}-publish-title`}>{t("word_bank.publish.form.title")}</label>
                <input
                  id={`${formId}-publish-title`}
                  className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none"
                  value={publishDeckForm.title}
                  onChange={(e) => setPublishDeckForm((current) => ({ ...current, title: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor={`${formId}-publish-summary`}>{t("word_bank.publish.form.summary")}</label>
                <input
                  id={`${formId}-publish-summary`}
                  className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none"
                  value={publishDeckForm.summary}
                  onChange={(e) => setPublishDeckForm((current) => ({ ...current, summary: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor={`${formId}-publish-description`}>{t("word_bank.publish.form.description")}</label>
                <textarea
                  id={`${formId}-publish-description`}
                  className="min-h-[100px] p-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none resize-none"
                  value={publishDeckForm.description}
                  onChange={(e) => setPublishDeckForm((current) => ({ ...current, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor={`${formId}-publish-difficulty`}>{t("word_bank.publish.form.difficulty")}</label>
                  <select
                    id={`${formId}-publish-difficulty`}
                    className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none"
                    value={publishDeckForm.difficulty}
                    onChange={(e) => setPublishDeckForm((current) => ({ ...current, difficulty: e.target.value as PublishDeckForm["difficulty"] }))}
                  >
                    <option value="Beginner">{t("importer.difficulty.beginner")}</option>
                    <option value="Intermediate">{t("importer.difficulty.intermediate")}</option>
                    <option value="Advanced">{t("importer.difficulty.advanced")}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor={`${formId}-publish-tags`}>{t("word_bank.publish.form.tags")}</label>
                  <input
                    id={`${formId}-publish-tags`}
                    className="py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-bg-page focus:border-accent-orange outline-none"
                    value={publishDeckForm.tags}
                    onChange={(e) => setPublishDeckForm((current) => ({ ...current, tags: e.target.value }))}
                    placeholder={t("word_bank.publish.form.tags_placeholder")}
                  />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-page px-4 py-3 text-sm text-text-secondary">
              {t("word_bank.publish.review_note")}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="bg-bg-elevated text-text-primary px-5 py-2 rounded-lg border-0 cursor-pointer"
                onClick={() => setShowPublishDeckModal(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="bg-accent-orange text-text-on-accent px-5 py-2 rounded-lg border-0 font-bold cursor-pointer disabled:opacity-60"
                onClick={() => publishDeck.mutate()}
                disabled={!canPublishDeck}
              >
                {publishDeck.isPending ? t("word_bank.publish.submitting") : t("word_bank.publish.submit")}
              </button>
            </div>
          </dialog>
        </div>
      )}

      {showDeleteConfirm && deckToDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm border-0"
            onClick={() => {
              setShowDeleteConfirm(false);
              setDeckToDelete(null);
            }}
          />
          <dialog className="relative z-[1010] flex w-full max-w-[420px] flex-col gap-6 rounded-2xl border border-[var(--border-subtle)] bg-bg-card p-8 shadow-2xl" open>
            <h2 className="m-0 text-2xl font-semibold [font-family:var(--font-display)]">{t("word_bank.delete_deck.title")}</h2>
            <p className="m-0 text-sm leading-relaxed text-text-secondary">
              {t("word_bank.delete_deck.confirm", { name: deckToDelete.name })}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="bg-bg-elevated text-text-primary px-5 py-2 rounded-lg border-0 cursor-pointer"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeckToDelete(null);
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="bg-[var(--danger-bg)] text-[var(--danger-text)] px-5 py-2 rounded-lg border-0 font-bold cursor-pointer"
                onClick={() => deleteDeck.mutate()}
                disabled={deleteDeck.isPending}
              >
                {t("word_bank.decks.delete_deck")}
              </button>
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
