## Cambios en Negociaciones

Dos ajustes pequeños en `src/features/negociaciones/`.

### 1. Vista lista → calculadora (sin sidebar permanente)

Hoy la página muestra siempre el sidebar `NegotiationsList` (320px) + la calculadora a la derecha. Cambiamos a un flujo de dos vistas:

- **Vista "lista"** (por defecto): ocupa todo el ancho. Muestra:
  - Buscador y botón "Nueva negociación".
  - Tarjetas/filas con nombre, autor, items, total y fecha de actualización.
  - Botón "Editar" (o clic en toda la fila) por cada negociación.
- **Vista "calculadora"**: ocupa todo el ancho. Se abre al:
  - Hacer clic en una negociación de la lista, o
  - Pulsar "Nueva negociación".
  - Incluye un botón "← Volver a negociaciones" arriba que regresa a la lista.

Estado en `NegociacionesPage.tsx`: un único `mode: "list" | "edit"` además del `selectedId`/`isNew` actuales. Al guardar/eliminar, regresamos a la lista (en vez de quedarnos en la calculadora) e invalidamos las queries como ya se hace.

`NegotiationsList.tsx` se rediseña como vista principal a ancho completo (grid responsive de tarjetas en lugar de columna estrecha) y recibe un `onEdit(id)` además del actual `onSelect`.

### 2. Quitar Margen Neto de la calculadora

En `NegotiationCalculator.tsx` (líneas 513–526) se eliminan los dos KPIs:
- "Margen neto %"
- "Margen neto $"

El grid de KPIs queda con 4 tarjetas: Ventas netas, Costo total, Margen bruto $, Margen bruto %. Se ajusta `grid-cols-…` a `md:grid-cols-4` (sin `xl:grid-cols-6`).

No se toca `useNegotiationLive.ts` ni el RPC backend (los campos `margenNeto*` siguen existiendo pero no se renderizan), para no romper otras cosas y dejar la puerta abierta cuando se añada el selector operacional.

### Archivos a modificar

- `src/features/negociaciones/NegociacionesPage.tsx` — añadir `mode`, condicional list/edit, botón volver.
- `src/features/negociaciones/NegotiationsList.tsx` — rediseñar como vista a ancho completo con tarjetas y botón Editar.
- `src/features/negociaciones/NegotiationCalculator.tsx` — quitar 2 KPIs de margen neto y ajustar grid.
