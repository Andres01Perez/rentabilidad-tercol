## Objetivo

Acelerar la navegación y el render de las vistas pesadas, sin tocar la lógica de importación de Excel (Dropzone, ImportItemsDialog, ImportWizardDialog, parseo de archivos). Eliminar la página Calculadora que ya no se usa y aplicar code splitting, virtualización en tablas grandes, prefetch suave y `placeholderData` para evitar parpadeos.

## Fase 0 — Eliminar la Calculadora

Borrar la feature completa y todas sus referencias:

- `src/routes/_app/calculadora.tsx`
- `src/features/calculadora/` (página, tabla, charts, queries, exportExcel, MultiMonthPicker, StepCard, useCalculadora)
- Quitar el item "Calculadora" de `src/components/layout/AppSidebar.tsx` (array `analisis`).
- Quitar la entrada `/calculadora` de `ROUTE_LABELS` en `src/routes/_app.tsx`.
- `routeTree.gen.ts` se regenera solo.

Beneficio: bundle más liviano y menos código a mantener. La Calculadora arrastraba `RentabilidadCharts`, `RentabilidadTable` y `exportExcel.ts` (xlsx) en el grafo de la app.

## Fase 1 — Code splitting de rutas pesadas

Convertir las rutas más grandes a archivos `.lazy.tsx` para que su JS solo se descargue cuando se entra a la vista. Las rutas livianas (dashboard, configuraciones, historial, índice) se quedan como están.

Rutas a dividir:

- `/_app/negociaciones` → `negociaciones.tsx` (config) + `negociaciones.lazy.tsx` (componente).
- `/_app/analisis-ventas` → idem.
- `/_app/listas-precios` → idem.
- `/_app/costos-productos` → idem.
- `/_app/costos-operacionales` → idem.

Patrón:

```text
src/routes/_app/negociaciones.tsx        -> createFileRoute con head() y loader (si aplica)
src/routes/_app/negociaciones.lazy.tsx   -> createLazyFileRoute con component
```

Dentro del componente lazy se usa `getRouteApi("/_app/negociaciones")` si necesita hooks de la ruta.

## Fase 2 — Pending UI con skeletons

Añadir `pendingComponent` (usando `Skeleton` de `src/components/ui/skeleton.tsx`) en cada ruta dividida para que el clic dé respuesta visual inmediata mientras se descarga el chunk.

Tiempos: `pendingMs: 200`, `pendingMinMs: 300` para evitar flashes pero responder rápido.

## Fase 3 — Virtualización de listas grandes

Instalar `@tanstack/react-virtual` y aplicarlo solo donde haya volumen real:

1. **`NegotiationCalculator.tsx`** — tabla de ítems de la negociación. Es la que crece y vive en una vista que ya el usuario reportó pesada. Virtualizar el `<TableBody>` (filas con altura fija ~44px). Mantener el header sticky existente y el scroll de página (sin scroll interno).
2. **`NegotiationsList.tsx`** — son cards en grid, no filas. La virtualización aporta poco aquí; se deja con un límite suave: si `rows.length > 80` pasamos a virtualización vertical de filas de cards (3-4 por fila según breakpoint). Si quieres lo dejo fuera por ahora; lo marco como opcional.

(La RentabilidadTable se elimina con la Calculadora, así que no aplica.)

## Fase 4 — Memoización donde duele

- `NegotiationCalculator.tsx`: envolver subcomponentes de fila (`TableRow` de ítem) en `React.memo` y mover el cálculo de totales/márgenes a `useMemo` con dependencias mínimas. Hoy cualquier cambio de un input recalcula y re-renderiza toda la tabla.
- `AppSidebar` ya tiene `NavGroup` memoizado; revisar que `currentPath` no dispare renders innecesarios.

## Fase 5 — Datos: menos parpadeo

Sin tocar nada relacionado con importación de archivos:

- En las queries de listas (`negociaciones/queries.ts`, `listas-precios/queries.ts`, `costos-productos/queries.ts`, `costos-operacionales/queries.ts`, `analisis-ventas/useSalesAnalytics.ts`) añadir `placeholderData: (prev) => prev` (keepPreviousData v5) para que al cambiar filtros/mes no se vea blanco.
- Mantener `defaultPreload: false` actual (el usuario ya lo había bajado para no saturar Supabase). No reactivar hover-prefetch.

## Detalles técnicos

- TanStack Router auto code-splitting está activado por defecto, pero separar componentes en `.lazy.tsx` garantiza que loaders/head queden en el bundle crítico y los componentes pesados (con dependencias como `recharts`, `xlsx`, etc.) salgan a su propio chunk.
- `getRouteApi("/_app/<ruta>")` se usa dentro de los archivos `.lazy.tsx` para acceder a `useLoaderData`/`useSearch` sin volver a importar el `Route`.
- Para virtualización: contenedor con `position: relative`, `height: totalSize`, filas posicionadas absolutas con `transform: translateY`. La tabla envuelve el `<tbody>` virtualizado; el `<thead>` permanece sticky.
- No se modifica `src/components/excel/*`, `ImportItemsDialog.tsx`, ni `ImportWizardDialog.tsx`. La importación dinámica de `xlsx` ya existe en varios sitios y se respeta.

## Entregable

Tras aplicar el plan: navegación entre vistas más rápida (chunks pequeños), respuesta inmediata al clic (skeletons), tablas grandes fluidas (virtualización) y transiciones sin pantalla en blanco (placeholderData), con la Calculadora eliminada del proyecto.