import * as React from "react";

/**
 * Identidad ligera para auditoría. NO es autenticación real:
 * solo guarda quién está "firmando" lo que se crea, en sessionStorage.
 *
 * - Sin Context, sin Provider: cero re-renders en cascada.
 * - Sincroniza entre componentes vía un evento custom + listener al
 *   evento "storage" del navegador (cambios en otras pestañas).
 */

export interface TercolUser {
  id: string;
  name: string;
}

export const SESSION_STORAGE_KEY = "tercol.activeUser";
const CHANGE_EVENT = "tercol:user-changed";

/**
 * Identidad por defecto. Se usa cuando el usuario no ha seleccionado nadie
 * o cuando "cierra identidad". Ya no existe un estado "Sistema".
 */
export const DEFAULT_USER: TercolUser = {
  id: "13285c47-e1fa-43db-bd3d-2a74dda42bcf",
  name: "Andres Perez",
};

function isValidUser(v: unknown): v is TercolUser {
  if (!v || typeof v !== "object") return false;
  const u = v as Partial<TercolUser>;
  return (
    typeof u.id === "string" &&
    u.id.length > 0 &&
    typeof u.name === "string" &&
    u.name.length > 0
  );
}

function readFromStorage(): TercolUser {
  if (typeof window === "undefined") return DEFAULT_USER;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return DEFAULT_USER;
  }
  if (!raw) return DEFAULT_USER;
  try {
    const parsed = JSON.parse(raw);
    if (isValidUser(parsed)) return { id: parsed.id, name: parsed.name };
  } catch {
    // fallthrough
  }
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  return DEFAULT_USER;
}

function writeToStorage(user: TercolUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    // También limpiamos cualquier rastro legacy en localStorage.
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

/**
 * Lectura síncrona — útil fuera de componentes (ej. handlers de eventos).
 */
export function getCurrentUser(): TercolUser {
  return readFromStorage();
}

/**
 * Devuelve los campos de auditoría. Siempre hay un usuario activo
 * (Andres Perez por defecto), por lo que no hay fallback a "Sistema".
 */
export function getCurrentUserForAudit(): { id: string; name: string } {
  const u = readFromStorage();
  return { id: u.id, name: u.name };
}

export function useCurrentUser() {
  // IMPORTANTE: empezar SIEMPRE en `null` para que el HTML del SSR coincida
  // con el primer render del cliente. Tras hidratar, siempre habrá un
  // usuario (Andres Perez por defecto si no hay nada en sessionStorage).
  const [user, setUserState] = React.useState<TercolUser | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // Leemos storage SOLO después de hidratar.
    setUserState(readFromStorage());
    const handler = () => setUserState(readFromStorage());
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setUser = React.useCallback((u: TercolUser) => {
    writeToStorage(u);
    setUserState(u);
  }, []);

  /**
   * Restablece la identidad al usuario por defecto (Andres Perez).
   * Limpia sessionStorage para que la próxima sesión también arranque ahí.
   */
  const clearUser = React.useCallback(() => {
    writeToStorage(null);
    setUserState(DEFAULT_USER);
  }, []);

  return { user, setUser, clearUser };
}