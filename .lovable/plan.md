

# Plan: arreglar espaciado/márgenes, modal de import y simplificar sesión

## 1) Espaciado consistente en `/analisis-ventas`

El problema es que esta vista **no tiene contenedor con padding** (a diferencia de las demás páginas que sí usan `mx-auto max-w-... px-6 py-10 lg:px-10`). Por eso el contenido pega contra los bordes y se ve "mal de márgenes".

Cambios en `AnalisisVentasPage.tsx`:
- Envolver todo en `<div className="mx-auto max-w-[1600px] px-6 py-10 lg:px-10 space-y-8">` — mismo patrón que `CostosProductosPage`.
- Quitar la barra de progreso `sticky top-0` que choca con el header global (queda como barra normal arriba del bloque de filtros).
- Ajustar `sticky top-2` de filtros a `sticky top-16` para que quede debajo del header (h-14 + margen).

## 2) Normalizar `<main>` en `_app.tsx`

Añadir `min-w-0` al `<main>` para que el contenido pueda colapsar correctamente con el sidebar y no haya overflow horizontal raro en pantallas medianas. No tocar el padding (cada página lo controla — patrón actual del proyecto).

## 3) Mejorar el modal `UploadVentasDialog`

- Subir `DialogContent` de `max-w-xl` a `max-w-3xl` para que la tabla preview (6 columnas) y el dropzone respiren.
- Añadir `max-h-[85vh] overflow-y-auto` al contenido scrolleable interno para que en pantallas pequeñas el modal no se desborde.
- Mantener overlay actual (ya cubre la tabla con `bg-black/80`).

## 4) Revisar otros modales con tablas largas
Pasar a `max-w-3xl` los Dialogs que muestran preview de Excel:
- `CreateListDialog` y `ReplaceListDialog` (`listas-precios`)
- `UploadDialog` de `costos-productos` (Excel de 18 columnas)

## 5) Sesión simplificada — sin localStorage propio

**Consecuencia importante**: si quitamos `localStorage`, al recargar la pestaña **se pierde la sesión** y hay que volver a seleccionar el usuario en `/login`. La sesión solo existirá mientras la pestaña esté abierta y navegando.

Cambios:
- `src/lib/session.ts`: cambiar de `localStorage` a una **variable en memoria del módulo** (más `sessionStorage` como respaldo opcional para sobrevivir recargas dentro de la misma pestaña, pero NO entre pestañas/navegadores).
  - Opción A (más estricta, "nativo puro"): solo memoria. Recarga = re-login.
  - Opción B (recomendada): `sessionStorage`. Sobrevive recargas, se borra al cerrar la pestaña, no se comparte entre pestañas. Es el estándar nativo del navegador para sesiones efímeras.
- `AuthContext`, `_app.tsx`, `login.tsx` siguen usando los mismos helpers `readStoredSession/writeStoredSession/clearStoredSession` — solo cambia la implementación interna.
- Cliente Supabase (`src/integrations/supabase/client.ts`): cambiar `storage: localStorage` → `storage: sessionStorage` para consistencia (esto aplica solo si en el futuro se usa Supabase Auth real; hoy no afecta porque la app no usa Supabase Auth, solo el `app_users` table).

**Pregunta clave a resolver**: ¿quieres opción A (recarga = re-login, lo más nativo posible) u opción B (sessionStorage, sobrevive F5 pero se va al cerrar la pestaña)? Por defecto aplico **opción B** porque es el balance correcto entre "sin cache persistente" y "no obligar a re-login en cada F5".

## 6) Limpieza de localStorage actual al cargar

Para borrar el cache que el usuario ya tiene almacenado, añadir en `src/lib/session.ts` una migración one-shot: al cargar, si encuentra la key vieja en `localStorage`, la borra (y opcionalmente la mueve a `sessionStorage` para no forzar re-login esta vez).

## Archivos a tocar

1. `src/features/analisis-ventas/AnalisisVentasPage.tsx` — contenedor + sticky offsets
2. `src/features/analisis-ventas/UploadVentasDialog.tsx` — `max-w-3xl` + overflow
3. `src/features/listas-precios/ListasPreciosPage.tsx` — Dialogs a `max-w-3xl`
4. `src/features/costos-productos/CostosProductosPage.tsx` — Dialog a `max-w-3xl`
5. `src/routes/_app.tsx` — `<main className="flex-1 min-w-0">`
6. `src/lib/session.ts` — cambio a `sessionStorage` + migración limpieza de `localStorage`
7. `src/integrations/supabase/client.ts` — `storage: sessionStorage`

## Resultado esperado

- `/analisis-ventas` con márgenes y padding consistentes con el resto de vistas.
- Modal de import más ancho, dropzone y preview con espacio adecuado.
- Sesión usando `sessionStorage` (estándar nativo del navegador): se mantiene durante la navegación y recargas en la misma pestaña, se borra al cerrarla. Sin estados "fantasma" ni cache cruzado entre sesiones.
- `localStorage` viejo se limpia automáticamente al primer load.

