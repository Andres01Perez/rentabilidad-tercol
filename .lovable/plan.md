# Unificar header sticky y exportar a PDF

Tres cambios en `src/features/negociaciones/NegotiationCalculator.tsx` para una vista más limpia y eficiente.

## 1. Fusionar barra inferior con KPIs en un único contenedor sticky superior

Mover los campos (Nombre, Lista de precios, Meses de costo) y los botones de acción (Cancelar / Eliminar / Guardar + contador de items) actualmente en `sticky bottom-4` (líneas 688–788) hacia el contenedor `sticky top-14` de KPIs (líneas 396–475), para que **todo viaje junto** al hacer scroll.

Estructura final del sticky superior:

```text
┌─ sticky top-14 (un solo glass card) ───────────────┐
│  [Nombre] [Lista precios] [Meses costo]            │  ← fila form
│  ─────────────────────────────────────────────     │
│  [KPI Ventas] [KPI Costo] [KPI $] [KPI %]          │  ← fila KPIs
│  [Banner meta margen ✓ / ⚠]                        │  ← estado
│  ─────────────────────────────────────────────     │
│  [N items · Recalculando…]   [Cancelar][Elim][Exportar PDF][Guardar] │
└────────────────────────────────────────────────────┘
```

- Eliminar el `<div className="sticky bottom-4 …">` completo al final.
- El nuevo contenedor mantiene el coloreado dinámico según `belowMin / okMin`.
- Conservar `z-20` y `backdrop-blur-xl` para flotar sobre la tabla.

## 2. Botón "Exportar PDF"

Añadir botón en la fila de acciones (al lado de Guardar), visible siempre que `items.length > 0`.

Exporta:
- Encabezado: nombre de la negociación, lista de precios, meses de costo, fecha.
- Tabla de productos con columnas actuales (referencia, descripción, cantidad, precio, descuento, subtotal, costo, margen).
- Pie con totales (ventas netas, costo total, margen $, margen %).

## 3. Limpieza de espacio

Al desaparecer la barra inferior, la tabla de items recupera todo el espacio vertical bajo el sticky.

---

## Detalles técnicos

**Librería PDF**: usar `jspdf` + `jspdf-autotable` (ligeras, funcionan en navegador, ya común en este tipo de exports). Instalar con `bun add jspdf jspdf-autotable`.

**Nuevo handler** `handleExportPdf()` en el componente:
- Construye filas desde `live.items` (que ya tiene cálculos resueltos: subtotal, costo unitario, margen).
- Usa `autoTable` con estilos sobrios (header gris, zebra rows).
- Nombre de archivo: `negociacion-${slugify(name)}-${YYYYMMDD}.pdf`.
- Si no hay items, deshabilitar el botón.

**Reordenamiento JSX** (sin tocar lógica de negocio):
- Mover bloque `grid md:grid-cols-3` (form) + bloque acciones desde el sticky inferior al sticky superior, encima de la fila de KPIs.
- Borrar el contenedor `sticky bottom-4` y sus paréntesis correspondientes.
- Verificar balance de tags JSX tras la edición.

**Sin cambios** en: queries, hooks, lógica de guardado, validaciones, tabla de items, search bar.

## Archivos modificados
- `src/features/negociaciones/NegotiationCalculator.tsx` (reordenamiento JSX + handler export)
- `package.json` (deps `jspdf`, `jspdf-autotable`)
