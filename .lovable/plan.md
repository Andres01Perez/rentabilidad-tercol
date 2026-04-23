

# Plan: nueva sección "Negociaciones" (rename de Negocios fijos) con cotizador

## Resumen

Convertir la página actual de placeholder en un **cotizador funcional** donde el usuario crea negociaciones (tipo cotización), agrega referencias del catálogo (unión de costos + listas de precios), define cantidad y precio, y guarda todo en BD. CRUD completo: crear, leer, editar, borrar.

## 1. Renombre global: `negocios-fijos` → `negociaciones`

Cambios en estos archivos:

- **Ruta**: renombrar `src/routes/_app/negocios-fijos.tsx` → `src/routes/_app/negociaciones.tsx`. El `createFileRoute` pasa a `"/_app/negociaciones"`.
- **Sidebar** (`src/components/layout/AppSidebar.tsx`): item `Negocios fijos` → `Negociaciones`, `to: "/negociaciones"`.
- **Layout** (`src/routes/_app.tsx`): `ROUTE_LABELS["/negociaciones"] = "Negociaciones"` (eliminar la entrada vieja).
- **`routeTree.gen.ts`**: regenerado automáticamente por el plugin de Vite, no se toca a mano.

No hay nombre de tabla en BD que renombrar (la tabla aún no existe).

## 2. Cambios de base de datos (migración nueva)

Dos tablas nuevas:

### `negotiations`
- `id` uuid PK
- `name` text NOT NULL (ej. "Negociación FM")
- `notes` text NULL (observaciones)
- `total` numeric NOT NULL DEFAULT 0 (suma de cantidad × precio, calculado en cliente al guardar)
- `items_count` int NOT NULL DEFAULT 0
- `created_by_id` uuid, `created_by_name` text NOT NULL
- `updated_by_id` uuid, `updated_by_name` text
- `created_at`, `updated_at` timestamptz con trigger `set_updated_at` existente

### `negotiation_items`
- `id` uuid PK
- `negotiation_id` uuid NOT NULL → FK con `ON DELETE CASCADE`
- `referencia` text NOT NULL
- `descripcion` text NULL (snapshot al momento de añadir)
- `cantidad` numeric NOT NULL CHECK > 0
- `precio_unitario` numeric NOT NULL CHECK >= 0
- `subtotal` numeric NOT NULL (cantidad × precio, persistido)
- `source_price_list_id` uuid NULL (de qué lista vino el precio sugerido, si aplica)
- `created_at` timestamptz

RLS: mismo patrón que las demás tablas del proyecto (políticas open select/insert/update/delete para `anon, authenticated`). Trigger `set_updated_at` solo en `negotiations`.

## 3. Catálogo maestro de referencias (vista SQL)

Crear vista `master_references` que une referencias distintas de `product_costs` y `price_list_items`:

```sql
CREATE OR REPLACE VIEW master_references AS
SELECT referencia, MAX(descripcion) AS descripcion
FROM (
  SELECT referencia, descripcion FROM product_costs
  UNION ALL
  SELECT referencia, descripcion FROM price_list_items
) t
WHERE referencia IS NOT NULL AND TRIM(referencia) <> ''
GROUP BY referencia;
```

Así al hacer typeahead se consulta una sola fuente. Si en el futuro se crea tabla maestra dedicada, solo se reemplaza la vista.

## 4. UI de la página `/negociaciones`

### Vista principal (lista CRUD)

Tabla glass tipo `ListasPreciosPage`:
- Columnas: Nombre · # Items · Total · Creada por · Última actualización · Actualizada por · Acciones (Ver/Editar, Eliminar)
- Header con botón **"Nueva negociación"** (gradiente brand).
- AlertDialog de confirmación para eliminar (cascada borra items).

### Editor de negociación (Sheet o Dialog grande)

Se abre tanto al crear como al editar. Layout:

**Encabezado del formulario**
- Input "Nombre de la negociación" (requerido).
- Textarea "Notas / observaciones" (opcional).
- Selector "Lista de precios sugerida" (opcional, dropdown de `price_lists`). Cuando se cambia, las refs ya añadidas no se tocan; solo afecta el precio sugerido al añadir nuevas refs.

**Buscador de referencias (typeahead)**
- Input con debounce que consulta `master_references` por `referencia` o `descripcion` (ILIKE %q%, limit 20).
- Al seleccionar una sugerencia → se añade fila a la tabla de items con cantidad=1, precio prellenado desde la lista seleccionada (si existe match en `price_list_items` para esa lista + ref) o vacío.

**Tabla de items editables**
- Columnas: Ref (read-only), Descripción (read-only), **Cantidad** (input numérico, requerido > 0), **Precio unit.** (input numérico, requerido >= 0), Subtotal (calculado), Acción (botón eliminar fila).
- Footer con "Total: $X" en grande.

**Validación previa al guardar**
- Nombre no vacío.
- Al menos 1 item.
- Todos los items con cantidad > 0 y precio >= 0 (precio = 0 sí se permite, pero campo no puede estar vacío).
- Si falla validación, se marcan en rojo las celdas inválidas y toast de error. Botón Guardar deshabilitado mientras haya inválidos.

**Botones**: Cancelar · Guardar negociación.

### Persistencia
- **Crear**: insert en `negotiations` → obtener `id` → bulk insert en `negotiation_items` con `chunkedInsert`. Update final del total/items_count.
- **Editar**: update de `negotiations`, delete de items existentes, re-insert de items nuevos (más simple que diffear). Actualiza `updated_by_*`.
- **Eliminar**: delete en `negotiations` (cascade).

## 5. Archivos a tocar/crear

**Crear**
- `supabase/migrations/<timestamp>_negotiations.sql` (tablas + RLS + trigger + vista master_references).
- `src/routes/_app/negociaciones.tsx` (route file nuevo).
- `src/features/negociaciones/NegociacionesPage.tsx` (lista CRUD).
- `src/features/negociaciones/NegotiationEditor.tsx` (Sheet con form + buscador + tabla items).
- `src/features/negociaciones/useReferenceSearch.ts` (hook typeahead contra `master_references`).

**Modificar**
- `src/components/layout/AppSidebar.tsx` (rename label + ruta).
- `src/routes/_app.tsx` (actualizar `ROUTE_LABELS`).

**Eliminar**
- `src/routes/_app/negocios-fijos.tsx`.

## 6. Resultado esperado

- Sidebar muestra "Negociaciones" en lugar de "Negocios fijos", apunta a `/negociaciones`.
- El usuario puede: crear una negociación con nombre, opcionalmente seleccionar una lista de precios base, buscar referencias del catálogo (todas las que existan en costos o listas), añadirlas con cantidad y precio (precio sugerido si hay lista, editable siempre), ver subtotales y total, guardar.
- Cantidad y precio son obligatorios; sin ellos no se puede guardar.
- La negociación queda en BD con todos sus items, y se puede ver, editar, eliminar desde la tabla principal.
- Listo para futuras vistas de rentabilidad (cruce con `product_costs` por `referencia`).

