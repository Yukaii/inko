import { createContext, useContext, useMemo, useState } from "react";

type AuthState = {
  token: string | null;
  setToken: (token: string | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("inko_token"));

  const setToken = (nextToken: string | null) => {
    setTokenState(nextToken);
    if (nextToken) {
      localStorage.setItem("inko_token", nextToken);
    } else {
      localStorage.removeItem("inko_token");
    }
  };

  const value = useMemo(() => ({ token, setToken }), [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used under AuthProvider");
  return ctx;
}
