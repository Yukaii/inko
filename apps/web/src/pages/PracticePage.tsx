import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { HandwritingCanvas } from "../components/HandwritingCanvas.js";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";
import { normalizeJapaneseInput } from "@inko/shared";

type PracticeCard = {
  wordId: string;
  target: string;
  reading?: string;
  romanization?: string;
  meaning?: string;
  example?: string;
  audioUrl?: string;
};

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

export function getTypingFeedback(input: { typingInput: string; expected: string; reading?: string }) {
  const typed = normalizeJapaneseInput(input.typingInput);
  const candidates = [normalizeJapaneseInput(input.expected), input.reading ? normalizeJapaneseInput(input.reading) : ""].filter(
    Boolean,
  );

  const defaultTarget = candidates[0] ?? "";
  if (!typed || !defaultTarget) {
    return {
      target: defaultTarget,
      matchedChars: 0,
      accuracy: 100,
      progress: 0,
      onTrack: true,
      complete: false,
      currentStreak: 0,
    };
  }

  let bestTarget = defaultTarget;
  let bestMatchedChars = 0;
  for (const candidate of candidates) {
    let matchedChars = 0;
    const limit = Math.min(typed.length, candidate.length);
    while (matchedChars < limit && typed[matchedChars] === candidate[matchedChars]) {
      matchedChars += 1;
    }

    if (matchedChars > bestMatchedChars) {
      bestMatchedChars = matchedChars;
      bestTarget = candidate;
    }
  }

  const onTrack = typed.startsWith(bestTarget.slice(0, typed.length));
  const complete = typed === bestTarget;
  const accuracy = typed.length === 0 ? 100 : Math.round((bestMatchedChars / typed.length) * 100);
  const progress = bestTarget.length === 0 ? 0 : Math.min(100, Math.round((bestMatchedChars / bestTarget.length) * 100));

  return {
    target: bestTarget,
    matchedChars: bestMatchedChars,
    accuracy,
    progress,
    onTrack,
    complete,
    currentStreak: onTrack ? typed.length : 0,
  };
}

export function PracticePage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { token } = useAuth();

  const [sessionId, setSessionId] = useState("");
  const [card, setCard] = useState<PracticeCard | null>(null);
  const [handwritingDone, setHandwritingDone] = useState(false);
  const [typingInput, setTypingInput] = useState("");
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [listeningConfidence, setListeningConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [result, setResult] = useState<string>("");
  const [cardStreak, setCardStreak] = useState(0);
  const [bestCardStreak, setBestCardStreak] = useState(0);
  const [lastSubmitAccepted, setLastSubmitAccepted] = useState<boolean | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!deckId || !token) return;
    api.startPractice(token, deckId).then((res) => {
      setSessionId(res.sessionId);
      setCard(res.card as PracticeCard);
      startedAtRef.current = Date.now();
    });
  }, [deckId, token]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!card) throw new Error("No card");
      if (!token) throw new Error("Not authenticated");
      return api.submitPractice(token, sessionId, card.wordId, {
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

      if (res.accepted) {
        setLastSubmitAccepted(true);
        setCardStreak((prev) => {
          const next = prev + 1;
          setBestCardStreak((best) => Math.max(best, next));
          return next;
        });
        setHandwritingDone(false);
        setTypingInput("");
        setAudioPlayed(false);
        setListeningConfidence(3);
        startedAtRef.current = Date.now();
      } else {
        setLastSubmitAccepted(false);
        setCardStreak(0);
      }
    },
  });

  const finishMutation = useMutation({
    mutationFn: () => {
      if (!token) throw new Error("Not authenticated");
      return api.finishPractice(token, sessionId);
    },
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

  const typingFeedback = useMemo(() => {
    if (!card) {
      return {
        target: "",
        matchedChars: 0,
        accuracy: 100,
        progress: 0,
        onTrack: true,
        complete: false,
        currentStreak: 0,
      };
    }

    return getTypingFeedback({
      typingInput,
      expected: card.target,
      reading: card.reading,
    });
  }, [card, typingInput]);

  const typingSpeed = useMemo(() => {
    const elapsedMs = Math.max(1, Date.now() - startedAtRef.current);
    const typed = normalizeJapaneseInput(typingInput).length;
    return Math.round((typed * 60000) / elapsedMs);
  }, [typingInput]);

  if (!card) {
    return <p>Loading card...</p>;
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ marginBottom: 6, color: "var(--text-secondary)" }}>triple_input_mode</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 42 }}>Practice Session</h1>
        </div>
        <button type="button" className="secondary" onClick={() => finishMutation.mutate()}>
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
            <div className="typing-feedback" aria-live="polite">
              <div className="typing-feedback-topline">
                <span>{typingFeedback.complete ? "locked_in" : typingFeedback.onTrack ? "on_track" : "mistyped"}</span>
                <span>{typingFeedback.progress}%</span>
              </div>
              <div className="typing-progress-track" aria-hidden="true">
                <div className="typing-progress-fill" style={{ width: `${typingFeedback.progress}%` }} />
              </div>
              <div className="typing-feedback-metrics">
                <span>char streak: {typingFeedback.currentStreak}</span>
                <span>accuracy: {typingFeedback.accuracy}%</span>
                <span>speed: {typingSpeed} cpm</span>
              </div>
              <div className="typing-feedback-target">target: {typingFeedback.target || "-"}</div>
            </div>
          </div>

          <div className="card" style={{ display: "grid", gap: 10 }}>
            <strong>Audio</strong>
            {card.audioUrl ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const player = new Audio(card.audioUrl);
                  void player.play();
                  setAudioPlayed(true);
                }}
              >
                Play Audio
              </button>
            ) : (
              <button type="button" className="secondary" onClick={() => setAudioPlayed(true)}>
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
          <span>
            typing: {typingInput ? (typingFeedback.onTrack ? "locked" : "fix input") : "pending"}
          </span>
          <span>listening: {audioPlayed ? "ready" : "pending"}</span>
        </div>
        <button type="button" onClick={() => submitMutation.mutate()} disabled={!submitEnabled || submitMutation.isPending}>
          submit_card
        </button>
      </section>

      <section className="card streak-card">
        <div className="streak-headline">
          <span>continuous streak</span>
          <strong>{cardStreak}</strong>
        </div>
        <div className="streak-meta">
          <span>best run: {bestCardStreak}</span>
          <span>
            last: {lastSubmitAccepted === null ? "-" : lastSubmitAccepted ? "accepted" : "reset"}
          </span>
        </div>
      </section>

      {result ? <p style={{ color: "var(--accent-teal)", margin: 0 }}>{result}</p> : null}
    </div>
  );
}
