import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";
import { isJapaneseTypingMatch, normalizeJapaneseInput, romajiToHiragana } from "@inko/shared";

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
  typingInput: string;
  expected: string;
  reading?: string;
  romanization?: string;
}) {
  return isJapaneseTypingMatch(input.typingInput, input.expected, input.reading, input.romanization);
}

export function getTypingFeedback(input: { typingInput: string; expected: string; reading?: string; romanization?: string }) {
  const typedRomaji = normalizeJapaneseInput(input.typingInput).toLowerCase();
  const typedKana = romajiToHiragana(typedRomaji);
  const romajiTarget = input.romanization ? normalizeJapaneseInput(input.romanization).toLowerCase() : "";
  const readingTarget = input.reading ? normalizeJapaneseInput(input.reading) : "";
  const fallbackTarget = normalizeJapaneseInput(input.expected);

  const target = romajiTarget || readingTarget || fallbackTarget;
  const source = romajiTarget ? typedRomaji : readingTarget ? typedKana : normalizeJapaneseInput(input.typingInput);

  if (!source || !target) {
    return {
      target,
      matchedChars: 0,
      accuracy: 100,
      progress: 0,
      onTrack: true,
      complete: false,
      currentStreak: 0,
    };
  }

  let matchedChars = 0;
  const limit = Math.min(source.length, target.length);
  while (matchedChars < limit && source[matchedChars] === target[matchedChars]) {
    matchedChars += 1;
  }

  const onTrack = target.startsWith(source);
  const complete = source === target;
  const accuracy = source.length === 0 ? 100 : Math.round((matchedChars / source.length) * 100);
  const progress = target.length === 0 ? 0 : Math.min(100, Math.round((matchedChars / target.length) * 100));

  return {
    target,
    matchedChars,
    accuracy,
    progress,
    onTrack,
    complete,
    currentStreak: onTrack ? source.length : 0,
  };
}

export function PracticePage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { token } = useAuth();

  const [sessionId, setSessionId] = useState("");
  const [card, setCard] = useState<PracticeCard | null>(null);
  const [typingInput, setTypingInput] = useState("");
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
        handwritingCompleted: true,
        typingInput,
        typingMs: Date.now() - startedAtRef.current,
        audioPlayed: true,
        listeningConfidence: 3,
      });
    },
    onSuccess: (res) => {
      setResult(
        res.accepted
          ? `Accepted: shape ${res.scores.shape}, typing ${res.scores.typing}, listening ${res.scores.listening}`
          : "Rejected: typing does not match target",
      );

      if (res.accepted) {
        setLastSubmitAccepted(true);
        setCardStreak((prev) => {
          const next = prev + 1;
          setBestCardStreak((best) => Math.max(best, next));
          return next;
        });
        setTypingInput("");
        if (res.nextCard) {
          setCard(res.nextCard as PracticeCard);
        } else {
          finishMutation.mutate();
        }
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
      typingInput,
      expected: card.target,
      reading: card.reading,
      romanization: card.romanization,
    });
  }, [card, typingInput]);

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
      romanization: card.romanization,
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

      <section className="card" style={{ display: "grid", gap: 10 }}>
        <strong>IME Typing</strong>
        <input
          value={typingInput}
          onChange={(event) => setTypingInput(event.target.value)}
          placeholder="Type romaji (lowercase)"
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
      </section>

      <section className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 20 }}>
          <span>typing: {typingInput ? (typingFeedback.complete ? "ready" : "keep typing") : "pending"}</span>
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
