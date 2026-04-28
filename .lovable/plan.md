## Objetivo

Compactar la vista del calculador de negociaciones eliminando el bloque superior de formulario y reubicando los campos esenciales dentro del contenedor de acciones inferior (el sticky donde hoy aparecen "Eliminar" y "Guardar cambios"). Esto deja el viewport más limpio: KPIs sticky → buscador → tabla → action bar todo-en-uno.

## Cambios en `src/features/negociaciones/NegotiationCalculator.tsx`

### 1. Eliminar el bloque "Header form" (líneas ~400-466)
Se elimina por completo el `<div className="glass …">` que contiene:
- Input de Nombre
- Selector de Lista de precios sugerida
- MultiMonthPicker de Meses de costo
- Textarea de Notas / observaciones

### 2. Eliminar el estado y lógica de notas
- Quitar el `useState` de `notes` y su `setNotes`.
- Quitar `notes` del payload de guardado (insert/update de la negociación). El campo en BD queda en `null` / sin tocar.
- Quitar el import de `Textarea` si ya no se usa en el archivo.

### 3. Rediseñar el action bar inferior (sticky bottom, línea ~761)
Convertir ese contenedor en una barra de control completa con dos filas:

**Fila superior (campos del formulario):**
- Input compacto de Nombre (con borde destructivo si no es válido).
- Selector de Lista de precios sugerida (compacto).
- MultiMonthPicker de meses de costo (compacto).

Layout responsive: grid de 3 columnas en desktop, apilado en móvil.

**Fila inferior (acciones existentes, sin cambios funcionales):**
- Badge de cantidad de items + indicador "Recalculando…".
- Botones Cancelar / Eliminar / Guardar.

El contenedor mantiene `sticky bottom-4`, `backdrop-blur`, sombra y borde para que siga flotando sobre la tabla al hacer scroll.

### 4. Ajustes visuales y de espaciado
- Mantener el orden vertical: KPIs sticky → Buscador → Tabla → Action bar sticky.
- Asegurar que el action bar tenga padding suficiente (`p-4`) y separación interna (`gap-3`) para que los inputs respiren.
- Conservar `z-20` para que quede sobre la tabla, y opacidad/blur para legibilidad.
- Validar que en viewports angostos (< md) los campos se apilen sin romper la barra.

### 5. Validaciones y autoFocus
- El `autoFocus` del input de Nombre se mantiene cuando se está creando una negociación nueva.
- La regla `validation.nameOk` sigue aplicando: borde rojo si está vacío, botón Guardar deshabilitado.

## Resultado esperado

```text
┌─────────────────────────────────────────┐
│ KPIs (sticky top)                       │
├─────────────────────────────────────────┤
│ Añadir referencia (buscador)            │
├─────────────────────────────────────────┤
│ Tabla de items                          │
│  …                                       │
├─────────────────────────────────────────┤
│ [Nombre] [Lista precios] [Meses costo]  │ ← sticky bottom
│ 1 item · [Cancelar] [Eliminar] [Guardar]│
└─────────────────────────────────────────┘
```

- Vista más limpia, menos scroll vertical inicial.
- Toda la configuración de la negociación queda accesible sin perder contexto de la tabla.
- Se elimina el campo de Notas/observaciones según lo solicitado.

## Fuera de alcance

- No se toca el esquema de BD ni los queries (solo se omite enviar `notes`).
- No se modifica la lógica de cálculo, búsqueda, importación ni KPIs.
- No se cambia el comportamiento del sticky de KPIs ni del buscador.
