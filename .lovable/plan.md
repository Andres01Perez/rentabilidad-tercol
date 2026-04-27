# Plan: Quitar sugerencias y fijar Andres Perez como usuario por defecto

## 1. Quitar sugerencias para subir el margen

En `src/features/negociaciones/NegotiationCalculator.tsx`:
- Eliminar el import de `SuggestionPanel` (línea 62).
- Eliminar el import de `LiveSuggestion` del hook `useNegotiationLive` (línea 61).
- Eliminar la función `addSuggestion` (líneas 203-221).
- Eliminar el bloque que renderiza `<SuggestionPanel ... />` (líneas 545-546).
- En la llamada a `useNegotiationLive` cambiar `topSuggestions: 6` a `topSuggestions: 0` para que el RPC no calcule sugerencias innecesariamente.

Dejaremos el archivo `SuggestionPanel.tsx` y los tipos `LiveSuggestion` en su lugar (sin uso) para poder reactivar la funcionalidad más adelante sin reescribirla. No se modifica la BD.

## 2. Andres Perez como usuario por defecto (eliminar "Sistema")

Cambiamos el modelo: ya no existe el estado "sin firma / Sistema". Andres Perez es la identidad por defecto y siempre hay un usuario activo.

### `src/hooks/useCurrentUser.ts`
- Definir una constante `DEFAULT_USER` con:
  - `id: "13285c47-e1fa-43db-bd3d-2a74dda42bcf"`
  - `name: "Andres Perez"`
- `readFromStorage()` devuelve `DEFAULT_USER` cuando no hay nada en sessionStorage (ya no `null`).
- `getCurrentUser()` deja de devolver `null`: tipo de retorno `TercolUser`.
- `getCurrentUserForAudit()` devuelve siempre `{ id, name }` reales (nunca "Sistema").
- `useCurrentUser`:
  - El estado inicial sigue siendo `null` solo para evitar hydration mismatch durante el primer render del SSR; tras montar, siempre habrá un usuario.
  - `clearUser()` ahora restablece a `DEFAULT_USER` (en lugar de `null`).

### `src/components/layout/UserSwitcher.tsx`
- Quitar todas las menciones a "Sistema" / "Sin firma":
  - El badge inferior siempre muestra el nombre real del usuario (sin fallback a "Sistema").
  - Las iniciales se calculan siempre desde `displayUser.name` (con `DEFAULT_USER` como fallback durante SSR).
  - Subtítulo: siempre "Firmando".
- Reemplazar el botón "Cerrar identidad (volver a Sistema)" por "Restablecer a Andres Perez", llamando a `clearUser()` (que ahora vuelve al default).
- Toast de `handleClear`: "Firmando como Andres Perez".

### `src/routes/_app.tsx`
- En el header, `displayName` deja de tener fallback a "Sistema" — usa `user?.name ?? "Andres Perez"` para el primer render SSR.

No se requiere migración de base de datos. Andres Perez ya existe en `app_users` con `is_default = true`.

## Resultado
- Las cards KPI ya no muestran panel de sugerencias debajo cuando estás bajo el margen mínimo.
- Toda creación/edición queda firmada con Andres Perez por defecto, sin que aparezca jamás "Sistema" en la UI ni en las columnas de auditoría.
