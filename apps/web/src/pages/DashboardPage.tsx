import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";
import { registerShortcut } from "../hooks/useKeyboard.js";

export function DashboardPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const practiceGridRef = useRef<HTMLUListElement>(null);
  const [focusedDeckIndex, setFocusedDeckIndex] = useState(-1);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard(token ?? ""),
  });

  const decksQuery = useQuery({
    queryKey: ["decks"],
    queryFn: () => api.listDecks(token ?? ""),
  });

  const decks = decksQuery.data ?? [];
  const activeDecks = decks.filter((d) => !d.archived);

  // Register keyboard shortcuts
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // 'w' to go to word bank
    cleanups.push(
      registerShortcut({
        key: "w",
        handler: () => navigate("/word-bank"),
        description: "Go to Word Bank",
      })
    );

    // 'p' to focus first practice deck
    cleanups.push(
      registerShortcut({
        key: "p",
        handler: () => {
          if (activeDecks.length > 0) {
            setFocusedDeckIndex(0);
            const firstCard = practiceGridRef.current?.querySelector("[data-deck-index='0']") as HTMLElement;
            firstCard?.focus();
          }
        },
        description: "Focus first practice deck",
      })
    );

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [navigate, activeDecks.length]);

  // Handle arrow key navigation within practice grid
  const handlePracticeKeyDown = (event: React.KeyboardEvent) => {
    const maxIndex = activeDecks.length - 1;

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
      case "Enter":
        if (focusedDeckIndex >= 0 && focusedDeckIndex <= maxIndex) {
          event.preventDefault();
          const deck = activeDecks[focusedDeckIndex];
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

  // Focus the currently selected deck card
  useEffect(() => {
    if (focusedDeckIndex >= 0) {
      const card = practiceGridRef.current?.querySelector(`[data-deck-index='${focusedDeckIndex}']`) as HTMLElement;
      card?.focus();
    }
  }, [focusedDeckIndex]);

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header>
        <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>welcome_back,</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 46 }}>Good day, learner</h1>
      </header>

      <section className="grid cols-4" aria-label="Statistics">
        <div className="card">
          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>words_learned</div>
          <div className="metric-value">{data?.totalWordsLearned ?? 0}</div>
        </div>
        <div className="card">
          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>due_today</div>
          <div className="metric-value" style={{ color: "var(--accent-orange)" }}>
            {data?.wordsDueToday ?? 0}
          </div>
        </div>
        <div className="card">
          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>day_streak</div>
          <div className="metric-value" style={{ color: "var(--accent-teal)" }}>
            {data?.learningStreak ?? 0}
          </div>
        </div>
        <div className="card">
          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>session_time_seconds</div>
          <div className="metric-value">{data?.sessionTimeSeconds ?? 0}</div>
        </div>
      </section>

      {/* ---- Quick Practice ---- */}
      {activeDecks.length > 0 && (
        <section>
          <div className="section-header" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28 }}>
              Quick Practice
            </h2>
            <span className="keyboard-hint">
              <kbd>p</kbd> to focus
            </span>
          </div>
          <ul
            ref={practiceGridRef}
            className="quick-practice-grid"
            onKeyDown={handlePracticeKeyDown}
            aria-label="Practice decks"
          >
            {activeDecks.map((deck, index) => (
              <li
                key={deck.id}
                data-deck-index={index}
                className="quick-practice-card"
                tabIndex={focusedDeckIndex === index ? 0 : -1}
                onClick={() => navigate(`/practice/${deck.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    navigate(`/practice/${deck.id}`);
                  }
                }}
              >
                <div className="quick-practice-card-name">{deck.name}</div>
                <div className="quick-practice-card-meta">{deck.language.toUpperCase()}</div>
                <button type="button" style={{ width: "100%", marginTop: "auto" }}>
                  Start Session
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeDecks.length === 0 && !decksQuery.isLoading && (
        <section className="card empty-state">
          <p>No decks yet.</p>
          <p style={{ fontSize: 13 }}>
            Head to the <Link to="/word-bank" style={{ color: "var(--accent-orange)" }}>Word Bank</Link> to create your first deck and start practicing.
          </p>
        </section>
      )}

      <section className="card">
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-display)", fontSize: 28 }}>Recent Sessions</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {(data?.recentSessions ?? []).map((session: { 
            sessionId: string; 
            cardsCompleted: number; 
            startedAt: number; 
            finishedAt: number;
          }) => {
            const duration = Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 1000);
            const formattedDate = new Date(session.finishedAt ?? session.startedAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            
            return (
              <div key={session.sessionId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{formattedDate}</span>
                <span style={{ fontSize: 13 }}>
                  {session.cardsCompleted} cards · {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                </span>
              </div>
            );
          })}
          {data?.recentSessions?.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>No completed sessions yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
