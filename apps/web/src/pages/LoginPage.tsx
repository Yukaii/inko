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
    <div className="mx-auto mt-20 max-w-[520px] rounded-base bg-bg-card p-5">
      <h1 className="mt-0 text-[42px] [font-family:var(--font-display)]">Practice starts here</h1>
      <p className="text-text-secondary">email magic link auth for local MVP</p>
      <div className="grid gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="email-input" className="text-xs uppercase tracking-[0.04em] text-text-secondary">
            Email
          </label>
          <input
            id="email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                requestLink();
              }
            }}
          />
        </div>
        <button type="button" onClick={requestLink} disabled={loading}>
          Request Magic Link
        </button>
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor="token-input" className="text-xs uppercase tracking-[0.04em] text-text-secondary">
            Token
          </label>
          <input
            id="token-input"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="paste token from API logs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                verifyLink();
              }
            }}
          />
        </div>
        <button type="button" className="bg-bg-elevated text-text-primary" onClick={verifyLink} disabled={loading}>
          Verify Token
        </button>
      </div>
      {message ? <p className="mb-0 text-accent-teal">{message}</p> : null}
    </div>
  );
}
