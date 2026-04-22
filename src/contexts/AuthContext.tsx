import * as React from "react";

export type TercolUser = "Cesar Cuartas" | "Andres Perez" | "Otros";

export const TERCOL_USERS: TercolUser[] = ["Cesar Cuartas", "Andres Perez", "Otros"];

interface AuthContextValue {
  user: TercolUser | null;
  login: (user: TercolUser) => void;
  logout: () => void;
  ready: boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "tercol.activeUser";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<TercolUser | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as TercolUser | null;
      if (stored && TERCOL_USERS.includes(stored)) setUser(stored);
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const login = React.useCallback((u: TercolUser) => {
    setUser(u);
    try {
      localStorage.setItem(STORAGE_KEY, u);
    } catch {
      // ignore
    }
  }, []);

  const logout = React.useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = React.useMemo(() => ({ user, login, logout, ready }), [user, login, logout, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
