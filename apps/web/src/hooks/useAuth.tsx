import { createContext, useContext, useMemo, useState } from "react";

type AuthSource = "magic-link";

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
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("inko_token"));
  const [, setSourceState] = useState<AuthSource | null>(() => "magic-link");

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

  const value = useMemo(
    () => ({
      token,
      isLoading: false,
      setToken,
      signOut,
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used under AuthProvider");
  return ctx;
}
