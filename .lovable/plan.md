# Auditoría de rendimiento – Diagnóstico y plan de acción

> Solo diagnóstico y arquitectura. No se modificará código hasta tu aprobación.

---

## Contexto medido

Volúmenes reales en BD (consultados ahora):

| Tabla | Filas | Meses distintos |
|---|---:|---:|
| `sales` | 12.100 (≈3K/mes × 4 meses) | 4 |
| `product_costs` | 990 | 3 |
| `operational_costs` | 9 | 3 |
| `price_list_items` | 488 | – |
| `negotiation_items` | 3 | – |

El volumen aún es modesto, pero los **patrones** ya escalan mal: con 1 año de ventas (≈40K filas) o 5 listas de precios la app se vuelve casi inusable. El cuello no está tanto en el volumen actual como en **cómo se trae y se procesa**.

---

## PASO 1 — Diagnóstico de Data Fetching (Supabase)

### 1.1 Paginación completa de tablas solo para sacar valores distintos (crítico)

Tres lugares hacen `SELECT … RANGE 0..1000` repetido sobre toda la tabla **únicamente** para construir un dropdown de meses o un set de uniques:

- `src/features/calculadora/useCalculadora.ts` → `useMonthCatalog`: pagina **toda** `product_costs` (990 filas) y **toda** `operational_costs` solo para extraer `period_month` distintos. Debería ser un `SELECT DISTINCT period_month`.
- `src/features/analisis-ventas/useSalesAnalytics.ts` (líneas 190-223): pagina **toda** la tabla `sales` (12.100 filas hoy, decenas de miles mañana) solo para listar (year, month) en el `MonthSelect`. Es la consulta más costosa de toda la app y se ejecuta en cada `refreshKey`.
- En el mismo hook (líneas 177-188) hay además un `count exact head: true` sobre `sales` solo para saber si hay alguna venta. Es OK pero redundante: el primer `range(0, PAGE-1)` ya devuelve `count` exacto.

### 1.2 Consultas N+1

- `useSourceOptions` (calculadora, líneas 117-138): por cada lista de precios dispara un `count exact head` separado → 1 + N consultas. Con 5-10 listas son 6-11 round-trips secuenciales en cada montaje.
- `CalculadoraPage` (líneas 158-175): el preview de costos hace **un fetch independiente por cada mes seleccionado** (`Promise.all(costMonthsSel.map(m => fetchProductCostsByMonths([m])))`) y `fetchProductCostsByMonths` a su vez **pagina toda la tabla**. Resultado: si eliges 3 meses ⇒ 3 paginaciones completas, **+ otra paginación adicional** dentro de `handleCalculate` cuando se calcula. Mismo costo se repite tras cada cambio en la selección.

### 1.3 Agregaciones pesadas en el cliente que pertenecen a SQL

Todo lo siguiente se hace en JavaScript después de traer las filas crudas:

- **Análisis de ventas (`useSalesAnalytics`)**: trae las 3K filas del mes y luego, en `useMemo`, calcula:
  - KPIs (ventas, costo, margen bruto, ventas netas, utilidad operacional, conteos de productos/clientes/vendedores).
  - Series mensuales y diarias.
  - 4 rankings (vendedores, dependencias, terceros, productos), cada uno reagrupando todas las filas.
  - 3 sets de uniques (vendedor/dependencia/tercero) sobre la tabla cruda.
  
  Todo eso podría resolverse en **una sola RPC** que devuelva el bundle completo (KPIs + series + rankings + uniques) en una llamada, sin traer las 3K-12K filas al cliente. La tabla detallada sí necesita filas, pero solo cuando el usuario abre la sección y con paginación/filtros server-side.

- **Calculadora**: `computeRentabilidad` recorre items × meses para promediar CTU. Es ligero, pero el promedio por referencia y el join con costos también puede vivir en una RPC `calc_rentabilidad(source_kind, source_id, cost_months, op_months)` que devuelva `RentabilidadRow[]` listo, evitando traer los costos crudos.

### 1.4 Selecciones innecesariamente anchas

