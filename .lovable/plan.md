## Plan: tabla "Detalle de ventas" expandida + ordenamiento + filtros por columna

Tres mejoras coordinadas sobre la tabla detalle al final de `/analisis-ventas`:
1. **Más alta**: aprovechar mejor el espacio vertical.
2. **Ordenamiento por columna**: clic en cabecera para ordenar asc/desc.
3. **Filtros por columna**: caja de búsqueda específica por columna (texto y rangos numéricos) además del buscador global ya existente.

Todo se implementa **dentro de `AnalisisVentasPage.tsx`** sin cambios a `useSalesAnalytics.ts` ni a la BD.

---

### 1. Altura de la tabla

Hoy el contenedor es `max-h-[500px]`. Cambio a una altura responsive: `max-h-[calc(100vh-200px)] min-h-[600px]`. Mucho más alta en pantallas grandes y mínimo cómodo en pequeñas. El `overflow-auto` se conserva y los headers `sticky top-0` siguen visibles al hacer scroll.

Bonus: subo el límite de filas mostradas de **500 a 2000** para aprovechar la nueva altura.

---

### 2. Ordenamiento por columna

Estado nuevo:

```ts
type SortKey = "sale_date" | "vendedor" | "dependencia" | "tercero"
             | "referencia" | "cantidad" | "precio_unitario"
             | "ctu" | "margenU" | "margenPct";
type SortDir = "asc" | "desc";
const [sortKey, setSortKey] = useState<SortKey>("sale_date");
const [sortDir, setSortDir] = useState<SortDir>("desc");
```

Cada `<TableHead>` se vuelve clickeable:
- Clic en columna nueva → `sortDir = "asc"`.
- Clic en la columna activa → alterna `asc` ↔ `desc`.
- Indicador: ícono `ChevronUp`/`ChevronDown` cuando está activa; `ChevronsUpDown` tenue cuando no.

`detailRows` se extiende para aplicar el sort tras los filtros:
- Numérico: `cantidad`, `precio_unitario`, `ctu`, `margenU` (`precio_unitario - ctu`), `margenPct`.
- Texto: `vendedor`, `dependencia`, `tercero`, `referencia` (con `localeCompare`).
- Fecha: `sale_date` (string ISO, comparación lexicográfica).

Nulos siempre al final, sin importar dirección.

---

### 3. Filtros por columna

Mantengo el buscador global existente y agrego una **fila de filtros bajo el header**, con un input compacto por columna:

```text
| Fecha | Vendedor | Dependencia | Tercero | Ref | Cant | PUV | CTU | Mar U. | Mar % |  ← header (sortable)
| [≥]   | [text]   | [text]      | [text]  |[txt]| [≥]  | [≥] | [≥] |  [≥]   |  [≥]  |  ← filter inputs
```

Estado:

```ts
const [colFilters, setColFilters] = useState({
  sale_date: "", vendedor: "", dependencia: "", tercero: "", referencia: "",
  cantidad: "", precio_unitario: "", ctu: "", margenU: "", margenPct: "",
});
```

**Sintaxis numérica** (parser pequeño y predecible):
- `100` → exacto (tolerancia ±0.5)
- `>100`, `>=100`, `<100`, `<=100` → comparación
- `10-100` → rango inclusivo
- vacío o inválido → sin filtro
- Limpia separadores de miles y acepta `,` como decimal.

**UI**:
- Inputs compactos (`h-7 text-xs`).
- Placeholder: texto = `"Filtrar…"`, numérico = `">0"`.
- Botón **"Limpiar filtros"** a la derecha del header de la tabla cuando hay al menos un filtro activo (incluye el buscador global). Resetea todo.

**Combinación**: AND entre columnas + AND con el buscador global. Pipeline en `useMemo`:

```text
analytics.filteredRows  →  buscador global  →  filtros por columna  →  sort  →  slice(0, 2000)
```

---

### 4. Pequeños ajustes UI

- Contador: `"Mostrando X de Y líneas"` ya está; añado `(filtradas: Z)` cuando hay filtros por columna activos.
- Header de la sección: `flex flex-wrap items-center justify-between gap-3` para acomodar el botón "Limpiar filtros" sin romper en mobile.
- Cabeceras clickeables: `cursor-pointer select-none hover:text-foreground transition-colors` con `gap-1`.

---

### 5. Archivos afectados

**Único archivo modificado**: `src/features/analisis-ventas/AnalisisVentasPage.tsx`
- Nuevos imports de `lucide-react`: `ChevronUp`, `ChevronDown`, `ChevronsUpDown`.
- Estado: `sortKey`, `sortDir`, `colFilters`.
- Helpers locales: `parseNumFilter` y `matchNumFilter`.
- `detailRows` extendido (filtros por columna → sort → slice 2000).
- JSX de la tabla: cabeceras como botones, fila de filtros, botón "Limpiar filtros", contenedor con altura nueva.

**Sin cambios**: `useSalesAnalytics.ts`, BD, otros componentes.

---

### 6. Resultado esperado

- Tabla ocupa ~70-80% del viewport en alto, mostrando muchas más filas sin scroll del navegador.
- Cada cabecera ordena al hacer clic (asc → desc), con indicador visual.
- Bajo cada cabecera hay un input de filtro: texto o numérico (`>100`, `<50`, `10-100`, `100`).
- Filtros se combinan en AND con el buscador global.
- Botón "Limpiar filtros" resetea todo cuando hay filtros activos.
- Hasta 2000 filas mostradas (vs 500 anterior).