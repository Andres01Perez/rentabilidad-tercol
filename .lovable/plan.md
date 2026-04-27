# Por qué sigue lenta la navegación (diagnóstico real)

Los 3-5 segundos al entrar a `/analisis-ventas` (y otras vistas pesadas) **ya no vienen de Supabase ni de la auth**. Vienen de cómo está armado el frontend. Encontré 5 cuellos de botella reales y medibles:

## 1. Cascada "click → red → render" (la causa #1)

`useSalesAnalytics.ts` y los demás features usan **`useEffect` para hacer `fetch` después de montar**. Esto significa que cuando haces click en "Análisis de ventas":

```text
click → bajar JS chunk (lazy) → montar componente → useEffect → 3 RPCs → render
        └─── 200-600 ms ────┘  └─ 50 ms ─┘  └ 20 ms ┘  └─ 800-2000 ms ─┘
```

Y peor: el hook lanza **3 efectos separados** (`get_sales_months`, `financial_discounts`, `get_sales_dashboard`) que se ejecutan en serie desde el punto de vista del usuario porque la pantalla muestra "loading" hasta que termina el más lento.

**Fix**: mover los fetchs al **`loader` de la ruta** de TanStack Router. Los loaders empiezan a correr **en paralelo con la descarga del chunk** y, con `defaultPreload: "intent"`, **arrancan apenas el cursor entra al link**. La pantalla aparece con datos ya cargados.

## 2. `defaultPreload: false` está apagado en `src/router.tsx`

```ts
// src/router.tsx — actual
defaultPreload: false,           // ← desperdicia el hover
defaultPreloadStaleTime: 0,      // ← ningún cache entre vistas
```

Con esto, **cada navegación arranca desde cero**, incluso si volviste a una vista que visitaste hace 2 segundos. No hay SWR, no hay precarga, no hay nada.

**Fix**: `defaultPreload: "intent"` + `defaultPreloadStaleTime: 30_000` para que al pasar el mouse por un link del sidebar el chunk + datos ya estén calientes. Esto solo, sin tocar nada más, suele bajar la navegación percibida a 0-300 ms.

## 3. Hydration mismatch en `UserSwitcher` (re-renderiza TODO el layout)

El error que está apareciendo en consola:

```text
Hydration failed because the server rendered text didn't match the client.
+ title="Andres Perez"     - title="Sistema (sin firma)"
+ AP                       - S
```

`UserSwitcher` lee `sessionStorage` en el cliente, pero en SSR no hay `sessionStorage`, así que el server pinta "Sistema / S" y el cliente lo cambia a "Andres Perez / AP". React detecta el desajuste y **regenera todo el árbol del layout** (sidebar + header + main). Eso por sí solo añade ~200-400 ms al primer pintado y un parpadeo notorio.

**Fix**: el switcher debe renderizar el placeholder neutro ("Sistema / S") hasta que `useEffect` lo monte en cliente — patrón estándar de "mounted flag". Cero costo, elimina el mismatch.

## 4. Páginas monolíticas de 500-900 líneas en un solo chunk

```text
analisis-ventas:    909 líneas  (incluye tabla virtualizada + 4 rankings + filtros + KPIs)
calculadora:        619 líneas
costos-operacionales: 566 líneas
costos-productos:   495 líneas
listas-precios:     475 líneas
```

Aunque las rutas son `lazy`, **todo el feature** (incluyendo el dialog de upload, los rankings, etc.) viaja en un solo chunk. El primer `import()` puede pesar 80-150 KB de JS para parsear antes de pintar.

**Fix**: extraer dialogs y secciones secundarias a sus propios `React.lazy`/`import()` diferidos. El dialog de upload no necesita estar en el bundle inicial de la página.

## 5. Sin SWR de datos entre vistas

`useSalesAnalytics` guarda el estado en `useState` local del hook. Si sales de la página y vuelves 5 segundos después, **vuelve a pedir todo otra vez**. No hay caché.

**Fix**: con loaders + `staleTime: 30_000` el router cachea los datos por ruta y los reutiliza al volver — la segunda visita es instantánea.

---

# Plan de implementación (estrictamente frontend, sin tocar Supabase)

Orden de impacto (lo que más mueve la aguja primero):

### Paso 1 — Activar preload + cache en el router (5 min, gran impacto)

`src/router.tsx`:

```ts
const router = createRouter({
  routeTree,
  context: {},
  scrollRestoration: true,
  defaultPreload: "intent",          // hover/focus precarga chunk + loader
  defaultPreloadDelay: 50,           // pequeño delay para evitar precargas accidentales
  defaultPreloadStaleTime: 30_000,   // datos válidos por 30s
  defaultStaleTime: 30_000,
  defaultErrorComponent: DefaultErrorComponent,
});
```

Solo este cambio ya hace que pasar el mouse por "Análisis de ventas" antes de hacer click descargue el chunk en paralelo.

