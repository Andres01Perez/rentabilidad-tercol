
# Plan: Calculadora de rentabilidad (/calculadora)

Vista nueva, completa y guiada paso a paso. Reutiliza convenciones de Análisis de ventas (KPI cards, tabla con sort/filtros, gráficos Recharts) y los formatos de moneda y porcentaje existentes.

## Flujo de usuario

```text
[1] Fuente de precios          [2] Meses de costos        [3] Meses operacionales      [4] Calcular
─────────────────────────  →   ────────────────────────  → ────────────────────────  → ────────────
Lista de precios  ó             Multi-select de meses        Multi-select de meses          Botón
Negociación                     (uno o varios)               (uno o varios)                "Calcular
                                Muestra % por mes            Muestra % por mes              rentabilidad"
                                + promedio resultante        + promedio resultante
```

Cada paso vive en su propia tarjeta. Hasta que un paso esté completo, el siguiente queda deshabilitado con un mensaje "Completa el paso anterior". El botón "Calcular" sólo se activa cuando los 3 pasos están listos.

## Estructura de la página

1. **Paso 1 – Fuente de precios**
   - Toggle "Lista de precios" / "Negociación".
   - Combobox buscable con las opciones disponibles (consulta a `price_lists` o `negotiations`).
   - Resumen al elegir: nombre, # items, total estimado.

2. **Paso 2 – Meses de costos de producto**
   - Multi-select de meses (chips removibles) usando los meses disponibles en `product_costs.period_month` (DISTINCT).
   - Tabla compacta de meses elegidos con: # productos, fecha. Útil para auditar.
   - Cuando hay ≥2 meses: badge "Promedio aplicado".
   - Cálculo: por cada `referencia` se promedia el `ctu` entre los meses seleccionados (ignorando meses sin dato para esa referencia). Se guarda el detalle por mes para mostrarlo en una columna expandible o tooltip.

3. **Paso 3 – Meses de costos operacionales**
   - Multi-select de meses, mismo patrón.
   - Tabla con: mes, suma de % de centros activos, conteo de centros.
   - Promedio resultante en grande (ej: "Promedio: 12.34%").
   - Cálculo: por cada mes elegido se suma `operational_costs.percentage` (joineado a `cost_centers` activos). Luego se promedian los totales mensuales. Tooltip explica la fórmula.

4. **Paso 4 – Botón "Calcular rentabilidad"**
   - Dispara el cómputo en cliente (no requiere RPC). Muestra spinner.

5. **Resultado**
   - **KPIs (5–6 cards)**: Items calculados, Precio total, Costo total (CTU promedio × cant=1 base), Margen bruto total, Margen bruto %, Margen neto % (luego de op).
   - **Tabla de rentabilidad** (parecida a Análisis de ventas, mejorada):
     - Columnas: Ref (Montserrat bold), Descripción, Precio venta, Descuento %, Precio neto, CTU promedio, Margen unitario, Margen %, Margen neto unitario, Margen neto %, Tag (negociación: precio efectivo con descuento; lista: precio sin descuento).
     - Encabezados con sort asc/desc en todas (componente `SortableHead` ya existente, lo extraemos a un compartido).
     - Fila de filtros por columna (texto y operadores numéricos `>`, `>=`, `<`, `<=`, `a-b`) — reutilizamos `parseNumFilter` / `matchNumFilter` de `AnalisisVentasPage`.
     - Búsqueda global por ref/descripción.
     - Botón "Limpiar filtros".
     - Resaltado de filas: rojo suave si margen neto < 0; ámbar si margen neto entre 0 y 5%.
     - Tooltip por fila con desglose del CTU mensual cuando hay varios meses.
     - Altura responsiva con scroll vertical sólo en el cuerpo (header sticky); sin scroll horizontal en >=lg, scroll horizontal sólo en mobile.
   - **Gráficos (Recharts)** con insights:
     1. **Top 10 productos por margen bruto absoluto** (BarChart horizontal).
     2. **Top 10 productos con peor margen %** (BarChart, rojo) — alerta de productos que destruyen valor.
     3. **Distribución de margen %** (Histogram via BarChart con buckets: <0%, 0-10, 10-20, 20-30, 30-40, 40+) — ver la salud general del portafolio.
     4. **Scatter precio vs margen %** (ScatterChart) — detectar productos caros con margen bajo.
   - **Exportar a Excel**: botón "Descargar Excel" arriba de la tabla. Genera un `.xlsx` con hojas:
     - "Rentabilidad" — todas las columnas de la tabla (respetando filtros y orden actuales).
     - "Resumen" — selecciones (fuente, meses, % op promedio) + KPIs.
     - "Costos por mes" — desglose CTU por referencia y mes seleccionado.

