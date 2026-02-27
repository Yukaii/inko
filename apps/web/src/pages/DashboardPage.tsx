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

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Welcome Header */}
      <header className="dashboard-header">
        <p className="dashboard-welcome">welcome_back,</p>
        <h1 className="dashboard-title">Good day, learner</h1>
      </header>

      {/* Stats Row */}
      <section className="stats-grid" aria-label="Statistics">
        <div className="stat-card">
          <div className="stat-label">words_learned</div>
          <div className="stat-value">{data?.totalWordsLearned ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">due_today</div>
          <div className="stat-value accent-orange">{data?.wordsDueToday ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">day_streak</div>
          <div className="stat-value accent-teal">{data?.learningStreak ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">session_time</div>
          <div className="stat-value">{Math.floor((data?.sessionTimeSeconds ?? 0) / 60)}m</div>
        </div>
      </section>

      {/* Quick Practice Section */}
      {activeDecks.length > 0 && (
        <section className="practice-section">
          <div className="section-header">
            <h2 className="section-title">Quick Practice</h2>
            <span className="keyboard-hint">
              <kbd>p</kbd> to focus
            </span>
          </div>
          <ul
            ref={practiceGridRef}
            className="deck-grid"
            onKeyDown={handlePracticeKeyDown}
            aria-label="Practice decks"
          >
            {activeDecks.map((deck, index) => (
              <li
                key={deck.id}
                data-deck-index={index}
                className="deck-tile"
                tabIndex={focusedDeckIndex === index ? 0 : -1}
                onClick={() => navigate(`/practice/${deck.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    navigate(`/practice/${deck.id}`);
                  }
                }}
              >
                <div className="deck-tile-content">
                  <span className="deck-tile-lang">{deck.language.toUpperCase()}</span>
                  <span className="deck-tile-name">{deck.name}</span>
                </div>
                <button type="button" className="deck-tile-action">
                  Start
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeDecks.length === 0 && !decksQuery.isLoading && (
        <section className="empty-state-card">
          <p>No decks yet.</p>
          <p className="empty-state-hint">
            Head to the <Link to="/word-bank" className="accent-link">Word Bank</Link> to create your first deck.
          </p>
        </section>
      )}

      {/* Recent Sessions */}
      <section className="sessions-section">
        <h2 className="section-title">Recent Sessions</h2>
        <div className="sessions-list">
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
              <div key={session.sessionId} className="session-item">
                <span className="session-date">{formattedDate}</span>
                <span className="session-stats">
                  {session.cardsCompleted} cards · {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                </span>
              </div>
            );
          })}
          {data?.recentSessions?.length === 0 ? (
            <p className="empty-text">No completed sessions yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
