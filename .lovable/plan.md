## Diagnóstico real

Antes de arreglar, vale la pena ser honestos sobre por qué los cambios anteriores **no se sintieron** y en algunos casos empeoraron las cosas:

1. **`defaultPreload: "intent"` en realidad agregó carga**: cada vez que el usuario pasa el mouse por el sidebar dispara fetches a Supabase para 6 vistas. Eso explica por qué los selectores y tablas "se demoran el doble": están compitiendo con preloads paralelos contra Supabase desde el navegador.
2. **No estamos usando TanStack Query** aunque está instalado. Cada `useEffect → setLoading(true) → supabase.from(...)` se vuelve a ejecutar **completo** cada vez que entras a la vista, sin cache real. El `staleTime` del router solo cachea el resultado del `loader`, pero como no usamos loaders, no cachea nada.
3. **`MonthSelect` se vuelve a montar** y recalcula `lastNMonths(24)` en cada render del padre porque el padre se desmonta al navegar.
4. **`ImportWizardDialog` se incluye en el chunk principal** de cada página (lee Excel con SheetJS, ~80 KiB). Eso es justo el "Reduce unused JavaScript: 78 KiB" que reporta Lighthouse — está adentro de `index-CplQSEAv.js`.
5. **Cache HTTP en 0 segundos** para todos los assets de Lovable (Lighthouse: 250 KiB desperdiciados). Esto **no podemos arreglarlo desde código** — lo controla el CDN de Lovable. Lo dejamos documentado.
6. **Render blocking de Google Fonts** (~280 ms): el CSS de Montserrat es bloqueante.

## Cambios propuestos

### Fase A — Frenar el preload masivo (1 archivo)

**`src/router.tsx`**: cambiar `defaultPreload: "intent"` → `defaultPreload: false` y dejar solo `defaultPreloadStaleTime: 0`. La precarga por hover está saturando Supabase. Reemplazaremos esa "magia" por algo más confiable: TanStack Query con cache real.

### Fase B — TanStack Query como capa de cache (3 vistas + setup)

**Setup global** (una sola vez):

- Crear `src/lib/queryClient.ts` con un `QueryClient` configurado: `staleTime: 60_000`, `gcTime: 5 * 60_000`, `refetchOnWindowFocus: false`.
- En `src/router.tsx` (factory `getRouter`): instanciar un `QueryClient` por request y pasarlo en `context`.
- En `src/routes/__root.tsx`: añadir tipo de contexto `{ queryClient }` y envolver `<Outlet />` con `<QueryClientProvider>`.

**Refactor de las 3 vistas — patrón uniforme**:

Para cada feature creamos un archivo de queries y migramos la página:

#### B.1 — `listas-precios`

- Nuevo `src/features/listas-precios/queries.ts`:
  - `priceListsQueryOptions()` → reemplaza `loadLists`.
  - `priceListItemsQueryOptions(listId)` → reemplaza el `useEffect` del `ItemsSheet`.
- En `routes/_app/listas-precios.tsx`: añadir `loader: ({ context }) => context.queryClient.ensureQueryData(priceListsQueryOptions())`.
- En `ListasPreciosPage.tsx`:
  - Cambiar `useState + useEffect + loadLists` por `useSuspenseQuery(priceListsQueryOptions())`.
  - Después de mutaciones (delete, replace, create) → `queryClient.invalidateQueries(['price-lists'])` en lugar de re-llamar a `loadLists`.
- Resultado esperado: la primera carga sigue tardando lo que tarde Supabase, pero al volver a la vista en menos de 60s es **instantánea** (cache) y no flickerea.

#### B.2 — `costos-operacionales`

- Nuevo `src/features/costos-operacionales/queries.ts`:
  - `costCentersQueryOptions()` (compartida entre las dos pestañas).
  - `operationalCostsQueryOptions(month)`.
  - `previousMonthSuggestionQueryOptions(centerId, month)` para el sugeridor.
- En `routes/_app/costos-operacionales.tsx`: `validateSearch` con `{ month?: string }` (zod), `loaderDeps: ({ search }) => ({ month: search.month })`, y precargar `ensureQueryData` para los centros + asignaciones.
- En `CostosOperacionalesPage`: el `month` deja de vivir en `useState` y pasa a `Route.useSearch()` + `useNavigate({ search })`. Esto permite que **al cambiar de mes la URL refleje el filtro** y que volver atrás restaure el estado.
- `AssignmentsTab` y `CentersTab` usan `useSuspenseQuery` y `useMutation` con `invalidateQueries` después de guardar.

#### B.3 — `costos-productos`

- Nuevo `src/features/costos-productos/queries.ts`:
  - `productCostsQueryOptions(month)`.