No hay `select('*')` flagrantes (bien), pero:
- `CostosProductosPage` selecciona las 18 columnas de `product_costs` para mostrar la tabla del mes; si solo hace falta visualizar, está OK, pero si en el futuro se filtra/ordena server-side conviene paginar.
- `useCalculadora.fetchSourceItems` usa `limit(10000)` — si una lista crece, se trae todo a memoria.

### 1.5 Falta de índices

Con las consultas más frecuentes (`sales` por `sale_date`/`year`/`month`/`vendedor`/`tercero`, `product_costs` por `period_month`, `operational_costs` por `period_month`) no se ha confirmado la existencia de índices. Hoy no duele por el volumen, pero a 100K ventas sí.

---

## PASO 2 — Diagnóstico de renderizado en React

### 2.1 Cascada de recomputaciones en `AnalisisVentasPage`

En `useSalesAnalytics` el `filteredRows` (líneas 341-380) depende de `salesRows + filtros de página + descuento financiero`. **Cada vez que recalcula** se invalidan, en cadena:

- `kpis`, `monthlySeries`, `dailySeries` (cada uno itera todas las filas)
- `buildRanking` × 4 rankings
- `uniques` (recorre filas crudas)
- `excludedRows`

Y luego en `AnalisisVentasPage`, el `detailState` (líneas 508-579) vuelve a iterar `filteredRows` para filtros de columna + ordenamiento, y devuelve hasta **2.000 filas**. Cada tecla en el buscador o filtro de columna re-renderiza esa tabla completa. `useDeferredValue` ayuda al input pero no a la tabla.

### 2.2 Tabla detallada sin virtualización

`AnalisisVentasPage` y `RentabilidadTable` renderizan hasta 2.000 filas (cada una con 10-11 `<TableCell>` y clases con `cn`). Eso son 20K-22K nodos DOM por tabla, sin `React.memo` por fila ni windowing. Es el principal culpable de la sensación de "lag" al filtrar/ordenar.

### 2.3 `AuthContext` causa re-renders globales

`AuthProvider` arranca un `refreshUsers()` en `useEffect` aun en rutas autenticadas (líneas 41-44 de `AuthContext.tsx`). `appUsers` solo se necesita en `/login`. Cada `setAppUsers` actualiza el `value` memoizado del contexto y todos los consumidores (incluido `AppLayout`, `AppSidebar`) se re-renderizan. Además, mezcla "sesión" con "catálogo de usuarios" en el mismo provider.

### 2.4 `SidebarProvider` envuelve toda la app autenticada

Cualquier toggle del sidebar provoca cambio de estado en el provider que envuelve `<Outlet />`. No hay aislamiento entre la barra y el contenido. Se nota como "lag" al colapsar el menú estando en una vista pesada.

### 2.5 Falta de `useCallback`/memoización en handlers que entran como prop

`setColFilters((p) => ({ ...p, sale_date: v }))` se redefine en cada render para cada `<FilterCell>`, igual en `RentabilidadTable`. Sin memoización + sin `React.memo` en `FilterCell`/`SortableHead`, todos se re-renderizan en cada tecla.

### 2.6 Iconos pesados

`lucide-react` se importa con muchos íconos (≈22 en `AnalisisVentasPage`). Aporta al payload inicial pero no al lag interactivo (es un coste de carga, ya bajado parcialmente con lazy routes).

---

## PASO 3 — Plan de acción priorizado

### Prioridad P0 — Backend (Supabase): RPC + índices

Estas son las recomendaciones de mayor impacto. Reducen tráfico, alivian el cliente y hacen que las cascadas de `useMemo` operen sobre objetos pequeños.

1. **RPC `get_sales_dashboard(p_sales_month, p_cost_month, p_op_month, p_financial_pct, p_vendedores, p_dependencias, p_terceros)`**
   - Devuelve un único JSON con: `kpis`, `monthly_series`, `daily_series`, `rankings` (top 10 ×4), `uniques` (vendedores/dependencias/terceros del mes), `op_breakdown`, `coverage` (`ctu_map_size`, `lineas_excluidas`, `lineas_costo_cero`, `lineas_sin_costo`).
   - Todas las agregaciones se hacen en SQL con `GROUP BY` + `JOIN LATERAL` sobre `product_costs`/`operational_costs`.
   - Reemplaza ~6 `useMemo` y la carga completa de filas para los KPIs.

