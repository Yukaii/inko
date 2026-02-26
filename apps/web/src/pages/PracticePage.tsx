import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { HandwritingCanvas } from "../components/HandwritingCanvas.js";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";
import { normalizeJapaneseInput } from "@inko/shared";

export function canSubmitCard(input: {
  handwritingCompleted: boolean;
  typingInput: string;
  expected: string;
  reading?: string;
  audioPlayed: boolean;
}) {
  if (!input.handwritingCompleted || !input.audioPlayed) return false;
  const normalized = normalizeJapaneseInput(input.typingInput);
  return normalized === normalizeJapaneseInput(input.expected) ||
    (!!input.reading && normalized === normalizeJapaneseInput(input.reading));
}

export function PracticePage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { token } = useAuth();

  const [sessionId, setSessionId] = useState("");
  const [card, setCard] = useState<any | null>(null);
  const [handwritingDone, setHandwritingDone] = useState(false);
  const [typingInput, setTypingInput] = useState("");
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [listeningConfidence, setListeningConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [result, setResult] = useState<string>("");
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!deckId) return;
    api.startPractice(token!, deckId).then((res) => {
      setSessionId(res.sessionId);
      setCard(res.card);
      startedAtRef.current = Date.now();
    });
  }, [deckId, token]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!card) throw new Error("No card");
      return api.submitPractice(token!, sessionId, card.wordId, {
        handwritingCompleted: handwritingDone,
        typingInput,
        typingMs: Date.now() - startedAtRef.current,
        audioPlayed,
        listeningConfidence,
      });
    },
    onSuccess: (res) => {
      setResult(
        res.accepted
          ? `Accepted: shape ${res.scores.shape}, typing ${res.scores.typing}, listening ${res.scores.listening}`
          : "Rejected: complete handwriting, typing and audio first",
      );
    },
  });

  const finishMutation = useMutation({
    mutationFn: () => api.finishPractice(token!, sessionId),
    onSuccess: (summary) => {
      setResult(`Session done: ${summary.cardsCompleted} cards, avg typing ${summary.avgTypingScore}`);
    },
  });

  const submitEnabled = useMemo(() => {
    if (!card) return false;
    return canSubmitCard({
      handwritingCompleted: handwritingDone,
      typingInput,
      expected: card.target,
      reading: card.reading,
      audioPlayed,
    });
  }, [audioPlayed, card, handwritingDone, typingInput]);

  if (!card) {
    return <p>Loading card...</p>;
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ marginBottom: 6, color: "var(--text-secondary)" }}>// triple_input_mode</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 42 }}>Practice Session</h1>
        </div>
        <button className="secondary" onClick={() => finishMutation.mutate()}>
          Finish Session
        </button>
      </header>

      <section className="card" style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-jp)", fontSize: 56 }}>{card.target}</div>
          <div style={{ color: "var(--accent-orange)", fontFamily: "var(--font-jp)" }}>{card.reading}</div>
          <div style={{ color: "var(--text-secondary)" }}>{card.romanization}</div>
        </div>
        <div style={{ maxWidth: 340 }}>
          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>meaning</div>
          <div>{card.meaning}</div>
          <div style={{ color: "var(--text-secondary)", marginTop: 12, fontSize: 12 }}>example</div>
          <div style={{ color: "var(--text-secondary)", fontFamily: "var(--font-jp)" }}>{card.example}</div>
        </div>
      </section>

      <section className="practice-grid">
        <HandwritingCanvas onChanged={setHandwritingDone} />

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ display: "grid", gap: 10 }}>
            <strong>IME Typing</strong>
            <input
              value={typingInput}
              onChange={(event) => setTypingInput(event.target.value)}
              placeholder="Type target word or reading"
            />
          </div>

          <div className="card" style={{ display: "grid", gap: 10 }}>
            <strong>Audio</strong>
            {card.audioUrl ? (
              <audio controls src={card.audioUrl} onPlay={() => setAudioPlayed(true)} style={{ width: "100%" }} />
            ) : (
              <button className="secondary" onClick={() => setAudioPlayed(true)}>
                Mark Audio Played
              </button>
            )}
            <label>
              Listening confidence
              <select
                value={listeningConfidence}
                onChange={(event) => setListeningConfidence(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 20 }}>
          <span>shape: {handwritingDone ? "ready" : "pending"}</span>
          <span>typing: {typingInput ? "in progress" : "pending"}</span>
          <span>listening: {audioPlayed ? "ready" : "pending"}</span>
        </div>
        <button onClick={() => submitMutation.mutate()} disabled={!submitEnabled || submitMutation.isPending}>
          submit_card
        </button>
      </section>

      {result ? <p style={{ color: "var(--accent-teal)", margin: 0 }}>{result}</p> : null}
    </div>
  );
}
