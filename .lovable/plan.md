# Negociaciones como calculadora en tiempo real + costos promediados multi-mes

## Objetivo

1. Permitir que **cualquier vista que use costos de producto** (Negociaciones, Calculadora y Análisis de ventas) acepte uno o varios meses de costo y use el **promedio CTU por referencia** (ignorando ceros).
2. Convertir **Negociaciones** en una calculadora en vivo: al ir agregando referencias, cambiando cantidades, precios o descuentos, se recalculan margen bruto, margen neto y % de margen automáticamente. Si el % cae por debajo del **36%**, se muestra advertencia roja y sugerencias de productos de alto margen para llegar a la meta.

---

## Parte 1 — Soporte multi-mes de costos en backend (RPC)

Se actualizan/crean funciones para que acepten `p_cost_months date[]` en lugar de `p_cost_month date`. Internamente todas calculan el **CTU promedio por referencia** entre los meses dados, considerando solo valores `> 0` (mismo criterio que ya usa `calc_rentabilidad`).

### Cambios de funciones

1. **`get_sales_dashboard`** — reemplazar `p_cost_month date` por `p_cost_months date[]`. El `LEFT JOIN LATERAL` que busca CTU se sustituye por un sub-select que hace `AVG(ctu) FILTER (WHERE ctu > 0)` sobre los meses pedidos.
2. **`get_sales_detail`** — mismo cambio (`p_cost_months date[]`), promedio CTU multi-mes.
3. **`get_sales_by_group`** — mismo cambio.
4. **`calc_rentabilidad`** — ya soporta multi-mes (no cambia).
5. **Nueva `get_negotiation_realtime(p_items jsonb, p_cost_months date[], p_op_months date[], p_min_margin_pct numeric, p_top_suggestions int)`** — devuelve, en una sola llamada:
   - filas por item con `precioNeto`, `ctuProm`, `margenUnit`, `margenPct`, `margenNetoUnit`, `margenNetoPct`, `subtotal`, `costoCero`.
   - totales: `ventasBrutas`, `ventasNetas`, `costoTotal`, `margenBrutoTotal`, `margenBrutoPct`, `margenNetoTotal`, `margenNetoPct`, `avgOpPct`.
   - `belowMin`: bool si `margenBrutoPct < p_min_margin_pct`.
   - `suggestions`: top N referencias con `ctu>0` en los meses elegidos y `margenPct` (basado en una lista de precios de referencia opcional o en `puv` de `product_costs`) por encima de la meta, excluyendo las ya añadidas.
   - El cálculo del % operacional reutiliza la misma fórmula promediada por mes que ya hay en `calc_rentabilidad`.

> Nota: Esta RPC es la "fuente de verdad" del cálculo en vivo y evita N+1 desde el cliente cada vez que se cambia una cantidad.

### Compatibilidad

`get_sales_dashboard`, `get_sales_detail` y `get_sales_by_group` cambian de firma. Se actualizan los hooks (ver Parte 3) para enviar siempre arrays. Si en el futuro se necesita compatibilidad, se puede dejar overload, pero por simplicidad reemplazamos.

---

## Parte 2 — Persistencia de costos seleccionados en negociaciones

Añadir a la tabla `negotiations` una columna nueva:

```
ALTER TABLE public.negotiations
  ADD COLUMN cost_months date[] NOT NULL DEFAULT '{}'::date[],
  ADD COLUMN min_margin_pct numeric NOT NULL DEFAULT 36;
```

Permite que cada negociación recuerde los meses de costos con los que se evaluó y la meta de margen (configurable a futuro, por ahora se setea en 36).

---

## Parte 3 — Frontend: vistas existentes

### 3.1 Calculadora (`src/features/calculadora/`)

Ya soporta multi-mes en cliente. Se mantiene tal cual; sólo se aprovecha la nueva RPC `get_negotiation_realtime` indirectamente al refactorizar negociaciones (la calculadora seguirá usando `calc_rentabilidad`).

### 3.2 Análisis de ventas (`src/features/analisis-ventas/`)

- Reemplazar el control "Mes de costo" por un **MultiMonthPicker** (igual al de Calculadora).
- Estado `costPeriod: string` pasa a `costPeriods: string[]`.
- Hooks `useSalesAnalytics`, `useSalesDetail`, `useSalesByGroup` envían `p_cost_months: string[]` y se ajusta el `queryKey` para incluir el array ordenado.
- En la cabecera del dashboard se muestra una etiqueta tipo "Costos: oct, nov 2025 (promedio)" cuando hay >1 mes.

### 3.3 Sidebar / shared

Sin cambios fuera de las tres vistas.

---

## Parte 4 — Refactor de Negociaciones (la pieza grande)

Se reemplaza el flujo CRUD basado en `Sheet` por una **página completa** en `/negociaciones` que es a la vez listado y editor en vivo.

### Estructura nueva

```
src/features/negociaciones/
  NegociacionesPage.tsx        ← rehacer: layout 2 columnas
  NegotiationsList.tsx         ← panel izquierdo (lista compacta)
  NegotiationCalculator.tsx    ← panel derecho (calculadora en vivo)
  SuggestionPanel.tsx          ← sugerencias para llegar a 36%
  useNegotiationLive.ts        ← hook con cálculo en tiempo real
  queries.ts                   ← +negotiationLiveKey, +useSaveNegotiation
```

