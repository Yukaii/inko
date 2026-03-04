import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { applyNoIndexMetadata } from "../lib/seo";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.14 3.57-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-3c-1.07.72-2.43 1.15-4.08 1.15-3.13 0-5.78-2.12-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.82l3.45-3.45C17.95 1.16 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.09c.95-2.84 3.6-4.94 6.73-4.94Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current">
      <path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.3 9.4 7.89 10.92.58.1.79-.25.79-.56 0-.28-.01-1.2-.02-2.17-3.21.7-3.89-1.37-3.89-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.09 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.97.1-.75.4-1.27.74-1.56-2.56-.29-5.26-1.28-5.26-5.72 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.77.11 3.06.74.8 1.18 1.82 1.18 3.08 0 4.45-2.7 5.42-5.28 5.71.41.36.78 1.06.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.66 18.35.5 12 .5Z" />
    </svg>
  );
}

const ENABLED_PROVIDERS = [
  {
    id: "google" as const,
    name: "Google",
    enabled: import.meta.env.VITE_AUTH_GOOGLE_ENABLED === "true",
    className:
      "flex items-center justify-center gap-3 border border-[#DADCE0] bg-white text-[#1F1F1F] hover:bg-[#F8F9FA] disabled:border-[#DADCE0] disabled:bg-white/80 disabled:text-[#5F6368]",
    Icon: GoogleIcon,
  },
  {
    id: "github" as const,
    name: "GitHub",
    enabled: import.meta.env.VITE_AUTH_GITHUB_ENABLED === "true",
    className:
      "flex items-center justify-center gap-3 border border-[#30363D] bg-[#24292F] text-white hover:bg-[#2F363D] disabled:border-[#30363D] disabled:bg-[#24292F]/80 disabled:text-white/80",
    Icon: GitHubIcon,
  },
].filter((provider) => provider.enabled);

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState(import.meta.env.DEV ? "user@example.com" : "");
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const { token, isLoading: authLoading, setToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    applyNoIndexMetadata("Log In | Inko");
  }, []);

  const getErrorMessage = (error: any) => {
    if (error.code) {
      return t(`errors.${error.code}`, t("errors.unknown"));
    }
    return error.message || t("errors.unknown");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    const token = params.get("token");

    if (oauthError) {
      setMessage(oauthError);
      return;
    }

    if (!token) return;

    setTokenInput(token);

    const verifyFromLink = async () => {
      setLoading(true);
      try {
        const result = await api.verifyMagicLink(token);
        setToken(result.accessToken, "magic-link");
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
    if (!token || magicLinkToken || authLoading) return;
    navigate("/dashboard", { replace: true });
  }, [authLoading, navigate, token]);

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
      setToken(result.accessToken, "magic-link");
      navigate("/dashboard");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const startOauth = (provider: "google" | "github") => {
    setLoading(true);
    setOauthProvider(provider);
    const url = new URL(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/auth/${provider}/start`);
    url.searchParams.set("redirectTo", "/dashboard");
    window.location.href = url.toString();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-4 py-12">
      <div className="w-full max-w-[520px] rounded-base bg-bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-[42px] leading-tight [font-family:var(--font-display)]">{t("auth.login")}</h1>

        </div>
        <div className="grid gap-4">
          {ENABLED_PROVIDERS.length > 0 ? (
            <>
              <div className="grid gap-2">
                {ENABLED_PROVIDERS.map(({ id, name, className, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={className}
                    onClick={() => startOauth(id)}
                    disabled={loading || authLoading}
                  >
                    <Icon />
                    {oauthProvider === id && loading
                      ? t("auth.continue_with_provider_loading", { provider: name })
                      : t("auth.continue_with_provider", { provider: name })}
                  </button>
                ))}
              </div>
              <div className="my-2 flex items-center gap-3">
                <div className="h-px flex-1 bg-border-primary" />
                <span className="text-xs text-text-tertiary">{t("auth.magic_link_alt")}</span>
                <div className="h-px flex-1 bg-border-primary" />
              </div>
            </>
          ) : null}
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
            <span className="text-xs text-text-tertiary">{t("auth.verify_magic_link_alt")}</span>
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
