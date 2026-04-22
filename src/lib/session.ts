export interface StoredUser {
  id: string;
  name: string;
}

export const SESSION_STORAGE_KEY = "tercol.activeUser";

/**
 * Migración one-shot: si quedó la key vieja en localStorage de versiones
 * anteriores, la borramos. Esto limpia el "cache" persistente que el usuario
 * pidió eliminar. Si había una sesión válida, la promovemos a sessionStorage
 * para no forzar re-login en este primer load.
 */
let migrated = false;
function migrateLegacyLocalStorage(): void {
  if (migrated || typeof window === "undefined") return;
  migrated = true;
  try {
    const legacy = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (legacy) {
      // Si sessionStorage está vacío y el legacy es válido, lo trasladamos.
      const current = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!current) {
        try {
          const parsed = JSON.parse(legacy) as Partial<StoredUser> | null;
          if (
            parsed &&
            typeof parsed.id === "string" &&
            typeof parsed.name === "string"
          ) {
            window.sessionStorage.setItem(SESSION_STORAGE_KEY, legacy);
          }
        } catch {
          // ignore
        }
      }
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Lee y valida la sesión almacenada en sessionStorage.
 * Si el JSON es inválido o no tiene la forma esperada, limpia la key
 * y devuelve null. Esto evita estados fantasma donde el guard cree
 * que hay sesión pero el contexto no puede hidratar el usuario.
 *
 * Usamos sessionStorage (no localStorage) para que la sesión sea efímera:
 * sobrevive recargas dentro de la misma pestaña, pero se borra al cerrarla
 * y no se comparte entre pestañas/ventanas. Es el estándar nativo del
 * navegador para sesiones de aplicación sin persistencia cruzada.
 */
export function readStoredSession(): StoredUser | null {
  if (typeof window === "undefined") return null;
  migrateLegacyLocalStorage();
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
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
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  return null;
}

export function writeStoredSession(user: StoredUser): void {
  if (typeof window === "undefined") return;
  migrateLegacyLocalStorage();
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    // Por seguridad, también limpiamos cualquier rastro legacy.
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}