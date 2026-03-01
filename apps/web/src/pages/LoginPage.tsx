import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState(import.meta.env.DEV ? "user@example.com" : "");
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { token, setToken } = useAuth();
  const navigate = useNavigate();

  const getErrorMessage = (error: any) => {
    if (error.code) {
      return t(`errors.${error.code}`, t("errors.unknown"));
    }
    return error.message || t("errors.unknown");
  };

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
        setMessage(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void verifyFromLink();
  }, [navigate, setToken, t]);

  useEffect(() => {
    const magicLinkToken = new URLSearchParams(window.location.search).get("token");
    if (!token || magicLinkToken) return;
    navigate("/dashboard", { replace: true });
  }, [navigate, token]);

  const requestLink = async () => {
    setLoading(true);
    try {
      const result = await api.requestMagicLink(email);
      if (result.devToken) {
        setTokenInput(result.devToken);
        setMessage(t("auth.dev_magic_link_msg"));
      } else {
        setMessage(t("auth.magic_link_sent"));
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
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
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-4 py-12">
      <div className="w-full max-w-[520px] rounded-base bg-bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-[42px] leading-tight [font-family:var(--font-display)]">{t("auth.login")}</h1>

        </div>
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email-input" className="text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">
              {t("auth.email_label")}
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
            {t("auth.request_magic_link")}
          </button>
          <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-primary" />
            <span className="text-xs text-text-tertiary">{t("common.or")}</span>
            <div className="h-px flex-1 bg-border-primary" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="token-input" className="text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">
              {t("auth.token_label")}
            </label>
            <input
              id="token-input"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={t("auth.token_placeholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  verifyLink();
                }
              }}
            />
          </div>
          <button type="button" className="bg-bg-elevated text-text-primary hover:bg-bg-hover" onClick={verifyLink} disabled={loading}>
            {t("auth.verify_token")}
          </button>
        </div>
        {message ? <p className="mb-0 mt-4 text-accent-teal">{message}</p> : null}
      </div>
    </div>
  );
}
