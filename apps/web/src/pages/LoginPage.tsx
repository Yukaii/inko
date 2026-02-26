import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";

export function LoginPage() {
  const [email, setEmail] = useState("yukai@example.com");
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuth();
  const navigate = useNavigate();

  const requestLink = async () => {
    setLoading(true);
    try {
      await api.requestMagicLink(email);
      setMessage("Magic link token generated in API logs. Paste token below.");
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  };

  const verifyLink = async () => {
    setLoading(true);
    try {
      const result = await api.verifyMagicLink(tokenInput);
      setToken(result.accessToken);
      navigate("/dashboard");
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "80px auto" }} className="card">
      <h1 style={{ marginTop: 0, fontFamily: "var(--font-display)", fontSize: 42 }}>Practice starts here</h1>
      <p style={{ color: "var(--text-secondary)" }}>email magic link auth for local MVP</p>
      <div style={{ display: "grid", gap: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <button onClick={requestLink} disabled={loading}>
          Request Magic Link
        </button>
        <input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="paste token from API logs"
        />
        <button className="secondary" onClick={verifyLink} disabled={loading}>
          Verify Token
        </button>
      </div>
      {message ? <p style={{ color: "var(--accent-teal)", marginBottom: 0 }}>{message}</p> : null}
    </div>
  );
}
