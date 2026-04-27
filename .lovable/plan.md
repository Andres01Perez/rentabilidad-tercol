# Fix: cálculo de negociación falla con error 404 (42883)

## Diagnóstico

Los logs de red muestran que TODAS las llamadas a `get_negotiation_realtime` están devolviendo:

```
code: 42883
message: function row_to_json(jsonb) does not exist
```

Por eso no se calcula nada (ni en tiempo real ni al guardar): el RPC falla antes de devolver totales/filas/sugerencias.

### Causa raíz

En el bloque de sugerencias del RPC actual, se hace:

```sql
SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY ...), '[]'::jsonb)
FROM (
  SELECT jsonb_build_object(...) AS r   -- r ya es jsonb
  FROM ranked
  ...
) s;
```

`r` ya es de tipo `jsonb` (lo construye `jsonb_build_object`), pero `row_to_json()` solo acepta tipos record/row, no `jsonb`. Postgres no encuentra una sobrecarga válida y aborta la función entera.

## Cambios

### 1. Migración SQL: corregir `get_negotiation_realtime`

Reemplazar el bloque de sugerencias para:
- Eliminar `row_to_json(r)::jsonb` (innecesario porque `r` ya es jsonb).
- Hacer `jsonb_agg(r ORDER BY (r->>'margenPct')::numeric DESC)` directamente sobre el jsonb construido.
- Mantener intacto el resto de la lógica (filas, totales, factor operacional, filtro por margen mínimo, top N).

Pseudocódigo de la corrección:

```sql
SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'margenPct')::numeric DESC), '[]'::jsonb)
INTO v_suggestions
FROM (
  SELECT jsonb_build_object(
    'referencia', referencia,
    'descripcion', descripcion,
    'precio', precio,
    'ctuProm', ctu_avg,
    'margenPct', margen_pct
  ) AS r
  FROM ranked
  WHERE margen_pct >= p_min_margin_pct
  ORDER BY margen_pct DESC
  LIMIT GREATEST(p_top_suggestions, 0)
) s;
```

### 2. Verificación

Después de aplicar la migración, recargar `/negociaciones`, abrir una negociación y comprobar:
- El RPC devuelve 200 (no 404).
- Los KPIs (Ventas netas, Costo total, Margen %) se calculan en tiempo real al cambiar cantidad/descuento.
- Las sugerencias aparecen si hay candidatos sobre el margen mínimo.

## Archivos afectados

- Nueva migración SQL en `supabase/migrations/` que hace `CREATE OR REPLACE FUNCTION public.get_negotiation_realtime(...)` con el bloque de sugerencias corregido.
- No se requieren cambios en el frontend.
