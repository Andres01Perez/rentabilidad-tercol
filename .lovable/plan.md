

# Plan: limpiar la app y arreglar `/analisis-ventas`

## Causa raíz (un solo bug que dispara todo)

**Hydration mismatch** en `AuthContext`. El estado `user` se inicializa leyendo `localStorage` con un lazy initializer:

- **En SSR**: `typeof window === "undefined"` → `user = null` → `_app.tsx` retorna `null` → el HTML del servidor no contiene el sidebar.
- **En cliente**: `localStorage` tiene el usuario → `user` ya está poblado → React renderiza el sidebar completo.
- **Resultado**: React detecta que el HTML servido no coincide con el cliente, **descarta todo el árbol y lo regenera** (es literalmente lo que dice el error: "this tree will be regenerated on the client").

Ese re-montado completo es lo que causa:
- La sensación de "sesión / cache rota".
- Los flashes y latencia al navegar.
- El **"Failed to fetch dynamically imported module"** en `/analisis-ventas`: el chunk lazy se intenta cargar mientras el árbol se está descartando, y la promesa del import queda huérfana.

## Solución

### 1. Desactivar SSR para las rutas autenticadas (raíz del problema)

Agregar `ssr: false` al layout `_app` (que envuelve todas las vistas autenticadas). Esto:
- Hace que el HTML del servidor no incluya el árbol del dashboard.
- El cliente lo monta una sola vez con el `user` ya hidratado desde `localStorage`.
- Elimina el hydration mismatch por completo (no hay nada que comparar).
- Es seguro: la app autenticada no necesita SSR (no es contenido público/SEO).

```tsx
// src/routes/_app.tsx
export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});
```

`/login` y `/` mantienen SSR sin problema porque no dependen de `localStorage`.

### 2. Limpieza del `AuthContext`

- Quitar el `useEffect` que re-llama a `setUser(readStoredUser())` (ya no hace falta porque sin SSR el lazy init ya devuelve el valor correcto).
- Quitar el estado `ready` por completo (ya no aplica): si no hay `user`, redirigir; si hay, renderizar.
- Mantener `refreshUsers()` en background para `/login`.

### 3. Simplificar `_app.tsx`

- Eliminar la dependencia de `ready`.
- Mantener el guard simple: `if (!user) → redirect a /login`.
- Eliminar el `useEffect` de redirect y reemplazarlo por `beforeLoad` con `redirect()` para que la decisión ocurra antes de renderizar (evita el flash de pantalla en blanco):

```tsx
export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tercol.activeUser");
    if (!raw) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});
```

### 4. Limpiar caches stale del módulo de `/analisis-ventas`

- Forzar un rebuild limpio del chunk añadiendo el `ssr: false` (cambia el output del módulo, invalida cualquier cache viejo en el navegador).
- Verificar que `AnalisisVentasPage.tsx` no tiene imports rotos.
- Una vez aplicados los cambios, una recarga dura con Ctrl+Shift+R limpia los chunks viejos del Service Worker / cache del navegador.

### 5. Pequeñas mejoras de UX en `useSalesAnalytics`

- Mover el chequeo `hasAnySales` global a un solo effect que corra una vez al montar (no cada vez que `salesRows.length` cambia).
- Esto evita llamadas redundantes a la BD y elimina parpadeos del estado vacío.

## Entregables

1. `src/routes/_app.tsx`: añadir `ssr: false`, mover guard a `beforeLoad`, eliminar `useEffect` de redirect y check de `ready`.
2. `src/contexts/AuthContext.tsx`: eliminar `ready` y el `useEffect` de re-hidratación; mantener solo lazy init + `refreshUsers` en background.
3. `src/features/analisis-ventas/useSalesAnalytics.ts`: consolidar el chequeo de `hasAnySales`.
4. (No tocar BD ni componentes de UI — el problema es estructural, no de datos).

## Resultado esperado

- Sin hydration mismatch → árbol estable, sin re-montados.
- `/analisis-ventas` carga su chunk sin "Failed to fetch dynamically imported module".
- Navegación entre vistas instantánea (preload + sin re-monte del layout).
- Sesión persistente y sin "flashes".