2. **RPC `get_sales_detail(p_sales_month, filtros, sort, offset, limit)`**
   - Reemplaza el `filteredRows.slice(0, 2000)` cliente. El cliente solo recibe la página visible (50-200 filas).
   - Permite filtros y ordenamiento server-side con índices.

3. **RPC `get_sales_months()`** (o vista materializada `sales_month_index`)
   - Devuelve los meses distintos en una consulta. Elimina la paginación completa de `sales` solo para el dropdown.

4. **RPC `get_period_catalog()`**
   - Devuelve `cost_months[]` y `op_months[]` distintos en un round-trip. Reemplaza `useMonthCatalog`.

5. **RPC `calc_rentabilidad(p_source_kind, p_source_id, p_cost_months, p_op_months)`**
   - Hace el join precio × costos × % operacional y devuelve `RentabilidadRow[]`. Elimina `fetchProductCostsByMonths` + `fetchOperationalByMonths` + `computeRentabilidad` cliente.

6. **RPC `get_cost_month_summary(p_months)`** (o reescritura cliente con `IN`)
   - Devuelve `[{month, product_count}]` en una sola consulta para el preview de Calculadora. Reemplaza el N+1 actual.

7. **RPC `get_source_options(p_kind)`**
   - Para listas de precios: `LEFT JOIN LATERAL (SELECT count(*) FROM price_list_items …)`. Resuelve N+1.

8. **Índices recomendados** (todos `CREATE INDEX IF NOT EXISTS`):
   - `sales(sale_date)`, `sales(year, month)`, `sales(vendedor)`, `sales(tercero)`, `sales(dependencia)`, `sales(referencia)` — soporta filtros del dashboard.
   - `product_costs(period_month, referencia)` — lookup de CTU por mes/ref.
   - `operational_costs(period_month, cost_center_id)` — agregación operacional.
   - `price_list_items(price_list_id)` — count y lookups.
   - `negotiation_items(negotiation_id)`.

9. **Vista (opcional, P1)** `v_sales_with_cost` que precompute `valor_neto`, `costo_linea`, `margen_bruto` por línea para una fecha y descuento dados — útil si se quiere atacar reporting más rico sin recomputar en cliente.

### Prioridad P1 — Refactor de hooks de fetching

10. **`useSalesAnalytics` → `useSalesDashboard`**: una única `useQuery` (o `useEffect`) llama a la RPC P0.1; `filteredRows` deja de existir como objeto gigante en memoria.
11. **Detalle de la tabla**: pasa a `useInfiniteQuery` o paginación server-side con la RPC P0.2.
12. **`useMonthCatalog`** y catálogo de meses de ventas: dejan de paginar tablas; usan P0.3 / P0.4.
13. **`fetchProductCostsByMonths` / `fetchOperationalByMonths` / `computeRentabilidad`**: se reemplazan por una sola llamada a P0.5.
14. **`useSourceOptions`**: pasa a P0.7 (sin N+1).
15. **`AuthContext`**: separar en dos contextos:
    - `SessionContext` (solo `user`, `login`, `logout`) — estable.
    - `AppUsersContext` — solo se monta y carga en `/login`.
   Esto evita re-renders globales cuando llega el catálogo de usuarios.

### Prioridad P2 — Render React

16. **Virtualizar las tablas grandes**:
    - `AnalisisVentasPage` (detalle) y `RentabilidadTable` con `@tanstack/react-virtual` (windowing por filas dentro del `<TableBody>`).
    - Reduce nodos DOM de ~22K a ~300-500 por tabla.