### Layout

```text
+-----------------------------------------------------------------+
|  PageHeader: Negociaciones                                      |
+-----------------------------+-----------------------------------+
| Lista (col-span-1)          | Calculadora en vivo (col-span-2) |
|                             |                                   |
| [+ Nueva]                   | Nombre [______]  Meses costo [▼]  |
| - Negociación A   $ 1.2M    | Lista sugerida [▼]   Notas [...]  |
| - Negociación B   $ 850k    |                                   |
| - Negociación C   $ 300k    | Buscar referencia [_________]     |
|                             |                                   |
|                             | Tabla items (qty, precio, %, sub) |
|                             |                                   |
|                             | KPIs: Bruto $/% · Neto $/% · Op % |
|                             | Banner rojo si <36%               |
|                             | Sugerencias: top 5 productos     |
|                             |                                   |
|                             | [Guardar]   [Duplicar]   [Borrar] |
+-----------------------------+-----------------------------------+
```

### Comportamiento en vivo

- Cualquier cambio (añadir referencia, editar `cantidad`, `precio_unitario`, `descuento_pct`, cambiar lista sugerida o meses de costo) dispara la query `get_negotiation_realtime` con un **debounce de 300 ms**.
- El payload de items (`p_items jsonb`) se calcula desde el estado local; los items inválidos (cantidad/precio vacíos) se ignoran del cálculo pero permanecen visibles.
- React Query con `placeholderData: keepPreviousData` para evitar parpadeos durante el recálculo.
- KPIs en cabecera de la calculadora:
  - Ventas brutas, Ventas netas, Costo total, **Margen bruto $ / %**, **Margen neto $ / %**, % operacional aplicado.
  - Si `margenBrutoPct < 36`: borde y texto rojo + icono `AlertTriangle` con mensaje "Negociación por debajo de la meta del 36%. Faltan X p.p.".

### Sugerencias para llegar al 36%

- Desde la RPC, top N referencias (configurable, por defecto 5) ordenadas por `margenPct` descendente, filtradas a las que tengan CTU>0 en los meses elegidos y precio de referencia conocido.
- Cada sugerencia muestra: referencia, descripción corta, precio sugerido, CTU promedio, % margen estimado. Botón **"Añadir"** que la inserta con `cantidad=1`.
- Panel colapsable; sólo aparece si `belowMin === true`.

### Validación y guardado

- Botón **Guardar**: persiste cambios en `negotiations` + `negotiation_items` (mismo patrón de delete-and-insert que ya existe), incluyendo `cost_months` y `min_margin_pct`.
- Estado **dirty** local: si hay cambios no guardados se marca el botón Guardar y se confirma al cambiar de negociación.
- Botón **Nueva**: crea una entrada vacía local (no persiste hasta Guardar).
- Botón **Eliminar**: con `AlertDialog` (mismo del listado actual).

### Eliminación de código

- Se elimina `NegotiationEditor.tsx` (Sheet) y se reemplaza por los componentes nuevos.
- La calculadora (`/calculadora`) sigue funcionando: lee negociaciones a través de `get_source_options` igual que antes.

---

## Parte 5 — Resumen técnico de archivos

**Migraciones**
- 1 migración: alter de `negotiations`, drop+create de `get_sales_dashboard`, `get_sales_detail`, `get_sales_by_group` con firma multi-mes, create de `get_negotiation_realtime`.

**Frontend modificado**
- `src/features/analisis-ventas/AnalisisVentasPage.tsx` — switch a multi-mes para costos.
- `src/features/analisis-ventas/useSalesAnalytics.ts` — `costPeriodMonth: string` → `costPeriodMonths: string[]` en los 3 hooks.
- `src/features/negociaciones/NegociacionesPage.tsx` — rehacer (layout 2 columnas).
- `src/features/negociaciones/queries.ts` — añadir live query y mutación de guardado.

**Frontend nuevo**
- `src/features/negociaciones/NegotiationCalculator.tsx`
- `src/features/negociaciones/NegotiationsList.tsx`
- `src/features/negociaciones/SuggestionPanel.tsx`
- `src/features/negociaciones/useNegotiationLive.ts`

**Frontend eliminado**
- `src/features/negociaciones/NegotiationEditor.tsx`

**Sin cambios**
- `src/features/calculadora/*` (ya multi-mes en cliente).
- Sidebar, rutas (`/negociaciones` sigue apuntando a `NegociacionesPage`).

---

## Notas y supuestos

- La meta del 36% queda configurable a nivel de negociación (`min_margin_pct`), pero la UI por ahora solo muestra el valor; un editor del umbral se puede agregar después sin cambios de schema.
- Las sugerencias requieren un universo de precios. Estrategia: si la negociación tiene `source_price_list_id`, se usa esa lista como referencia de precios; si no, se cae a `product_costs.puv` cuando exista. Esto se calcula dentro de `get_negotiation_realtime` para evitar trips extras.
- Performance: la RPC trabaja sobre `jsonb` (decenas de items típicas), uniéndose con `product_costs` solo en los meses pedidos. Se espera <100 ms.
