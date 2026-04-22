
# Análisis de ventas — Importación + Dashboard cruzado

## Parte 1 — Base de datos

### Nueva tabla `sales`
Una fila por línea de venta del Excel. Reemplazo total en cada importación (sin histórico de cargas).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `sale_date` | date NOT NULL | Construida desde año+mes+día |
| `year` | int NOT NULL | Para agregaciones rápidas |
| `month` | int NOT NULL | 1–12 |
| `day` | int NOT NULL | 1–31 |
| `vendedor` | text | |
| `dependencia` | text | |
| `tercero` | text | Cliente |
| `referencia` | text NOT NULL | Mapea a "ProductoC" — clave para cruzar con costos/precios |
| `cantidad` | numeric(14,4) NOT NULL | |
| `valor_total` | numeric(14,2) NOT NULL | Mapea a "Valor" (total de la línea) |
| `precio_unitario` | numeric(14,2) GENERATED ALWAYS AS (CASE WHEN cantidad <> 0 THEN valor_total/cantidad ELSE NULL END) STORED | Calculado |
| `created_by_id`, `created_by_name` | uuid + text | Trazabilidad |
| `created_at` | timestamptz default now() | |

**Índices** para acelerar el dashboard:
- `(year, month)`, `(sale_date)`, `(referencia)`, `(vendedor)`, `(dependencia)`, `(tercero)`.

**RLS**: políticas abiertas para `anon` (consistente con las demás tablas; documentado como temporal).

**Comportamiento de carga**: cada subida hace `DELETE FROM sales` completo + `INSERT` por lotes (chunks de 500). Confirmación obligatoria en UI antes de borrar.

---

## Parte 2 — Vista `/analisis-ventas`

Reemplaza el placeholder actual. Layout en tres bloques:

### A. Header de control
- Botón **"Subir Excel de ventas"** → dialog con dropzone, vista previa de filas detectadas y warnings, modal de confirmación "Esto reemplazará TODAS las ventas actuales (N filas). ¿Continuar?".
- Mapeo tolerante de columnas (acentos/case): `año|year`, `mes|month`, `dia|day|día`, `vendedor`, `dependencia`, `tercero`, `productoc|producto`, `valor|valor total`, `cantidad|cant`.
- Validación: filas sin año/mes/día/referencia/cantidad/valor se descartan con warning.

### B. Filtros del dashboard (sticky)
- **Rango de fechas**: selector "Desde / Hasta" o atajos (Mes actual, Año actual, Todo).
- **Mes de costos a cruzar**: `MonthSelect` que carga `product_costs` de ese mes (CTU por referencia → costo unitario).
- **Mes de costos operacionales a cruzar**: `MonthSelect` que carga `operational_costs` de ese mes (suma de `percentage` de centros activos → % aplicado al margen bruto).
- Filtros opcionales: vendedor, dependencia, tercero (multi-select desde valores únicos en `sales`).

### C. KPIs y gráficos (estilo Power BI)

**Fila 1 — KPIs (cards con gradiente)**:
- Ventas totales (Σ valor_total).
- Costo total (Σ cantidad × CTU del mes seleccionado, por referencia).
- Margen bruto absoluto y %.
- Margen neto: margen bruto × (1 − % operacional del mes seleccionado).
- # Productos vendidos, # Clientes, # Vendedores activos.

**Fila 2 — Series temporales**:
- Línea: Ventas vs Costo vs Margen por mes (recharts `LineChart`).
- Barras: Ventas por día (drill del mes seleccionado, recharts `BarChart`).

**Fila 3 — Rankings (tablas + barras horizontales)**:
- Top 10 **vendedores** por margen.
- Top 10 **dependencias** por margen.
- Top 10 **terceros (clientes)** por margen.
- Top 10 **productos** por margen, con alerta si margen % < 0 (rojo).

**Fila 4 — Tabla detalle**:
- Tabla con scroll y buscador (referencia/tercero/vendedor) mostrando: fecha, vendedor, dependencia, tercero, ref, cantidad, PUV (precio unitario calculado), CTU del mes, margen unitario, margen %.

### Lógica de cruces (cliente)
1. Cargar `sales` filtradas por rango → `salesRows`.
2. Cargar `product_costs` del mes seleccionado → `Map<referencia, ctu>`.
3. Cargar `operational_costs` del mes operacional → `pctOperacional = sum(percentage)`.
4. Para cada `salesRow`: `costoLinea = cantidad × (ctu ?? 0)`; `margenBruto = valor_total − costoLinea`.
5. Agregaciones se hacen en memoria con `useMemo` (Maps por dimensión). Para volúmenes grandes (decenas de miles), todo cabe holgadamente en cliente.

### Estado vacío
Si no hay ventas: card central con CTA "Subir Excel de ventas".

---

## Parte 3 — Helpers y componentes

- **`src/components/period/DateRangePicker.tsx`**: selector "Desde/Hasta" basado en `react-day-picker` (ya instalado) + atajos.
- **`src/features/analisis-ventas/AnalisisVentasPage.tsx`**: vista principal.
- **`src/features/analisis-ventas/UploadVentasDialog.tsx`**: dropzone + parseo + confirmación.
- **`src/features/analisis-ventas/useSalesAnalytics.ts`**: hook que hace los 3 fetches y devuelve series/rankings memoizados.
- **`src/lib/period.ts`**: agregar helpers `parseDateString("YYYY-MM-DD")` y `formatDay` si hace falta.
- **Recharts directo**: usar `LineChart`, `BarChart`, `Tooltip`, `XAxis`, `YAxis`, `ResponsiveContainer` sin pasar por `@/components/ui/chart` (ese wrapper tiene un error de tipos conocido con la versión actual de recharts y se evita por completo).

## Parte 4 — Ruta

Actualizar `src/routes/_app/analisis-ventas.tsx` para apuntar a `AnalisisVentasPage` (hoy es un `PagePlaceholder`).

---

## Notas

- **Reemplazo total** de `sales` en cada carga (acordado): no se guarda `period_month` agregado porque el Excel ya trae las fechas exactas; el dashboard filtra por rango sobre `sale_date`.
- El precio unitario se calcula como columna generada en BD (`valor_total/cantidad`) para que cualquier consulta lo tenga listo.
- El campo "ProductoC" del Excel se almacena como `referencia` para que coincida exactamente con `product_costs.referencia` y el cruce sea directo.
- RLS abierta como en el resto del proyecto; documentar aviso de seguridad pendiente para producción.

## Entregables

1. Migración: tabla `sales` con índices, columna generada y RLS abierta.
2. Página `/analisis-ventas` con upload + filtros + KPIs + 4 filas de visualizaciones + tabla detalle.
3. Componentes nuevos: `DateRangePicker`, `UploadVentasDialog`, hook `useSalesAnalytics`.
4. Mapeo tolerante para las 9 columnas del Excel.