### Paso 2 — Arreglar el hydration mismatch del UserSwitcher (10 min)

Patrón "mounted gate": durante SSR y primer render del cliente, mostrar siempre el estado neutro ("Sistema / S"). Al pasar el primer `useEffect`, leer `sessionStorage` y actualizar.

```tsx
// src/hooks/useCurrentUser.ts — cambiar el initializer
export function useCurrentUser() {
  // Empezar SIEMPRE en null para que SSR y primer render del cliente coincidan
  const [user, setUserState] = React.useState<TercolUser | null>(null);

  React.useEffect(() => {
    setUserState(readFromStorage());        // ← solo aquí leemos storage
    const handler = () => setUserState(readFromStorage());
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => { /* ... */ };
  }, []);
  // ...
}
```

Esto elimina el regenerado completo del árbol y el flash visual.

### Paso 3 — Mover los fetchs al loader de la ruta (impacto fuerte)

Convertir `src/routes/_app/analisis-ventas.tsx` (no el `.lazy.tsx`) en una ruta con loader y `loaderDeps` ligados a search params:

```ts
// src/routes/_app/analisis-ventas.tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { fetchSalesDashboard, fetchSalesMonths, fetchFinancialDiscounts } from "@/features/analisis-ventas/api";

const searchSchema = z.object({
  salesMonth: z.string().optional(),
  costMonth: z.string().optional(),
  opMonth: z.string().optional(),
  finPct: z.coerce.number().default(0),
  vendedores: z.array(z.string()).default([]),
  dependencias: z.array(z.string()).default([]),
  terceros: z.array(z.string()).default([]),
});

export const Route = createFileRoute("/_app/analisis-ventas")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [months, discounts, dashboard] = await Promise.all([
      fetchSalesMonths(),
      fetchFinancialDiscounts(),
      deps.salesMonth ? fetchSalesDashboard(deps) : Promise.resolve(null),
    ]);
    return { months, discounts, dashboard };
  },
  staleTime: 30_000,
  head: () => ({ meta: [{ title: "Análisis de ventas — Tercol" }] }),
});
```

Y `useSalesAnalytics` se convierte en wrapper que lee `Route.useLoaderData()` + `Route.useSearch()` para los filtros, eliminando los 3 `useEffect`. Los filtros de sidebar pasan a actualizar search params con `navigate({ search: prev => ({...prev, vendedores}) })` y el loader vuelve a correr automáticamente (con cache SWR).

Replicar el mismo patrón en `calculadora`, `costos-productos`, `costos-operacionales`, `listas-precios`.

### Paso 4 — Code-split secundario dentro de cada página (impacto medio)

```tsx
// dentro de AnalisisVentasPage
const UploadVentasDialog = React.lazy(() =>
  import("./UploadVentasDialog").then(m => ({ default: m.UploadVentasDialog }))
);
// renderizar dentro de <Suspense fallback={null}> y solo cuando openUpload === true
```

Esto saca ~10-15 KB del chunk inicial de cada página pesada.

### Paso 5 — Quitar el efecto de `MultiSelectFilter` y otros listeners en cascada

Revisión final: confirmar que los `React.memo` de `KpiCard`, `MultiSelectFilter`, `RankingTable`, etc., realmente reciben referencias estables (callbacks con `useCallback`, arrays con `useMemo`). Esto ya está parcialmente hecho — auditar y completar.

---

# Resultado esperado

| Métrica | Hoy | Después |
|---|---|---|
| Click → primer paint con datos | 3000-5000 ms | 200-600 ms (primera vez) / 0-100 ms (cached) |
| Hover-a-click (preload activo) | n/a | ~0 ms |
| Hydration warning | sí, en cada carga | eliminado |
| Cache al volver a la vista | nunca | 30 s SWR |

Sin tocar Supabase, sin tocar RPCs. El cuello de botella ya no es la base de datos — es que el frontend está esperando a tener todo en mano antes de empezar a renderizar, en vez de aprovechar el preload del router.

---

# Archivos a modificar

- `src/router.tsx` — preload + staleTime
- `src/hooks/useCurrentUser.ts` — fix hydration
- `src/routes/_app/analisis-ventas.tsx` — añadir loader + validateSearch
- `src/features/analisis-ventas/useSalesAnalytics.ts` — leer de loader en vez de useEffect
- `src/features/analisis-ventas/AnalisisVentasPage.tsx` — lazy del dialog, leer search params
- (mismo patrón) `src/routes/_app/calculadora.tsx`, `costos-productos.tsx`, `costos-operacionales.tsx`, `listas-precios.tsx`
- Crear `src/features/analisis-ventas/api.ts` (y equivalentes) con las funciones puras de fetch que usan tanto el loader como los hooks.

¿Procedo con los 5 pasos en este orden, o prefieres que arranque solo con los pasos 1 + 2 + 3 (los de mayor impacto) y dejemos el split fino para una segunda iteración?