## Lógica de cálculo (por producto)

Variables: `precio` (de la lista o negociación), `descuento_pct` (sólo si negociación), `ctu_prom`, `op_prom_pct`.

```text
precio_neto       = precio * (1 - descuento_pct/100)        # si lista, descuento = 0
margen_unit       = precio_neto - ctu_prom
margen_pct        = margen_unit / precio_neto * 100
margen_neto_unit  = margen_unit - precio_neto * (op_prom_pct/100)
margen_neto_pct   = margen_neto_unit / precio_neto * 100
```

Si `ctu_prom` es null (no hay costo en ningún mes elegido para esa ref) → fila se muestra con margen "—" y badge "Sin costo".

## Datos a consultar

- `price_lists` y `negotiations`: listado para combobox.
- Al elegir fuente:
  - Lista → `price_list_items` (referencia, descripcion, precio).
  - Negociación → `negotiation_items` (referencia, descripcion, precio_unitario, descuento_pct, precio_venta, cantidad).
- `product_costs` filtrado por `period_month IN (…)` con paginación 1000.
- `operational_costs` filtrado por `period_month IN (…)` joineado con `cost_centers` activos.
- DISTINCT meses disponibles para los multi-selects.

Todo lectura, sin migraciones de BD.

## Detalles técnicos

- Nuevos archivos:
  - `src/features/calculadora/CalculadoraPage.tsx` — composición de la página y los pasos.
  - `src/features/calculadora/useCalculadora.ts` — hook con estado de pasos, fetch on demand y cálculo memoizado.
  - `src/features/calculadora/StepCard.tsx` — wrapper visual de cada paso (numerado 1/2/3/4).
  - `src/features/calculadora/MultiMonthPicker.tsx` — popover con checkbox por mes (usa `lastNMonths` y filtra a meses con datos).
  - `src/features/calculadora/RentabilidadTable.tsx` — tabla con sort + filtros + export.
  - `src/features/calculadora/RentabilidadCharts.tsx` — los 4 charts.
  - `src/features/calculadora/exportExcel.ts` — usa `xlsx` (ya instalado) para construir el workbook.
  - `src/lib/tableFilters.ts` — extraer `parseNumFilter`, `matchNumFilter`, `matchTextFilter`, `SortableHead`, `FilterCell` desde `AnalisisVentasPage` para reusar (refactor sin cambios de comportamiento).
- Reemplazar `src/routes/_app/calculadora.tsx`:
  - Cambiar el `PagePlaceholder` por `<CalculadoraPage />` y actualizar `head()` con título y descripción reales.
- Sidebar: el ítem "Calculadora" ya existe y apunta a `/calculadora` (no requiere cambios).
- Tipografía Montserrat bold para la columna `Ref` en la tabla, consistente con la negociación.
- Responsive: layout `grid-cols-1 xl:grid-cols-3` para los pasos 1–3 (en xl se ven en una fila); KPI grid `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`.
- Performance: cálculos memoizados; las consultas se disparan sólo al pulsar "Calcular".

## Resultado esperado para el usuario

- Una página guiada en 4 pasos visualmente claros.
- Cada paso muestra explícitamente los % por mes y el promedio cuando elige varios.
- Una tabla potente (sort, filtros por columna, search global, export Excel) con la rentabilidad de cada producto de la fuente elegida.
- Cuatro gráficos accionables: quién aporta más margen, quién destruye, cómo se distribuye la rentabilidad y el cruce precio/margen.
- Botón para descargar todo a Excel con tres hojas de detalle.
