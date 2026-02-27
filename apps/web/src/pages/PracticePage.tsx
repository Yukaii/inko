import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
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
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState("");
  const [card, setCard] = useState<PracticeCard | null>(null);
  const [typingInput, setTypingInput] = useState("");
  const [cardStreak, setCardStreak] = useState(0);
  const [bestCardStreak, setBestCardStreak] = useState(0);
  const [lastSubmitAccepted, setLastSubmitAccepted] = useState<boolean | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<{ cardsCompleted: number; avgTypingScore: number } | null>(null);
  const [cardTransition, setCardTransition] = useState(false);
  const [finishError, setFinishError] = useState("");

  const startedAtRef = useRef<number>(Date.now());
  const autoSubmitKeyRef = useRef<string>("");
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!deckId || !token) return;
    api.startPractice(token, deckId).then((res) => {
      setSessionId(res.sessionId);
      setCard(res.card as PracticeCard);
      startedAtRef.current = Date.now();
    });
  }, [deckId, token]);

  const focusInput = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

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
      if (res.accepted) {
        setLastSubmitAccepted(true);
        setCardStreak((prev) => {
          const next = prev + 1;
          setBestCardStreak((best) => Math.max(best, next));
          return next;
        });

        setCardTransition(true);
        setTimeout(() => {
          setTypingInput("");
          if (res.nextCard) {
            setCard(res.nextCard as PracticeCard);
          } else {
            requestFinish();
          }
          startedAtRef.current = Date.now();
          setCardTransition(false);
          focusInput();
        }, 400);
      } else {
        setLastSubmitAccepted(false);
        setCardStreak(0);
      }
    },
  });

  const finishRequestedRef = useRef(false);

  const finishMutation = useMutation({
    mutationFn: (vars: { token: string; sessionId: string }) => {
      return api.finishPractice(vars.token, vars.sessionId);
    },
    onSuccess: (summary) => {
      setFinishError("");
      setSessionDone(true);
      setSessionSummary(summary);
    },
    onError: (error) => {
      setFinishError(error instanceof Error ? error.message : "Failed to finish session");
      finishRequestedRef.current = false;
    },
  });

  const requestFinish = useCallback(() => {
    if (!sessionId) {
      setFinishError("Session is still starting. Try again.");
      return;
    }
    if (!token) {
      setFinishError("You are not authenticated.");
      return;
    }
    if (finishRequestedRef.current || finishMutation.isPending || sessionDone) return;
    finishRequestedRef.current = true;
    setFinishError("");
    finishMutation.mutate({ token, sessionId });
  }, [finishMutation, sessionDone, sessionId, token]);

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

  const focusKey = card?.wordId ?? "";

  useEffect(() => {
    if (!focusKey) return;
    focusInput();
  }, [focusKey, focusInput]);

  // Auto-submit on match
  useEffect(() => {
    if (!card || submitMutation.isPending || !submitEnabled) return;
    const normalizedTyped = normalizeJapaneseInput(typingInput).toLowerCase();
    if (!normalizedTyped) return;

    const autoSubmitKey = `${sessionId}:${card.wordId}:${normalizedTyped}`;
    if (autoSubmitKeyRef.current === autoSubmitKey) return;

    autoSubmitKeyRef.current = autoSubmitKey;
    submitMutation.mutate();
  }, [card, sessionId, submitEnabled, submitMutation, typingInput]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        requestFinish();
        return;
      }
      // Any printable key focuses the hidden input
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      focusInput();
    },
    [requestFinish, focusInput],
  );

  // Build character-by-character display for monkeytype effect
  const romajiChars = useMemo(() => {
    const target = typingFeedback.target;
    if (!target) return [];

    const typed = normalizeJapaneseInput(typingInput).toLowerCase();
    const chars: Array<{ char: string; pos: number; state: "correct" | "wrong" | "cursor" | "pending" }> = [];

    for (let i = 0; i < target.length; i++) {
      if (i < typed.length) {
        chars.push({
          char: target[i],
          pos: i,
          state: typed[i] === target[i] ? "correct" : "wrong",
        });
      } else if (i === typed.length) {
        chars.push({ char: target[i], pos: i, state: "cursor" });
      } else {
        chars.push({ char: target[i], pos: i, state: "pending" });
      }
    }

    // If typed is longer than target, show extra chars as wrong
    if (typed.length > target.length) {
      for (let i = target.length; i < typed.length; i++) {
        chars.push({ char: typed[i], pos: i, state: "wrong" });
      }
    }

    return chars;
  }, [typingInput, typingFeedback.target]);

  // Session done screen
  if (sessionDone) {
    return (
      <section className="zen-zone" aria-label="Practice complete">
        <div className="zen-center">
          <div className="zen-complete-icon" aria-hidden="true">&#x2714;</div>
          <h1 className="zen-complete-title">Session Complete</h1>
          {sessionSummary ? (
            <div className="zen-complete-stats">
              <div className="zen-stat">
                <span className="zen-stat-value">{sessionSummary.cardsCompleted}</span>
                <span className="zen-stat-label">cards</span>
              </div>
              <div className="zen-stat">
                <span className="zen-stat-value">{sessionSummary.avgTypingScore}</span>
                <span className="zen-stat-label">avg typing</span>
              </div>
              <div className="zen-stat">
                <span className="zen-stat-value">{bestCardStreak}</span>
                <span className="zen-stat-label">best streak</span>
              </div>
            </div>
          ) : null}
          <button type="button" className="zen-back-btn" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </section>
    );
  }

  // Loading state
  if (!card) {
    return (
      <section className="zen-zone" aria-label="Loading practice">
        <div className="zen-center">
          <div className="zen-loading">Loading...</div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={zoneRef}
      className="zen-zone"
      tabIndex={-1}
      aria-label="Practice session"
      onKeyDown={handleKeyDown}
      onClick={focusInput}
    >
      {/* Minimal top bar */}
      <div className="zen-topbar">
        <div className="zen-topbar-left">
          <span className="zen-streak-pill" aria-label={`Current streak: ${cardStreak}`}>
            {cardStreak > 0 ? (
              <>
                <span className="zen-streak-fire" aria-hidden="true">&#x1F525;</span>
                <span>{cardStreak}</span>
              </>
            ) : (
              <span className="zen-streak-zero">0</span>
            )}
          </span>
          {bestCardStreak > 0 ? (
            <span className="zen-best-streak" aria-label={`Best streak: ${bestCardStreak}`}>
              best: {bestCardStreak}
            </span>
          ) : null}
        </div>
        <button type="button" className="zen-end-btn" onClick={() => requestFinish()}>
          end session
          <kbd className="zen-kbd">esc</kbd>
        </button>
      </div>
      {finishError ? <div className="zen-finish-error">{finishError}</div> : null}

      {/* Center focus area */}
      <div className={`zen-center ${cardTransition ? "zen-card-exit" : ""}`}>
        {/* Meaning as a subtle hint above */}
        {card.meaning ? (
          <div className="zen-meaning">{card.meaning}</div>
        ) : null}

        {/* Large kanji target */}
        <div className="zen-target" lang="ja">{card.target}</div>

        {/* Reading hint (small, below kanji) */}
        {card.reading ? (
          <div className="zen-reading" lang="ja">{card.reading}</div>
        ) : null}

        {/* Monkeytype-style character display */}
        <div className="zen-romaji-track" aria-hidden="true">
          {romajiChars.map((c) => (
            <span
              key={`${focusKey}-p${c.pos}-${c.char}`}
              className={`zen-char zen-char-${c.state}`}
            >
              {c.char}
            </span>
          ))}
          {romajiChars.length === 0 ? (
            <span className="zen-char zen-char-pending zen-romaji-placeholder">
              type romaji...
            </span>
          ) : null}
        </div>

        {/* Hidden input for capturing keystrokes */}
        <label className="zen-sr-only" htmlFor="zen-typing-input">
          Type romaji for {card.target}
        </label>
        <input
          id="zen-typing-input"
          key={card.wordId}
          ref={hiddenInputRef}
          className="zen-hidden-input"
          value={typingInput}
          onChange={(event) => setTypingInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              requestFinish();
            }
          }}
          aria-label={`Type romaji for ${card.target}`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Feedback line */}
        <div className="zen-feedback" aria-live="polite">
          {lastSubmitAccepted === false ? (
            <span className="zen-feedback-miss">not quite &mdash; try again</span>
          ) : typingInput && !typingFeedback.onTrack ? (
            <span className="zen-feedback-off">off track</span>
          ) : typingInput && typingFeedback.onTrack ? (
            <span className="zen-feedback-on">{typingFeedback.progress}%</span>
          ) : null}
        </div>
      </div>

      {/* Subtle progress bar at bottom */}
      <div className="zen-bottom-bar">
        <div className="zen-progress-track" aria-hidden="true">
          <div
            className={`zen-progress-fill ${typingFeedback.complete ? "zen-progress-complete" : ""}`}
            style={{ width: `${typingFeedback.progress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
