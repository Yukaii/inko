import { ConvexAuthProvider, useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210");

type AuthSource = "magic-link" | "convex-auth";

type AuthState = {
  token: string | null;
  isLoading: boolean;
  setToken: (token: string | null, source?: AuthSource) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <AuthStateProvider>{children}</AuthStateProvider>
    </ConvexAuthProvider>
  );
}

function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("inko_token"));
  const [source, setSourceState] = useState<AuthSource | null>(
    () => (localStorage.getItem("inko_auth_source") as AuthSource | null) ?? null,
  );
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const convexToken = useAuthToken();
  const { signOut: signOutConvex } = useAuthActions();
  const { isLoading: convexLoading } = useConvexAuth();
  const lastConvexTokenRef = useRef<string | null>(null);
  const hasPendingConvexExchange = Boolean(convexToken) && token === null;

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

  useEffect(() => {
    if (convexLoading) return;

    if (!convexToken) {
      lastConvexTokenRef.current = null;
      if (source === "convex-auth") {
        setToken(null);
      }
      return;
    }

    if (convexToken === lastConvexTokenRef.current) {
      return;
    }

    let cancelled = false;
    setExchangeLoading(true);

    void api
      .verifyConvexAuth(convexToken)
      .then((result) => {
        if (cancelled) return;
        lastConvexTokenRef.current = convexToken;
        setToken(result.accessToken, "convex-auth");
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to exchange Convex auth token", error);
        lastConvexTokenRef.current = convexToken;
        setToken(null);
        void signOutConvex();
      })
      .finally(() => {
        if (!cancelled) {
          setExchangeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [convexLoading, convexToken, source]);

  const signOut = async () => {
    const activeSource = source;
    setToken(null);
    lastConvexTokenRef.current = null;
    if (activeSource === "convex-auth") {
      await signOutConvex();
    }
  };

  const value = useMemo(
    () => ({
      token,
      isLoading: convexLoading || exchangeLoading || hasPendingConvexExchange,
      setToken,
      signOut,
    }),
    [convexLoading, exchangeLoading, hasPendingConvexExchange, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used under AuthProvider");
  return ctx;
}
