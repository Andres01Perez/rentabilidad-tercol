# Ajustes a la tabla "Por referencia" en Análisis de ventas

## Objetivo

Limpiar y reordenar las columnas de la tabla virtual del detalle de ventas por referencia, manteniendo (y verificando) los filtros y el ordenamiento bidireccional.

## Cambios en `src/features/analisis-ventas/AnalisisVentasPage.tsx`

### 1. Reordenar columnas de la tabla virtual

Eliminar las columnas **Fecha**, **Cant** y **Dependencia**.

Nuevo orden de columnas (`COLS`):

| # | Columna   | Sort key          | Alineación |
|---|-----------|-------------------|------------|
| 1 | Vendedor  | `vendedor`        | izquierda  |
| 2 | Tercero   | `tercero`         | izquierda  |
| 3 | Grupo     | `grupo`           | izquierda  |
| 4 | Ref       | `referencia`      | izquierda  |
| 5 | PUV       | `precio_unitario` | derecha    |
| 6 | CTU       | `ctu`             | derecha    |
| 7 | Margen U  | `margenU`         | derecha    |
| 8 | Margen %  | `margenPct`       | derecha    |

Anchos sugeridos (px) para que la tabla siga siendo responsiva: Vendedor 170, Tercero 240, Grupo 150, Ref 150, PUV 120, CTU 120, Margen U 130, Margen % 110.

### 2. Actualizar `VirtualRow`

Renderizar únicamente las 8 celdas anteriores en el nuevo orden, manteniendo:
- Tipografía `tabular-nums` para columnas numéricas.
- Color rojo cuando `margenU < 0` o `margenPct < 0`.
- Guion `—` para `ctu`/`margenU`/`margenPct` nulos.

### 3. Sort por defecto

Como la columna **Fecha** desaparece, cambiar el `sortKey` inicial:
```ts
const [sortKey, setSortKey] = React.useState<SortKey>("vendedor");
const [sortDir, setSortDir] = React.useState<SortDir>("asc");
```

El tipo `SortKey` y la lógica de `toggleSort` ya soportan asc/desc para todas estas claves (no se requiere cambio en backend — el RPC `get_sales_detail` ya acepta `vendedor`, `tercero`, `grupo`, `referencia`, `precio_unitario`, `ctu`, `margenU`, `margenPct`).

### 4. Filtros y búsqueda (verificación, sin cambios mayores)

Los filtros globales (Mes de ventas, Vendedor, Dependencia, Tercero, Descuento financiero) y el cuadro de búsqueda siguen aplicándose a esta tabla a través del hook `useSalesDetail` — ya están conectados. Se confirma que:
- `enabled: analytics.hasAnySales && activeTab === "ref"` se mantiene.
- El `Input` de búsqueda y el botón "Limpiar filtros" en la cabecera del bloque de detalle se conservan.
- Cada encabezado seguirá usando `SortableHead`, que alterna asc/desc al hacer click sobre la misma columna.

## Notas

- No se modifica la base de datos.
- No se modifica `useSalesAnalytics.ts` (el tipo `DetailRow` mantiene los campos `sale_date`, `dependencia`, `cantidad` por si se necesitan en otro lugar; sólo dejan de mostrarse en la tabla).
- La tabla "Por grupo" no se toca.
