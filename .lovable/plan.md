

# Plan: ajustes al editor de negociaciones (referencia limpia + tipografía + descuento %)

Tres cambios coordinados sobre `NegotiationEditor.tsx`, una migración de BD para persistir el descuento, y un pequeño ajuste de tipografía.

## 1. Listado de búsqueda: solo código de referencia

En el dropdown de sugerencias (`NegotiationEditor.tsx`, sección "Search + suggestions"):

- Eliminar el `<span>` que muestra `r.descripcion`.
- Dejar únicamente el código `r.referencia`, alineado a la izquierda, con tipografía Montserrat bold (no monospace).
- El hook `useReferenceSearch` se mantiene tal cual — sigue trayendo descripción por si la necesitamos en la fila después de añadir.

## 2. Tipografía Montserrat bold para el código de referencia

Hoy el código se ve "diferente" porque usa `font-mono` (fuente monoespaciada del sistema). Cambios:

- **En el dropdown de sugerencias**: reemplazar `font-mono text-xs text-muted-foreground` por `font-sans font-bold text-sm text-foreground`. Montserrat ya es la fuente sans del proyecto (ver `--font-sans` en `styles.css` línea 68).
- **En la celda Ref de la tabla de items**: reemplazar `font-mono text-xs` por `font-bold text-sm`.

Resultado: el código de referencia se ve consistente con el resto de la UI, en Montserrat bold.

## 3. Campo de descuento (%) por ítem

### Cambio de BD (migración nueva)

Añadir dos columnas a `negotiation_items`:
- `descuento_pct` numeric NOT NULL DEFAULT 0 (porcentaje 0–100)
- `precio_venta` numeric NOT NULL DEFAULT 0 (= `precio_unitario * (1 - descuento_pct/100)`, persistido para auditoría histórica y reportes)

`subtotal` pasa a calcularse como `cantidad * precio_venta` (no `precio_unitario`). El total de la negociación sigue siendo la suma de subtotales — sin cambios estructurales en `negotiations`.

### Cambios en el editor

- Añadir nueva columna **Desc. %** entre "Precio unit." y "Subtotal":
  - Input numérico, min 0, max 100, default 0.
  - Validación: si está fuera de [0, 100] se marca en rojo y bloquea guardar.
- Añadir columna calculada (read-only) **Precio venta** que muestra `precio_unitario * (1 - desc/100)`.
- **Subtotal** pasa a calcularse como `cantidad * precio_venta` (en lugar de `cantidad * precio_unitario`).
- El total del footer se recalcula automáticamente con la nueva fórmula.

### Layout de la tabla resultante

```text
Ref | Descripción | Cantidad | Precio unit. | Desc % | Precio venta | Subtotal | ✕
```

Para que quepa cómodamente en el Sheet de 3xl, ajusto anchos:
- Ref: w-[14%], Cantidad/Desc: w-[80px], Precio unit./Precio venta/Subtotal: w-[110px].
- En viewport actual (1277px) cabe sin scroll horizontal; si se aprieta, las columnas numéricas comparten espacio bien.

### Persistencia

- Al guardar (crear y editar): cada `itemRow` incluye `descuento_pct` y `precio_venta` calculado, y el `subtotal` ya viene de `cantidad * precio_venta`.
- Al cargar items existentes: leer también `descuento_pct` y rellenar el input. Items antiguos (pre-migración) tendrán `descuento_pct = 0` por DEFAULT, así que el comportamiento histórico se preserva exactamente.

### Tipo `EditorItem`

Añadir campo `descuento_pct: string` (string para input controlado, igual que cantidad y precio).

## 4. Archivos afectados

**Migración nueva** (BD)
- `supabase/migrations/<timestamp>_negotiation_items_discount.sql`:
  - `ALTER TABLE negotiation_items ADD COLUMN descuento_pct numeric NOT NULL DEFAULT 0;`
  - `ALTER TABLE negotiation_items ADD COLUMN precio_venta numeric NOT NULL DEFAULT 0;`
  - `UPDATE negotiation_items SET precio_venta = precio_unitario WHERE precio_venta = 0;` (backfill para items existentes)

**Modificar**
- `src/features/negociaciones/NegotiationEditor.tsx`:
  - Quitar descripción del dropdown de búsqueda; aplicar Montserrat bold al código.
  - Aplicar Montserrat bold a la celda Ref de la tabla.
  - Añadir columna Desc. % y Precio venta; recalcular subtotal y total con descuento.
  - Persistir `descuento_pct` y `precio_venta` en insert/update.
  - Cargar `descuento_pct` al editar.

**Sin cambios**
- `NegociacionesPage.tsx`: el total a nivel de negociación sigue siendo la suma de subtotales — no necesita tocar nada (lo recalcula el editor antes de guardar).
- `useReferenceSearch.ts`: se mantiene; aunque la descripción ya no se muestre en el dropdown, sigue siendo útil para guardar como snapshot al añadir el ítem.

## 5. Resultado esperado

- Dropdown de búsqueda muestra solo el código de referencia, en Montserrat bold, fácil de leer.
- En la tabla de items la columna Ref usa la misma tipografía consistente.
- Cada ítem tiene un nuevo campo "Desc %" editable. El precio de venta y el subtotal se actualizan en vivo a medida que el usuario escribe descuento.
- El descuento queda guardado en BD junto con el precio de venta efectivo, listo para futuras vistas de rentabilidad.
- Items existentes funcionan sin cambios visibles (descuento = 0%).

