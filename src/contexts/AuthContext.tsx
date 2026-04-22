import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TercolUser {
  id: string;
  name: string;
}

interface AuthContextValue {
  user: TercolUser | null;
  login: (user: TercolUser) => void;
  logout: () => void;
  ready: boolean;
  appUsers: TercolUser[];
  refreshUsers: () => Promise<void>;
  createUser: (name: string) => Promise<TercolUser>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "tercol.activeUser";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<TercolUser | null>(null);
  const [ready, setReady] = React.useState(false);
  const [appUsers, setAppUsers] = React.useState<TercolUser[]>([]);

  const refreshUsers = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("app_users")
      .select("id, name, is_default")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) {
      console.error("Error loading app_users", error);
      return;
    }
    setAppUsers((data ?? []).map((u) => ({ id: u.id, name: u.name })));
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as TercolUser;
          if (parsed?.id && parsed?.name) setUser(parsed);
        }
      } catch {
        // ignore
      }
      await refreshUsers();
      setReady(true);
    })();
  }, [refreshUsers]);

  const login = React.useCallback((u: TercolUser) => {
    setUser(u);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch {
      // ignore
    }
  }, []);

  const createUser = React.useCallback(async (name: string): Promise<TercolUser> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("El nombre no puede estar vacío");
    const { data, error } = await supabase
      .from("app_users")
      .insert({ name: trimmed, is_default: false })
      .select("id, name")
      .single();
    if (error) {
      // Si el usuario ya existe, lo recuperamos
      if (error.code === "23505") {
        const { data: existing, error: fetchErr } = await supabase
          .from("app_users")
          .select("id, name")
          .eq("name", trimmed)
          .single();
        if (fetchErr || !existing) throw fetchErr ?? new Error("No se pudo recuperar el usuario");
        await refreshUsers();
        return { id: existing.id, name: existing.name };
      }
      throw error;
    }
    await refreshUsers();
    return { id: data.id, name: data.name };
  }, [refreshUsers]);

  const logout = React.useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = React.useMemo(
    () => ({ user, login, logout, ready, appUsers, refreshUsers, createUser }),
    [user, login, logout, ready, appUsers, refreshUsers, createUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
