## Objetivo

En la sección inferior de **Análisis de ventas** convertir la tabla actual de detalle en un sistema de **dos pestañas**:

1. **Por referencia** (la que ya existe), añadiendo una columna **Grupo** para que el usuario pueda ver y filtrar visualmente por grupo.
2. **Por grupo** (nueva): tabla resumen con `grupo`, `cantidad`, `ventas totales`, `margen bruto $`, `margen bruto %` y `% de participación` (sobre las ventas totales del periodo filtrado).

Ambas tablas deben respetar los filtros actuales (mes ventas, mes costos, descuento financiero, vendedor, dependencia, tercero, búsqueda).

---

## Cambios en base de datos (Supabase)

Toda la lógica vive en RPCs. No hace falta crear tablas nuevas — `sales.grupo` y `product_costs` ya existen.

### 1. Actualizar `get_sales_detail`

- Devolver `grupo` (de `sales.grupo`) dentro de cada fila de `rows`.
- Permitir ordenar por `grupo` (`p_sort_key = 'grupo'`).
- No cambia la firma, solo el JSON devuelto y el `ORDER BY`.

### 2. Nueva RPC `get_sales_by_group`

Misma forma de filtros que `get_sales_dashboard` / `get_sales_detail`:

```text
get_sales_by_group(
  p_sales_month text,
  p_cost_month  date,
  p_financial_pct numeric,
  p_vendedores   text[] default null,
  p_dependencias text[] default null,
  p_terceros     text[] default null,
  p_search       text   default null,
  p_sort_key     text   default 'ventas',   -- grupo|cantidad|ventas|margen|margenPct|participacion
  p_sort_dir     text   default 'desc'
) returns jsonb
```

Lógica:

- Toma las ventas del mes (`year`, `month` de `p_sales_month`) aplicando los mismos filtros que el resto del módulo (vendedor, dependencia, tercero, search opcional).
- Hace `LEFT JOIN LATERAL` a `product_costs` por `referencia` y `period_month = p_cost_month` para obtener `ctu` (igual que el dashboard).
- Calcula por línea: `valor_neto = valor_total * (1 - p_financial_pct/100)`, `costo_linea = ctu * cantidad`, `margen = valor_neto - costo_linea` (solo cuando hay `ctu > 0`, igual que el resto del módulo para no sesgar).
- Agrupa por `COALESCE(grupo, 'Sin grupo')` y suma:
  - `cantidad`
  - `ventas` (= `SUM(valor_total)`)
  - `ventasNetas`
  - `costo`
  - `margenBruto`
  - `margenPct = margenBruto / ventasNetas * 100`
- Calcula `participacionPct = ventas_grupo / SUM(ventas_total_periodo) * 100` usando un total general que respeta los mismos filtros.
- Devuelve `{ rows: [...], totalVentas, totalGrupos }` con orden según `p_sort_key`/`p_sort_dir`.

---

## Cambios en frontend

### `src/features/analisis-ventas/useSalesAnalytics.ts`

- Añadir `grupo: string | null` a `DetailRow`.
- Nuevo hook `useSalesByGroup(args)` que llama a `get_sales_by_group`. Reutiliza la misma forma de `args` que `useSalesDetail` (mes ventas, mes costos, % financiero, filtros, search, sort, refreshKey, enabled).
- Tipo `GroupRow`: `{ grupo, cantidad, ventas, ventasNetas, costo, margenBruto, margenPct, participacionPct }`.

### `src/features/analisis-ventas/AnalisisVentasPage.tsx`

- Sustituir el bloque actual `Tabla detalle` por un contenedor con `Tabs` (`@/components/ui/tabs`) con dos `TabsTrigger`: "Por referencia" y "Por grupo".
- Mantener fuera de los tabs: el header (título + buscador + limpiar filtros) y el indicador de carga; el conteo (`Mostrando X de Y`) cambia según el tab activo.
- **Tab "Por referencia"**: la `DetailVirtualTable` actual con una columna nueva **Grupo** insertada después de "Ref" (ancho ~120 px, alineación izquierda). Añadir `'grupo'` a `SortKey` y al array `COLS`. Renderizar `row.grupo ?? "—"` truncado.
- **Tab "Por grupo"**: tabla nueva (no virtualizada — los grupos son pocos) usando los componentes `Table`/`TableHeader`/`TableRow`/`TableCell` ya disponibles, con columnas:
  - Grupo
  - Cantidad (number)
  - Ventas totales (currency)
  - Margen bruto $ (currency, rojo si negativo)
  - Margen bruto % (percent, rojo si negativo)
  - % participación (percent)
  Con encabezados ordenables (mismo patrón visual que `SortableHead`) y fila final de totales (cantidad, ventas, margen $; % calculado sobre el total).
- El tab activo se guarda en `useState<'ref' | 'grupo'>('ref')`. La query del grupo solo se monta cuando el tab está activo (`enabled: tab === 'grupo'`) para no pegarle a la RPC sin necesidad.

### Otros archivos

- `src/integrations/supabase/types.ts` se regenera automáticamente tras la migración; no se edita a mano.

---

## Detalles técnicos

- **Reutilización de filtros**: ambos tabs leen del mismo estado aplicado (`applied`) y del mismo `search` debounced. No se introducen filtros nuevos por ahora — el grupo se lee, no se filtra (queda abierto para una futura iteración).
- **Consistencia de criterio**: la tabla por grupo usa la misma regla del dashboard (excluye líneas sin `ctu > 0` del cálculo de margen) para que los números cuadren con los KPIs superiores.
- **Performance**: `get_sales_by_group` agrega en SQL y devuelve a lo sumo decenas de filas; no requiere virtualización.
- **Compat**: `useSalesDetail` sigue funcionando igual; solo agrega `grupo` y soporta `sort_key='grupo'`.

---

## Resultado esperado

```text
Análisis de ventas
├── KPIs y rankings (sin cambios)
└── Bloque inferior
    ├── [Tab] Por referencia → tabla actual + columna Grupo
    └── [Tab] Por grupo      → resumen agregado con participación
```

Cuando apruebes, implemento la migración SQL y los cambios de UI en una sola pasada.
