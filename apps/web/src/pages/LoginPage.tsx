import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const [email, setEmail] = useState(import.meta.env.DEV ? "user@example.com" : "");
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;

    setTokenInput(token);

    const verifyFromLink = async () => {
      setLoading(true);
      try {
        const result = await api.verifyMagicLink(token);
        setToken(result.accessToken);
        navigate("/dashboard", { replace: true });
      } catch (error) {
        setMessage(String(error));
      } finally {
        setLoading(false);
      }
    };

    void verifyFromLink();
  }, [navigate, setToken]);

  const requestLink = async () => {
    setLoading(true);
    try {
      const result = await api.requestMagicLink(email);
      if (result.devToken) {
        setTokenInput(result.devToken);
        setMessage("Magic link generated locally. Token auto-filled below for dev.");
      } else {
        setMessage("Magic link sent. Check your email.");
      }
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-4 py-12">
      <div className="w-full max-w-[520px] rounded-base bg-bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-[42px] leading-tight [font-family:var(--font-display)]">Practice starts here</h1>

        </div>
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email-input" className="text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">
              Email
            </label>
            <input
              id="email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
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
          <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-primary" />
            <span className="text-xs text-text-tertiary">or</span>
            <div className="h-px flex-1 bg-border-primary" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="token-input" className="text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">
              Token
            </label>
            <input
              id="token-input"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="paste token here"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  verifyLink();
                }
              }}
            />
          </div>
          <button type="button" className="bg-bg-elevated text-text-primary hover:bg-bg-hover" onClick={verifyLink} disabled={loading}>
            Verify Token
          </button>
        </div>
        {message ? <p className="mb-0 mt-4 text-accent-teal">{message}</p> : null}
      </div>
    </div>
  );
}
