
# Optimización de Negociaciones, Calculadora y Análisis de ventas

## Diagnóstico

Las tres vistas comparten el mismo patrón que ya causaba lag en Costos / Listas antes del paso anterior:

1. **Sin caché**: usan `useState + useEffect + supabase.from(...)` directo. Cada navegación re-fetchea desde cero, aunque acabes de venir de la misma vista hace 5 segundos.
2. **Catálogos pesados cliente-side**: `useMonthCatalog` (Calculadora) pagina manualmente `product_costs` y `operational_costs` en lotes de 1000 hasta agotar la tabla — solo para sacar `DISTINCT period_month`. En tablas grandes son varias rondas de red al entrar a la vista.
3. **N+1 en `useSourceOptions` (Calculadora)**: para cada lista de precios hace una query `count` aparte. Con 20 listas son 21 requests serializadas.
4. **Análisis de ventas dispara 3 RPCs en cascada** (`get_sales_months`, `financial_discounts`, `get_sales_dashboard`) cada vez que se monta, sin caché.
5. **Negociaciones** vuelve a pedir `negotiations` cada vez que entras y, dentro del editor, lista todas las `price_lists` de nuevo y hace lookups individuales `eq().eq().maybeSingle()` por referencia.

El paso anterior dejó el `QueryClient` con `staleTime: 60s` montado, pero estas tres vistas no lo aprovechan: ninguna usa `useQuery`. Por eso siguen lentas mientras Listas / Costos ya van fluidas.

## Cambios

### 1. Negociaciones (`src/features/negociaciones/`)

- **Crear `queries.ts`** con `queryOptions` para:
  - `negotiationsQueryOptions()` — la lista (mismo `select` que hoy).
  - `priceListsLightQueryOptions()` — `id, name` ordenado por nombre, compartido con el editor.
  - `negotiationItemsQueryOptions(id)` — items de una negociación.
- **`NegociacionesPage`**: reemplazar `useState/useEffect` por `useQuery(negotiationsQueryOptions())`. La mutación de delete invalida la queryKey.
- **`NegotiationEditor`**: usar `useQuery(priceListsLightQueryOptions())` y `useQuery(negotiationItemsQueryOptions(id))` en vez de los dos `useEffect`.
- **`useReferenceSearch`**: migrar a `useQuery` con `queryKey: ["ref-search", q]`, `enabled: q.length >= 2`, `staleTime: 5 min` (los catálogos de referencias casi no cambian, así repetir la misma búsqueda es instantáneo). Mantener el debounce de 250 ms.

### 2. Calculadora (`src/features/calculadora/`)

- **Crear `queries.ts`** con `queryOptions` para todas las lecturas:
  - `monthCatalogQueryOptions()` — usa el RPC ya existente `get_period_catalog()` en vez de paginar `product_costs` / `operational_costs` desde el cliente. Esto reemplaza decenas de requests por una sola.
  - `sourceOptionsQueryOptions(kind)` — usa el RPC ya existente `get_source_options(p_kind)` en lugar del N+1 de `count`.
  - `sourceItemsQueryOptions(kind, id)` — items de la fuente.
  - `productCostsByMonthsQueryOptions(months)` — paginación, pero cacheada.
  - `operationalByMonthsQueryOptions(months)` — igual.
- **`CalculadoraPage`**: reemplazar todos los `useState/useEffect` de fetching por `useQuery`. El cálculo `computeRentabilidad` se queda en el cliente al pulsar "Calcular" (no es un cuello de botella y depende de la combinación elegida).
- Las previews de "% por mes" y "productos por mes" se vuelven instantáneas tras el primer cálculo gracias al cache de 60 s.

### 3. Análisis de ventas (`src/features/analisis-ventas/`)

- **Refactorizar `useSalesAnalytics.ts`** para usar React Query internamente:
  - `salesMonthsQueryOptions()` — RPC `get_sales_months`, `staleTime: 5 min`.
  - `financialDiscountsQueryOptions()` — catálogo, `staleTime: 5 min`.
  - `salesDashboardQueryOptions(args)` — RPC `get_sales_dashboard` con todos los filtros aplicados como queryKey.
  - `salesDetailQueryOptions(args)` — RPC `get_sales_detail`.
- El hook sigue exportando la misma forma (`{ loading, hasAnySales, kpis, … }`) para no tocar la página, solo cambia su implementación interna.
- Se mantiene el debounce de 250 ms para `search` y los `useDeferredValue` ya existentes.
- Beneficio principal: volver a Análisis de ventas con los mismos filtros muestra el dashboard al instante (cache hit), y cambiar de un mes a otro y volver al anterior también es instantáneo.

### 4. Detalle técnico común

- Todas las queries comparten el `QueryClient` ya configurado en `src/lib/queryClient.ts` (`staleTime: 60s`, `refetchOnWindowFocus: false`).
- Tras crear/editar/borrar se llama `queryClient.invalidateQueries({ queryKey: [...] })` en vez de re-fetch manual.
- No se cambia la UI ni los flujos del usuario; es refactor interno.
- No se tocan los routes (`src/routes/_app/*.tsx`): siguen montando el componente directamente, sin loaders ni `validateSearch` (mantenemos la simpleza del paso anterior).

## Archivos afectados

- Nuevos: `src/features/negociaciones/queries.ts`, `src/features/calculadora/queries.ts`.
- Editados: `NegociacionesPage.tsx`, `NegotiationEditor.tsx`, `useReferenceSearch.ts`, `CalculadoraPage.tsx`, `useCalculadora.ts` (mantiene `computeRentabilidad`, quita los hooks de fetch), `useSalesAnalytics.ts`.

## Resultado esperado

- Primera carga de cada vista: similar a hoy (un round-trip de red).
- Navegaciones siguientes dentro de 60 s: render inmediato desde caché, sin spinner.
- Calculadora: el catálogo de meses pasa de varias rondas paginadas a 1 RPC; las opciones de "Lista de precios" pasan de 21 requests a 1.
- Negociaciones: la búsqueda de referencias y la lista de precios del editor se cachean entre aperturas.
- Análisis de ventas: cambiar filtros y volver a un combo previo es instantáneo.