17. **Memoizar `<FilterCell>` y `<SortableHead>`** con `React.memo` y estabilizar handlers con `useCallback`. Junto con la virtualización, las recomputaciones de filtros dejan de ser perceptibles.
18. **Aislar el `SidebarProvider`** del `<Outlet />`: mover el provider a un layout más pequeño que solo envuelva la barra y el header, no el contenido. (O memoizar `<Outlet />` con `React.memo` + estabilizar el `value` del provider.)
19. **Mantener `useDeferredValue`** en el buscador de la tabla y agregarlo también para `colFilters` agregados.
20. **Usar `useMemo` con dependencias estrictas** y dividir `useSalesAnalytics` para que los filtros de columna **no** disparen el recálculo de KPIs/series/rankings — pasar a la RPC esa frontera.

### Prioridad P3 — Bundle (continuación de la fase anterior)

21. **Iconos**: extraer un barrel propio para que tree-shaking elimine los no usados; o sustituir por `lucide-react/dist/esm/icons/<icon>` puntuales en pantallas pesadas.
22. Confirmar que `xlsx` y `recharts` siguen fuera del bundle inicial.

---

## Resumen ejecutivo (qué construir)

```text
SUPABASE
  ├─ RPCs nuevas
  │   ├─ get_sales_dashboard       (KPIs + series + rankings + uniques)
  │   ├─ get_sales_detail          (paginación + filtros + sort server-side)
  │   ├─ get_sales_months
  │   ├─ get_period_catalog        (meses de costos y operacionales)
  │   ├─ calc_rentabilidad         (calculadora completa)
  │   ├─ get_cost_month_summary
  │   └─ get_source_options
  └─ Índices
      ├─ sales (sale_date, (year,month), vendedor, tercero, dependencia, referencia)
      ├─ product_costs (period_month, referencia)
      ├─ operational_costs (period_month, cost_center_id)
      └─ price_list_items (price_list_id), negotiation_items (negotiation_id)

REACT
  ├─ Hooks
  │   ├─ Reescribir useSalesAnalytics → consume RPC dashboard
  │   ├─ useSalesDetail (infinite query) → consume RPC detalle
  │   ├─ Reescribir useMonthCatalog y catálogo de meses de ventas
  │   ├─ Reescribir useSourceOptions (sin N+1)
  │   └─ Partir AuthContext en SessionContext + AppUsersContext
  ├─ Render
  │   ├─ Virtualizar AnalisisVentasPage detalle + RentabilidadTable
  │   ├─ React.memo en FilterCell, SortableHead, RankingCard, KpiCard
  │   ├─ Aislar SidebarProvider del Outlet
  │   └─ Estabilizar handlers (useCallback) en filtros de tabla
  └─ Bundle (P3)
      └─ Reducir lucide-react inicial; mantener xlsx/recharts dinámicos
```

## Impacto esperado

- **Análisis de ventas**: tiempo desde click → KPIs visibles cae de ~3-5s (hoy: 1 round-trip + 4 paginaciones + 6 useMemo gigantes) a **<500ms** (1 RPC).
- **Filtros de columna y búsqueda**: hoy bloquean el hilo principal por la cascada de recomputaciones; con virtualización + handler memoizado deberían quedar **a 60fps**.
- **Calculadora**: el "preview" deja de hacer 1 paginación completa por mes seleccionado; el botón Calcular pasa de 2 paginaciones a 1 RPC.
- **Sidebar / navegación**: dejan de notarse "tirones" al cambiar de ruta porque `AuthContext` y `SidebarProvider` ya no provocan re-render del subárbol.

## Lo que **no** voy a tocar

- La lógica financiera ya validada (margen bruto sobre ventas netas, exclusiones por costo cero/sin costo, descuento financiero).
- La estructura de las tablas ni sus columnas.
- Las RLS existentes (las RPC se crearán con `security definer` solo cuando sea necesario; en general usarán `security invoker` para respetar RLS actual).

---

**Siguiente paso (espera tu aprobación):** Si das luz verde, ejecuto en este orden:

1. Migration con índices + RPCs P0.1, P0.2, P0.3, P0.4, P0.5, P0.6, P0.7.
2. Refactor `useSalesAnalytics` y `AnalisisVentasPage` (incluye virtualización del detalle).
3. Refactor `useCalculadora` + `CalculadoraPage`.
4. Refactor `useSourceOptions` + split de `AuthContext` + aislamiento de `SidebarProvider`.
5. Limpieza de `lucide-react` y verificación de bundle.
