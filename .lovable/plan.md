## Problema detectado

La razón por la que **nada se calcula** (ni en vivo ni al guardar las métricas derivadas) es un bug en la función SQL `get_negotiation_realtime` en Supabase. Devuelve error **400** en cada llamada:

```
column r.margen_pct does not exist
hint: Perhaps you meant to reference the column "r.margenPct"
```

La función arma un subquery con alias en camelCase (`margenPct`, `ctuProm`) pero al final hace `ORDER BY r.margen_pct DESC` (snake_case), un nombre que no existe. Como el RPC siempre falla, el hook `useNegotiationLive` nunca recibe filas → KPIs en 0, márgenes vacíos, sin sugerencias.

## Cambios a aplicar

### 1. Migración SQL — corregir `get_negotiation_realtime`

Reemplazar el `ORDER BY r.margen_pct DESC` por `ORDER BY r."margenPct" DESC` (camelCase entre comillas, que es como quedó aliasado en el subquery `r`). No se modifica ninguna otra lógica de la función.

### 2. Sticky de la sección de KPIs en `NegotiationCalculator.tsx`

Hacer que el bloque de tarjetas KPI (Ventas netas / Costo / Margen $ / Margen %) quede pegado al tope al hacer scroll, de modo que al añadir muchas referencias siempre se vean los totales.

- Añadir `sticky top-2 z-30` (o `top-4`) al contenedor del bloque KPI.
- Mantener `backdrop-blur` y borde para que se lea bien sobre la tabla que pasa por debajo.
- Asegurar que la tabla de items (`z-0`) y el dropdown del buscador (`z-50`) sigan respetando el orden visual: buscador encima del KPI sticky.

### Detalle técnico

**SQL (migración):**
```sql
CREATE OR REPLACE FUNCTION public.get_negotiation_realtime(...)
-- ... cuerpo igual ...
-- al final del bloque de sugerencias:
SELECT referencia, descripcion, precio, ctu_avg AS "ctuProm",
       margen_pct AS "margenPct"
FROM ranked
WHERE margen_pct >= p_min_margin_pct
ORDER BY "margenPct" DESC   -- antes: ORDER BY margen_pct DESC ❌
LIMIT GREATEST(p_top_suggestions, 0)
```

**JSX (KPIs sticky):**
```tsx
<div className={cn(
  "glass sticky top-2 z-30 rounded-2xl border p-4 backdrop-blur-xl ...",
  // estados belowMin / okMin / default
)}>
  {/* KPIs */}
</div>
```

Con la función SQL corregida, el RPC devolverá 200 y el hook poblará automáticamente: CTU prom, Margen U, Margen %, Subtotales, KPIs totales y panel de sugerencias. No se requieren cambios adicionales en el frontend para los cálculos.

## Archivos afectados
- Nueva migración Supabase (corrección de `get_negotiation_realtime`)
- `src/features/negociaciones/NegotiationCalculator.tsx` (sticky de KPIs)
