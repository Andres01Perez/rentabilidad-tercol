
# Diagnóstico de Performance Frontend

## Validación de las 3 hipótesis

### Hipótesis 1 — Tablas inmensas sin virtualización: PARCIALMENTE CIERTA

- `AnalisisVentasPage.tsx` **YA usa virtualización** con `@tanstack/react-virtual` (líneas 21, 388–456, `DetailVirtualTable`). El `useVirtualizer` está bien configurado (`overscan: 12`, `estimateSize: 36`). Aquí no hay problema de DOM.
- `RentabilidadTable.tsx` (Calculadora) **NO está virtualizada**. Renderiza todas las filas en un `<TableBody>` con `filteredRows.map(...)` (líneas 330–387). Cada fila monta ~11 `<TableCell>` con clases pesadas (`tabular-nums`, gradients tonales). Con listas/negociaciones de hasta 10.000 ítems (ver `fetchSourceItems` con `.limit(10000)` en `useCalculadora.ts:177,190`) esto puede generar **>100k nodos DOM** y bloquear el hilo principal en cada keystroke o cambio de orden.
- Conclusión: **virtualización es necesaria solo en `RentabilidadTable.tsx`**.

### Hipótesis 2 — Filtros sin debounce: CIERTA

- `RentabilidadTable.tsx` líneas 184–187, 197–198: `search` y `colFilters` (11 inputs) actualizan estado en cada tecla. El `useMemo` de `filteredRows` (200–261) re-ejecuta `parseNumFilter` × 9 + `rows.filter` + `[...filtered].sort` sobre **todos los rows** en cada keystroke. Sin virtualización, además, todo el DOM se reconcilia. Es el principal culpable del "lag al teclear".
- `AnalisisVentasPage.tsx` línea 480, 858–862: el input `search` dispara `useSalesDetail` que ya tiene debounce de 250ms (línea 317 en `useSalesAnalytics.ts`). Bien hecho. Sin embargo, no hay `useDeferredValue` para mantener la UI responsiva mientras se procesa la respuesta.
- `MultiSelectFilter` (líneas 105–183): el `search` interno del popover es síncrono sobre `options` posiblemente grandes (`uniques.terceros` puede tener miles). Falta debounce/deferred.
- Conclusión: **debounce + `useDeferredValue` necesarios en `RentabilidadTable` y `MultiSelectFilter`**.

### Hipótesis 3 — Cascada de re-renders: CIERTA

Hallazgos concretos:

- `AnalisisVentasPage.tsx`:
  - `appliedFilters` está memoizado correctamente (484–491). ✅
  - `toggleSort`, `clearAllFilters`, `handleApply`, `handleDiscard` usan `useCallback`. ✅
  - **PERO**: `analytics.uniques.vendedores/dependencias/terceros` se pasan a `MultiSelectFilter` (697–714). `analytics` se reconstruye en cada render del hook (`useSalesAnalytics` retorna objeto literal nuevo cada vez en líneas 212–226). Aunque `MultiSelectFilter` está envuelto en `React.memo`, el array `options` cambia de referencia, invalidando el memo.
  - `setDraftVendedoresF` se pasa directo como `onChange`. El `setState` de React es estable, pero `MultiSelectFilter` recibe además `selected={draftVendedoresF}` que cambia de referencia al togglear cualquier otro filtro… solo si se usa el mismo array. Se reasigna ok, pero los **otros dos** `MultiSelectFilter` se re-renderizan innecesariamente cuando cambia uno solo, porque sus props `options` son referencias nuevas del hook.
  - `discountOptions = analytics.financialDiscounts` (516) — referencia nueva cada render del padre.
  - `salesMonthOptions` está memoizado (515). ✅

- `RentabilidadTable.tsx`:
  - `SortableHead` y `FilterCell` **NO** están envueltos en `React.memo`. Se re-renderizan los 22 (11 cabeceras + 11 inputs de filtro) en cada keystroke.
  - `setF` (línea 197) crea una nueva función para cada columna en cada render → invalida cualquier `memo`.
  - `getVal` se redefine dentro del `useMemo` en cada cómputo (no es problema mayor).
  - El cuerpo de la tabla no está memoizado por fila.

- `useSalesAnalytics.ts`:
  - El array `vendedoresKey/dependenciasKey/tercerosKey` se reconstruye con `.join("|")` en cada render (129–131). Está bien para deps de useEffect, pero el objeto retornado (212–226) es nuevo cada render. Conviene memoizar el retorno.

## Plan de implementación (Frontend Performance Only)

### Fase 1 — Virtualizar `RentabilidadTable` (impacto alto)

