import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";

export function DashboardPage() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard(token!),
  });

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

      <section className="card">
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-display)", fontSize: 28 }}>Recent Sessions</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {(data?.recentSessions ?? []).map((session: any) => (
            <div key={session.sessionId} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{session.sessionId}</span>
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
