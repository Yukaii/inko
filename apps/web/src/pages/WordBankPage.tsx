import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";

export function WordBankPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [deckName, setDeckName] = useState("Core N5");
  const [wordForm, setWordForm] = useState({
    target: "勉強",
    reading: "べんきょう",
    romanization: "benkyou",
    meaning: "study; learning",
    example: "毎日日本語を勉強しています。",
    audioUrl: "",
    tags: "n5",
  });

  const decksQuery = useQuery({
    queryKey: ["decks"],
    queryFn: () => api.listDecks(token!),
  });

  const wordsQuery = useQuery({
    queryKey: ["words", selectedDeckId],
    enabled: !!selectedDeckId,
    queryFn: () => api.listWords(token!, selectedDeckId),
  });

  const createDeck = useMutation({
    mutationFn: () => api.createDeck(token!, { name: deckName, language: "ja" }),
    onSuccess: async (deck) => {
      setSelectedDeckId(deck.id);
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
  });

  const createWord = useMutation({
    mutationFn: () =>
      api.createWord(token!, selectedDeckId, {
        target: wordForm.target,
        reading: wordForm.reading,
        romanization: wordForm.romanization,
        meaning: wordForm.meaning,
        example: wordForm.example,
        audioUrl: wordForm.audioUrl || undefined,
        tags: wordForm.tags.split(",").map((x) => x.trim()).filter(Boolean),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["words", selectedDeckId] });
    },
  });

  const decks = decksQuery.data ?? [];

  const activeDeck = useMemo(() => decks.find((deck) => deck.id === selectedDeckId), [decks, selectedDeckId]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 42 }}>Word Bank</h1>

      <section className="card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Create Deck</h2>
        <div className="form-row">
          <input value={deckName} onChange={(event) => setDeckName(event.target.value)} />
          <button onClick={() => createDeck.mutate()}>Create Deck</button>
        </div>
      </section>

      <section className="card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Decks</h2>
        <select value={selectedDeckId} onChange={(event) => setSelectedDeckId(event.target.value)}>
          <option value="">Select deck</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name}
            </option>
          ))}
        </select>
        {activeDeck ? (
          <Link to={`/practice/${activeDeck.id}`}>
            <button>Start Practice</button>
          </Link>
        ) : null}
      </section>

      {selectedDeckId ? (
        <section className="card" style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Add Word</h2>
          <div className="form-row">
            <input
              placeholder="target"
              value={wordForm.target}
              onChange={(event) => setWordForm((prev) => ({ ...prev, target: event.target.value }))}
            />
            <input
              placeholder="reading"
              value={wordForm.reading}
              onChange={(event) => setWordForm((prev) => ({ ...prev, reading: event.target.value }))}
            />
          </div>
          <div className="form-row">
            <input
              placeholder="romanization"
              value={wordForm.romanization}
              onChange={(event) => setWordForm((prev) => ({ ...prev, romanization: event.target.value }))}
            />
            <input
              placeholder="meaning"
              value={wordForm.meaning}
              onChange={(event) => setWordForm((prev) => ({ ...prev, meaning: event.target.value }))}
            />
          </div>
          <textarea
            placeholder="example"
            value={wordForm.example}
            onChange={(event) => setWordForm((prev) => ({ ...prev, example: event.target.value }))}
          />
          <div className="form-row">
            <input
              placeholder="audio url"
              value={wordForm.audioUrl}
              onChange={(event) => setWordForm((prev) => ({ ...prev, audioUrl: event.target.value }))}
            />
            <input
              placeholder="tags comma separated"
              value={wordForm.tags}
              onChange={(event) => setWordForm((prev) => ({ ...prev, tags: event.target.value }))}
            />
          </div>
          <button onClick={() => createWord.mutate()}>Add Word</button>
        </section>
      ) : null}

      <section className="card" style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Words</h2>
        {wordsQuery.data?.map((word) => (
          <div key={word.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>
              {word.target} ({word.reading ?? "-"}) - {word.meaning}
            </span>
            <button className="secondary" onClick={() => api.deleteWord(token!, word.id).then(() => wordsQuery.refetch())}>
              Delete
            </button>
          </div>
        ))}
        {selectedDeckId && !wordsQuery.data?.length ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No words yet.</p>
        ) : null}
      </section>
    </div>
  );
}