1. Sustituir `<Table>/<TableBody>` por una estructura `<div>` con `useVirtualizer` (idéntico patrón al de `DetailVirtualTable` en `AnalisisVentasPage`).
2. Mantener cabecera sticky con `<div role="row">` de ancho fijo y columnas con `flex-shrink: 0`.
3. Definir un array `COLS` central (key, label, width, align) y un `VirtualRow` envuelto en `React.memo`.
4. Mantener `onExport` recibiendo `filteredRows` (sin cambio de API).

### Fase 2 — Debounce / Deferred values en filtros (impacto alto)

1. **`RentabilidadTable.tsx`**:
   - Usar `useDeferredValue(search)` y `useDeferredValue(colFilters)` para el `useMemo` de filtrado/sort, dejando que los inputs respondan al instante mientras el filtrado corre en background.
   - Mostrar un indicador sutil (`isStale = deferred !== current`) opcional.
2. **`MultiSelectFilter`** (en `AnalisisVentasPage.tsx`):
   - Aplicar `useDeferredValue` al `search` interno antes del `useMemo` de `filtered`.
3. **`AnalisisVentasPage` search principal**:
   - Aplicar `useDeferredValue(search)` antes de pasarlo a `useSalesDetail`, así reduce frecuencia de invalidación adicional al debounce ya existente.

### Fase 3 — Memoización fina (impacto medio)

1. **`RentabilidadTable.tsx`**:
   - Envolver `SortableHead` y `FilterCell` en `React.memo`.
   - Estabilizar `setF` con un `useCallback` que reciba `key` como parámetro o crear un map de callbacks memoizados.
   - Memoizar el `tone` de cada fila vía `VirtualRow` memoizado.
2. **`useSalesAnalytics.ts`**:
   - Envolver el objeto de retorno en `React.useMemo` con dependencias `[loading, hasLoadedOnce, data, salesMonths, financialDiscounts]` para estabilizar referencias.
   - Estabilizar `data.uniques`, `data.rankings`, `data.operationalBreakdown`, `data.financialDiscounts` solo si la respuesta JSON cambió (comparar por `JSON.stringify` cacheado o por el `salesMonth+filters` aplicado).
3. **`AnalisisVentasPage.tsx`**:
   - Memoizar arrays `analytics.uniques.vendedores/dependencias/terceros` con `useMemo` (clave estable) antes de pasar a `MultiSelectFilter`.
   - Memoizar `discountOptions`.
4. **`CalculadoraPage.tsx`**:
   - Envolver `KpiCard` (52–88) en `React.memo`.
   - Memoizar `excludedRows` ya está hecho ✅.

### Fase 4 — Higiene adicional (impacto bajo, gratis)

1. Reemplazar `[...filtered].sort(...)` por `filtered.sort(...)` cuando ya tenemos copia (ahorra una alocación) o pre-precomputar valores de sort fuera del comparador.
2. Cachear `parseNumFilter` resultados con `useMemo` por columna (evita 9 parseos por render incluso si el input no cambió).
3. Confirmar que `formatCurrency`/`formatNumber`/`formatPercent` usan `Intl.NumberFormat` cacheado (revisar `src/lib/period.ts`); si no, cachear la instancia a nivel de módulo.

## Detalles técnicos

### Archivos a modificar
- `src/features/calculadora/RentabilidadTable.tsx` — refactor mayor (virtualización + memo + deferred).
- `src/features/analisis-ventas/AnalisisVentasPage.tsx` — `useDeferredValue` en `MultiSelectFilter` y search; memoización de uniques.
- `src/features/analisis-ventas/useSalesAnalytics.ts` — memoizar el objeto de retorno.
- `src/features/calculadora/CalculadoraPage.tsx` — `React.memo(KpiCard)`.
- `src/lib/period.ts` (revisar; cachear `Intl.NumberFormat` si aplica).

### Sin cambios en
- Supabase, RPCs, esquema de BD.
- Lógica de negocio en `useCalculadora.ts` (cálculo `computeRentabilidad`).
- Layout / estilos visuales (la barra de filtros sticky se conserva tal cual).

### Riesgos
- Cambiar a `<div>` virtualizado pierde semántica `<table>`; mitigación: usar `role="table" / "row" / "cell"`.
- `useDeferredValue` puede mostrar valores "atrasados" un frame; aceptable para filtros.

### Ejemplo de refactor — `RentabilidadTable` con `@tanstack/react-virtual`

