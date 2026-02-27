import { useCallback, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";

type AddTab = "single" | "import";

export function WordBankPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const formId = useId();

  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [addTab, setAddTab] = useState<AddTab>("single");
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

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
  const handleBulkImport = useCallback(async () => {
    if (!selectedDeckId || !importText.trim()) return;
    setImportStatus("Importing...");

    const lines = importText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let imported = 0;
    let failed = 0;

    for (const line of lines) {
      // Support tab-separated or comma-separated: target, reading, meaning
      const parts = line.includes("\t") ? line.split("\t") : line.split(",");
      const [target, reading, meaning] = parts.map((p) => p.trim());

      if (!target || !meaning) {
        failed++;
        continue;
      }

      try {
        await api.createWord(token ?? "", selectedDeckId, {
          target,
          reading: reading || undefined,
          meaning,
          tags: [],
        });
        imported++;
      } catch {
        failed++;
      }
    }

    setImportText("");
    setImportStatus(`Done: ${imported} imported${failed ? `, ${failed} failed` : ""}`);
    await queryClient.invalidateQueries({ queryKey: ["words", selectedDeckId] });
    setTimeout(() => setImportStatus(null), 4000);
  }, [selectedDeckId, importText, token, queryClient]);

  // ---- field updater ----
  const updateField = (field: keyof typeof wordForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setWordForm((prev) => ({ ...prev, [field]: e.target.value }));

  const selectDeck = (id: string) => () => setSelectedDeckId(id);

  return (
    <div style={{ display: "grid", gap: 28 }}>
      {/* ---- Page header ---- */}
      <header>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 42 }}>Word Bank</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
          Manage your decks and vocabulary
        </p>
      </header>

      {/* ---- Deck grid ---- */}
      <section>
        <div className="section-header" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22 }}>Decks</h2>
        </div>

        <div className="deck-grid">
          {decks.map((deck) => (
            <button
              type="button"
              key={deck.id}
              className={`deck-card${selectedDeckId === deck.id ? " selected" : ""}`}
              onClick={selectDeck(deck.id)}
            >
              <h3 className="deck-card-name">{deck.name}</h3>
              <div className="deck-card-meta">
                <span>{deck.language.toUpperCase()}</span>
                {deck.archived && <span>archived</span>}
              </div>
              <div className="deck-card-actions">
                <Link to={`/practice/${deck.id}`} onClick={(e) => e.stopPropagation()} style={{ flex: 1 }}>
                  <button type="button" style={{ width: "100%" }}>Practice</button>
                </Link>
                <button
                  type="button"
                  className="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDeckId(deck.id);
                  }}
                >
                  Edit
                </button>
              </div>
            </button>
          ))}

          {/* New deck card */}
          <button
            type="button"
            className="deck-card-new"
            onClick={() => setShowNewDeckModal(true)}
          >
            <span className="plus">+</span>
            <span style={{ fontSize: 13 }}>New Deck</span>
          </button>
        </div>
      </section>

      {/* ---- Add words section (only when deck selected) ---- */}
      {selectedDeckId && (
        <section className="card" style={{ display: "grid", gap: 16 }}>
          <div className="section-header">
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22 }}>
              Add Words to {activeDeck?.name ?? "Deck"}
            </h2>
          </div>

          {/* Tabs */}
          <div className="tab-bar">
            <button type="button" className={addTab === "single" ? "active" : ""} onClick={() => setAddTab("single")}>
              Single Word
            </button>
            <button type="button" className={addTab === "import" ? "active" : ""} onClick={() => setAddTab("import")}>
              Bulk Import
            </button>
          </div>

          {addTab === "single" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor={`${formId}-target`}>Target word</label>
                  <input id={`${formId}-target`} placeholder="e.g. 勉強" value={wordForm.target} onChange={updateField("target")} />
                </div>
                <div className="form-group">
                  <label htmlFor={`${formId}-meaning`}>Meaning</label>
                  <input id={`${formId}-meaning`} placeholder="e.g. study; learning" value={wordForm.meaning} onChange={updateField("meaning")} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor={`${formId}-reading`}>Reading</label>
                  <input id={`${formId}-reading`} placeholder="e.g. べんきょう" value={wordForm.reading} onChange={updateField("reading")} />
                </div>
                <div className="form-group">
                  <label htmlFor={`${formId}-romanization`}>Romanization</label>
                  <input id={`${formId}-romanization`} placeholder="e.g. benkyou" value={wordForm.romanization} onChange={updateField("romanization")} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor={`${formId}-example`}>Example sentence</label>
                <input id={`${formId}-example`} placeholder="e.g. 毎日日本語を勉強しています。" value={wordForm.example} onChange={updateField("example")} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor={`${formId}-audio`}>Audio URL (optional)</label>
                  <input id={`${formId}-audio`} placeholder="https://..." value={wordForm.audioUrl} onChange={updateField("audioUrl")} />
                </div>
                <div className="form-group">
                  <label htmlFor={`${formId}-tags`}>Tags (comma separated)</label>
                  <input id={`${formId}-tags`} placeholder="e.g. n5, verb" value={wordForm.tags} onChange={updateField("tags")} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => createWord.mutate()}
                disabled={!wordForm.target || !wordForm.meaning || createWord.isPending}
              >
                {createWord.isPending ? "Adding..." : "Add Word"}
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
                Paste words below, one per line. Format: <code>target, reading, meaning</code> (tab or comma separated).
              </p>
              <textarea
                className="import-area"
                placeholder={"食べる\tたべる\tto eat\n飲む\tのむ\tto drink\n読む\tよむ\tto read"}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              {importStatus && (
                <p style={{ margin: 0, color: "var(--accent-teal)", fontSize: 13 }}>{importStatus}</p>
              )}
              <button type="button" onClick={handleBulkImport} disabled={!importText.trim()}>
                Import Words
              </button>
            </div>
          )}
        </section>
      )}

      {/* ---- Words list ---- */}
      {selectedDeckId && (
        <section className="card" style={{ display: "grid", gap: 12 }}>
          <div className="section-header">
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22 }}>
              Words ({words.length})
            </h2>
          </div>

          {words.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table className="word-table">
                <thead>
                  <tr>
                    <th>Word</th>
                    <th>Reading</th>
                    <th>Meaning</th>
                    <th>Tags</th>
                    <th style={{ width: 60 }}>{" "}</th>
                  </tr>
                </thead>
                <tbody>
                  {words.map((word) => (
                    <tr key={word.id}>
                      <td className="target-cell">{word.target}</td>
                      <td className="reading-cell">{word.reading ?? "-"}</td>
                      <td>{word.meaning}</td>
                      <td>
                        <div className="word-table tags-cell">
                          {(word.tags ?? []).map((t: string) => (
                            <span key={t} className="tag">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="danger sm"
                          onClick={() => deleteWord.mutate(word.id)}
                          disabled={deleteWord.isPending}
                        >
                          Del
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No words yet.</p>
              <p style={{ fontSize: 13 }}>Add words using the form above or bulk-import from a spreadsheet.</p>
            </div>
          )}
        </section>
      )}

      {/* ---- No deck selected hint ---- */}
      {!selectedDeckId && decks.length > 0 && (
        <div className="card empty-state">
          <p>Select a deck above to view and manage its words.</p>
        </div>
      )}

      {/* ---- New Deck Modal ---- */}
      {showNewDeckModal && (
        <>
          <button
            type="button"
            className="modal-overlay"
            onClick={() => setShowNewDeckModal(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setShowNewDeckModal(false); }}
          />
          <dialog
            open
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") setShowNewDeckModal(false); }}
          >
            <h2>Create New Deck</h2>
            <div className="form-group">
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
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowNewDeckModal(false)}>
                Cancel
              </button>
              <button type="button" onClick={() => createDeck.mutate()} disabled={!newDeckName.trim() || createDeck.isPending}>
                {createDeck.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
