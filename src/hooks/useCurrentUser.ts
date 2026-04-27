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

function readFromStorage(): TercolUser | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
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
  return null;
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
export function getCurrentUser(): TercolUser | null {
  return readFromStorage();
}

/**
 * Devuelve los campos de auditoría con fallback a "Sistema" cuando
 * no hay identidad seleccionada. Las columnas `created_by_id` son
 * nullable en BD; `created_by_name` admite cualquier string.
 */
export function getCurrentUserForAudit(): { id: string | null; name: string } {
  const u = readFromStorage();
  return { id: u?.id ?? null, name: u?.name ?? "Sistema" };
}

export function useCurrentUser() {
  // IMPORTANTE: empezar SIEMPRE en `null` para que el HTML del SSR coincida
  // con el primer render del cliente. Si leyéramos sessionStorage en el
  // initializer, el server pintaría "Sistema" y el cliente "Andres Perez",
  // disparando un hydration mismatch que regenera todo el árbol del layout
  // (sidebar + header + main) y añade ~200-400 ms al primer paint.
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

  const setUser = React.useCallback((u: TercolUser | null) => {
    writeToStorage(u);
    setUserState(u);
  }, []);

  const clearUser = React.useCallback(() => {
    writeToStorage(null);
    setUserState(null);
  }, []);

  return { user, setUser, clearUser };
}