```tsx
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Download } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/period";
import { cn } from "@/lib/utils";
import type { RentabilidadRow } from "./useCalculadora";

type SortKey =
  | "referencia" | "descripcion" | "cantidad" | "precio" | "descuentoPct"
  | "precioNeto" | "ctuProm" | "margenUnit" | "margenPct"
  | "margenNetoUnit" | "margenNetoPct";
type SortDir = "asc" | "desc";

const COLS: Array<{ key: SortKey; label: string; width: number; align: "left" | "right" }> = [
  { key: "referencia",     label: "Ref",         width: 120, align: "left"  },
  { key: "descripcion",    label: "Descripción", width: 240, align: "left"  },
  { key: "cantidad",       label: "Cant",        width: 80,  align: "right" },
  { key: "precio",         label: "Precio",      width: 110, align: "right" },
  { key: "descuentoPct",   label: "Desc %",      width: 90,  align: "right" },
  { key: "precioNeto",     label: "Precio neto", width: 120, align: "right" },
  { key: "ctuProm",        label: "CTU prom",    width: 110, align: "right" },
  { key: "margenUnit",     label: "Margen U",    width: 110, align: "right" },
  { key: "margenPct",      label: "Margen %",    width: 100, align: "right" },
  { key: "margenNetoUnit", label: "M. neto U",   width: 110, align: "right" },
  { key: "margenNetoPct",  label: "M. neto %",   width: 100, align: "right" },
];
const TOTAL_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

const VirtualRow = React.memo(function VirtualRow({ r }: { r: RentabilidadRow }) {
  const tone =
    r.margenNetoPct === null ? "" :
    r.margenNetoPct < 0 ? "bg-rose-50/40 dark:bg-rose-500/10" :
    r.margenNetoPct < 5 ? "bg-amber-50/40 dark:bg-amber-500/10" : "";
  return (
    <div className={cn("flex items-center border-b border-border/40 text-sm hover:bg-accent/30", tone)}>
      <div className="px-2 font-bold truncate"  style={{ width: COLS[0].width, flexShrink: 0 }}>{r.referencia}</div>
      <div className="px-2 truncate text-xs text-muted-foreground" style={{ width: COLS[1].width, flexShrink: 0 }}>{r.descripcion ?? "—"}</div>
      <div className="px-2 text-right tabular-nums" style={{ width: COLS[2].width, flexShrink: 0 }}>{formatNumber(r.cantidad)}</div>
      {/* …resto de celdas con la misma estructura… */}
    </div>
  );
});

export function RentabilidadTable({ rows, onExport }: { rows: RentabilidadRow[]; onExport: () => void }) {
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("margenNetoPct");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [colFilters, setColFilters] = React.useState<ColFilters>(EMPTY_FILTERS);

  // 🔑 Inputs responden al instante; el filtrado/sort se aplica con valor diferido.
  const deferredSearch = React.useDeferredValue(search);
  const deferredFilters = React.useDeferredValue(colFilters);

  const filteredRows = React.useMemo(() => {
    /* …mismo algoritmo, pero usando deferredSearch / deferredFilters… */
  }, [rows, deferredSearch, deferredFilters, sortKey, sortDir]);

  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  return (
    <div className="glass rounded-2xl border border-border/60 p-5">
      {/* …header con search + export… */}
      <div ref={parentRef} className="mt-4 max-h-[calc(100vh-200px)] min-h-[500px] overflow-auto rounded-xl border border-border/40">
        <div style={{ width: TOTAL_WIDTH, minWidth: "100%" }}>
          {/* Header sticky */}
          <div className="sticky top-0 z-10 flex bg-card/95 backdrop-blur border-b" style={{ width: TOTAL_WIDTH }}>
            {COLS.map((c) => (<SortableHead key={c.key} {...c} current={sortKey} dir={sortDir} onClick={toggleSort} />))}
          </div>
          {/* Fila de filtros (no virtualizada, 1 sola) */}
          <div className="flex border-b" style={{ width: TOTAL_WIDTH }}>
            {COLS.map((c) => (<FilterCell key={c.key} colKey={c.key} value={colFilters[c.key]} onChange={setF} width={c.width} numeric={c.align === "right"} />))}
          </div>
          {/* Body virtualizado */}
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: TOTAL_WIDTH }}>
            {virtualizer.getVirtualItems().map((v) => {
              const r = filteredRows[v.index];
              return (
                <div key={r.referencia} data-index={v.index} ref={virtualizer.measureElement}
                     style={{ position: "absolute", top: 0, left: 0, width: TOTAL_WIDTH, transform: `translateY(${v.start}px)` }}>
                  <VirtualRow r={r} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Resultado esperado

- **Calculadora**: input de búsqueda y filtros responden instantáneamente incluso con 10.000 productos. DOM con ~30 filas vivas en lugar de 10.000.
- **Análisis de Ventas**: barra de filtros multi-select fluida con miles de terceros; búsqueda principal sin lag perceptible.
- **Re-renders**: cabecera, filtros y filas no se reconstruyen en cascada al teclear.