- Mismo patrón: `validateSearch` con `month`, `loader` con `ensureQueryData`, `useSuspenseQuery` en el componente.
- Mantener el filtro de búsqueda (`search`) como `useState` local — no necesita estar en URL y se aplica sobre data ya cacheada.

### Fase C — Code-splitting de pesos muertos (3 archivos)

El `ImportWizardDialog` carga SheetJS (~80 KiB) y solo se usa cuando el usuario abre el modal de importar. Hoy va en el chunk principal de cada página.

- En `ListasPreciosPage.tsx` y `CostosProductosPage.tsx`: `const ImportWizardDialog = React.lazy(() => import("@/components/excel/ImportWizardDialog").then(m => ({ default: m.ImportWizardDialog })))` y envolver en `<Suspense fallback={null}>`.
- En `CostosOperacionalesPage.tsx`: lazy del `AssignmentDialog` y `CenterDialog` (más livianos pero igual reducen el bundle inicial).

Esto debería bajar `index-CplQSEAv.js` de ~158 KiB a ~80 KiB y atacar directamente el "Reduce unused JavaScript: 78 KiB" del informe.

### Fase D — Render blocking de fuentes (1 archivo)

En `src/routes/__root.tsx`: cambiar la carga de Montserrat a no-bloqueante:

```tsx
{ rel: "preload", href: "...montserrat...", as: "style" },
{ rel: "stylesheet", href: "...montserrat...", media: "print", onLoad: "this.media='all'" }
```

Como TanStack head no soporta `onLoad` en links, alternativa: inyectar el `<link>` desde un componente cliente con `useEffect` o aceptar la pérdida y solo mantener el `preconnect` (que ya existe). **Opción recomendada**: dejar Montserrat solo en `font-display: swap` (ya está) y aceptar los 80 ms — no vale la pena complejidad.

### Fase E — Cache HTTP de assets (no requiere código)

El reporte muestra `Cache-Control: 0` en todos los `.js` y `.css` del dominio Lovable. Esto lo controla el CDN de Lovable, no el repo. No es accionable desde el código de la app. Lo documentamos en el plan y avisamos.

## Detalles técnicos clave

```ts
// src/lib/queryClient.ts
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
```

```ts
// src/features/listas-precios/queries.ts
export const priceListsQueryOptions = () =>
  queryOptions({
    queryKey: ["price-lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("id, name, created_by_name, created_at, updated_at, updated_by_name, price_list_items(count)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data.map(/* ... */);
    },
  });
```

```tsx
// routes/_app/costos-productos.tsx
const searchSchema = z.object({
  month: fallback(z.string(), defaultMonth()).default(defaultMonth()),
});

export const Route = createFileRoute("/_app/costos-productos")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(productCostsQueryOptions(deps.month)),
  /* head ... */
});
```

## Archivos afectados

Modificados:
- `src/router.tsx` (preload off + queryClient en context)
- `src/routes/__root.tsx` (QueryClientProvider + tipo context)
- `src/routes/_app/listas-precios.tsx` (loader)
- `src/routes/_app/costos-operacionales.tsx` (validateSearch + loader)
- `src/routes/_app/costos-productos.tsx` (validateSearch + loader)
- `src/features/listas-precios/ListasPreciosPage.tsx` (Query + lazy dialogs)
- `src/features/costos-operacionales/CostosOperacionalesPage.tsx` (Query + URL state + lazy dialogs)
- `src/features/costos-productos/CostosProductosPage.tsx` (Query + URL state + lazy dialog)

Creados:
- `src/lib/queryClient.ts`
- `src/features/listas-precios/queries.ts`
- `src/features/costos-operacionales/queries.ts`
- `src/features/costos-productos/queries.ts`

## Lo que NO está en este plan

- `analisis-ventas`, `negociaciones`, `calculadora`, `dashboard`: las dejaremos para una segunda iteración una vez validemos que estas 3 mejoraron.
- Cache HTTP del CDN: fuera de nuestro control.
- Reescribir `MonthSelect` para que no recalcule meses: ya está memoizado, no es el problema.

## Resultado esperado

- **Primera entrada a una vista**: igual de rápido que hoy (depende de Supabase) pero **sin** competir con preloads paralelos.
- **Segunda entrada en menos de 60s**: instantánea (cache de Query, sin spinner).
- **Cambio de mes**: se siente como filtrar — la vista anterior queda visible y solo cambian los datos cuando llegan.
- **Bundle inicial de cada vista**: ~50% más pequeño (sin el dialog de Excel).
- **Lighthouse "Reduce unused JS"**: debería desaparecer o bajar a <10 KiB.
