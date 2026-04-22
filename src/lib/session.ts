export interface StoredUser {
  id: string;
  name: string;
}

export const SESSION_STORAGE_KEY = "tercol.activeUser";

/**
 * Lee y valida la sesión almacenada en localStorage.
 * Si el JSON es inválido o no tiene la forma esperada, limpia la key
 * y devuelve null. Esto evita estados fantasma donde el guard cree
 * que hay sesión pero el contexto no puede hidratar el usuario.
 */
export function readStoredSession(): StoredUser | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredUser> | null;
    if (
      parsed &&
      typeof parsed.id === "string" &&
      parsed.id.length > 0 &&
      typeof parsed.name === "string" &&
      parsed.name.length > 0
    ) {
      return { id: parsed.id, name: parsed.name };
    }
  } catch {
    // fallthrough -> clear
  }
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  return null;
}

export function writeStoredSession(user: StoredUser): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}