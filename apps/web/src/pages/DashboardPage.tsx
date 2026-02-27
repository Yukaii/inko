import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";

export function DashboardPage() {
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard(token ?? ""),
  });

  const decksQuery = useQuery({
    queryKey: ["decks"],
    queryFn: () => api.listDecks(token ?? ""),
  });

  const decks = decksQuery.data ?? [];

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header>
        <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>welcome_back,</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 46 }}>Good day, learner</h1>
      </header>

      <section className="grid cols-4">
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
      {decks.length > 0 && (
        <section>
          <h2 style={{ marginTop: 0, fontFamily: "var(--font-display)", fontSize: 28, marginBottom: 14 }}>
            Quick Practice
          </h2>
          <div className="quick-practice-grid">
            {decks
              .filter((d) => !d.archived)
              .map((deck) => (
                <div key={deck.id} className="quick-practice-card">
                  <div className="quick-practice-card-name">{deck.name}</div>
                  <div className="quick-practice-card-meta">{deck.language.toUpperCase()}</div>
                  <Link to={`/practice/${deck.id}`}>
                    <button type="button" style={{ width: "100%" }}>Start Session</button>
                  </Link>
                </div>
              ))}
          </div>
        </section>
      )}

      {decks.length === 0 && !decksQuery.isLoading && (
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
          {(data?.recentSessions ?? []).map((session: { sessionId: string; cardsCompleted: number }) => (
            <div key={session.sessionId} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{session.sessionId.slice(0, 12)}...</span>
              <span>{session.cardsCompleted} cards</span>
            </div>
          ))}
          {data?.recentSessions?.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>No completed sessions yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
