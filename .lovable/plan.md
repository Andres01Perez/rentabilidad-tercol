## Objetivo

Eliminar la actualización automática del dashboard y la tabla detalle cada vez que el usuario cambia un filtro. En su lugar, los cambios se mantienen como "borrador" en la UI y solo se ejecutan las consultas (RPCs `get_sales_dashboard` y `get_sales_detail`) cuando el usuario hace clic en un botón **Actualizar**. Esto reduce drásticamente la carga sobre Supabase y elimina los lapsos de lentitud percibidos al combinar varios filtros.

## Alcance

Solo se modifica la página de **Análisis de Ventas** (`/analisis-ventas`). No se tocan RPCs, índices, ni otras pantallas (Calculadora, Costos, etc.). La estrategia de virtualización, memoización e índices ya implementada se mantiene intacta.

## Diseño de UX

Se separan dos conceptos en el estado:

- **Estado borrador (`draft`)**: lo que el usuario está editando en la barra de filtros. Cambia instantáneamente con cada selección.
- **Estado aplicado (`applied`)**: lo que efectivamente se envía a las RPCs. Solo cambia al pulsar **Actualizar**.

Comportamiento:

1. Al cargar la página por primera vez, el estado borrador y el aplicado son iguales (defaults actuales) y se ejecuta una consulta inicial automáticamente — igual que hoy.
2. Al cambiar cualquier filtro (Mes ventas, Mes costos, Mes operacional, Descuento financiero, Vendedor, Dependencia, Tercero) solo se actualiza el borrador. El dashboard NO se recalcula.
3. Aparece un indicador visual "Cambios sin aplicar" (badge ámbar) junto al botón **Actualizar** cuando borrador ≠ aplicado.
4. El botón **Actualizar** (con icono refresh) ejecuta el commit: copia borrador → aplicado, lo que dispara las RPCs.
5. Botón secundario **Descartar** restaura el borrador al estado aplicado actual (solo visible cuando hay cambios pendientes).
6. Atajo: tecla `Enter` con foco en la barra de filtros también aplica.
7. La búsqueda de texto del detalle (`search`) y el ordenamiento (`sortKey/sortDir`) **siguen siendo en tiempo real** (ya tienen debounce de 250ms en el hook y no provocan recálculo del dashboard, solo del detalle). Esto lo confirmaremos manteniendo `search/sortKey/sortDir` fuera del flujo de "borrador".

```text
┌─ Filtros (borrador) ────────────────────────────────────────────┐
│ Mes ventas ▾ │ Mes costos ▾ │ Mes op ▾ │ Desc. fin. ▾          │
│ [Vendedor] [Dependencia] [Tercero]   ⚠ Cambios sin aplicar     │
│                                       [Descartar] [↻ Actualizar]│
└─────────────────────────────────────────────────────────────────┘
```

## Cambios técnicos

**Archivo único a modificar**: `src/features/analisis-ventas/AnalisisVentasPage.tsx`

1. Renombrar los state setters actuales para que representen el **borrador**:
   - `salesMonth` → `draftSalesMonth` / `setDraftSalesMonth`
   - `costPeriod` → `draftCostPeriod`
   - `opPeriod` → `draftOpPeriod`
   - `financialDiscountPct` → `draftFinancialDiscountPct`
   - `vendedoresF` → `draftVendedoresF`
   - `dependenciasF` → `draftDependenciasF`
   - `tercerosF` → `draftTercerosF`

2. Agregar un único objeto de estado **aplicado** inicializado con los mismos defaults:
   ```ts
   const [applied, setApplied] = React.useState({
     salesMonth: previousMonthDefault,
     costPeriod: previousMonthDefault,
     opPeriod: previousMonthDefault,
     financialDiscountPct: 2.5,
     vendedores: [] as string[],
     dependencias: [] as string[],
     terceros: [] as string[],
   });
   ```

3. Los hooks `useSalesAnalytics` y `useSalesDetail` reciben los valores de **`applied`**, no del borrador. Así, cambios al borrador no disparan re-fetch.

4. Funciones `handleApply()` y `handleDiscard()`:
   ```ts
   const handleApply = () => setApplied({ ...draft });
   const handleDiscard = () => { /* setDraftX(applied.x) para cada campo */ };
   ```

5. Detectar cambios pendientes con `hasPendingChanges` (comparación shallow + arrays ordenadas por valor).

6. Mantener compatibles los efectos existentes:
   - El efecto que ajusta `salesMonth` cuando llegan los `salesMonths` debe actualizar **ambos** (`draftSalesMonth` y `applied.salesMonth`) en la primera carga, para que la consulta inicial use un mes válido sin requerir clic.
   - El efecto que ajusta `financialDiscountPct` por defecto idéntico: actualizar borrador y aplicado.

7. La barra de filtros sticky agrega al final un bloque con: badge "Cambios sin aplicar" condicional + botones **Descartar** (variant outline) y **Actualizar** (variant default, con icono `RefreshCw` de lucide-react). El botón **Actualizar** se deshabilita si `!hasPendingChanges` para evitar refetch redundante; opcionalmente permitir clic siempre como "forzar refresh".

8. Mantener `refreshKey` tal cual (lo dispara la subida de Excel) — sigue forzando re-fetch como hoy.

## Qué NO cambia

- Hooks `useSalesAnalytics` / `useSalesDetail`: sin cambios.
- RPCs en Supabase: sin cambios.
- Búsqueda y ordenamiento de la tabla detalle: siguen en tiempo real con debounce existente.
- Listas de "uniques" para los popovers de filtro: siguen viniendo de `analytics.uniques` (datos del último estado aplicado), lo cual es correcto.

## Resultado esperado

- Cambiar 3 filtros consecutivos pasa de 3 round-trips RPC a 0 hasta que el usuario aplica.
- Un solo clic en **Actualizar** dispara una sola consulta consolidada al dashboard + una al detalle.
- Carga inicial sigue siendo automática (sin necesidad de clic).
