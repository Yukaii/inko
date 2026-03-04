import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { isAuthScopedQueryKey } from "../lib/queryKeys";

type AuthSource = "magic-link" | "oauth";

type AuthState = {
  token: string | null;
  isLoading: boolean;
  setToken: (token: string | null, source?: AuthSource) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthStateProvider>{children}</AuthStateProvider>;
}

function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("inko_token"));
  const [, setSourceState] = useState<AuthSource | null>(() => "magic-link");
  const [isLoading, setIsLoading] = useState(true);
  const previousTokenRef = useRef<string | null>(token);

  const setToken = (nextToken: string | null, nextSource: AuthSource = "magic-link") => {
    setTokenState(nextToken);
    if (nextToken) {
      setSourceState(nextSource);
      localStorage.setItem("inko_token", nextToken);
      localStorage.setItem("inko_auth_source", nextSource);
    } else {
      setSourceState(null);
      localStorage.removeItem("inko_token");
      localStorage.removeItem("inko_auth_source");
    }
  };

  const signOut = async () => {
    setToken(null);
  };

  useEffect(() => {
    const previousToken = previousTokenRef.current;
    if (previousToken !== token) {
      queryClient.removeQueries({
        predicate: (query) => isAuthScopedQueryKey(query.queryKey),
      });
      previousTokenRef.current = token;
    }
  }, [queryClient, token]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const accessToken = url.searchParams.get("accessToken");

    const bootstrapAuth = async () => {
      if (accessToken) {
        setToken(accessToken, "magic-link");
        url.searchParams.delete("accessToken");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        setIsLoading(false);
        return;
      }

      try {
        const exchange = await api.exchangeOAuthSession();
        if (exchange?.accessToken) {
          setToken(exchange.accessToken, "oauth");
        }
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  const value = useMemo(
    () => ({
      token,
      isLoading,
      setToken,
      signOut,
    }),
    [isLoading, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used under AuthProvider");
  return ctx;
}
