## Mejorar layout de la barra de filtros sticky en Análisis de Ventas

Archivo a modificar: `src/features/analisis-ventas/AnalisisVentasPage.tsx` (líneas 645–732).

La funcionalidad (estado draft/applied, hooks, handlers) **no cambia**. Solo se ajusta el contenedor sticky y la disposición visual.

### Problemas detectados

1. El sticky usa `top-14` y queda completamente pegado al header sin respiración visual.
2. El grupo "Actualizar / Descartar / Cambios sin aplicar" comparte la misma fila que los selectores, pero éstos tienen una etiqueta encima (`Mes de ventas`, etc.), por lo que los botones quedan alineados arriba mientras los selects quedan abajo → desalineación visual.
3. Los `MultiSelectFilter` (Vendedor / Dependencia / Tercero) son botones sin etiqueta superior, y aparecen mezclados a la derecha sin un agrupamiento claro.

### Cambios propuestos

**1. Margen superior del sticky**
- Reemplazar `sticky top-14` por `sticky top-16` y agregar `mt-2` al contenedor para dejar un colchón visual entre el header y la barra de filtros.

**2. Reestructurar el contenedor en dos zonas**

Cambiar de un único `flex flex-wrap items-center gap-3` a una distribución en dos bloques con `justify-between`:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  [Mes ventas ▼] [Mes costos ▼] [Mes oper. ▼] [Desc. fin. ▼]            │
│  [Vendedor ▼] [Dependencia ▼] [Tercero ▼]    │  [⚠ Pendientes][Descartar][Actualizar]│
└─────────────────────────────────────────────────────────────────────────┘
```

Estructura:
- Contenedor exterior: `flex flex-wrap items-end justify-between gap-4` (clave: `items-end` alinea TODO al borde inferior, así los botones de acción quedan a la misma altura que los selects que tienen label encima).
- **Bloque izquierdo** (filtros): `flex flex-wrap items-end gap-3` que contiene los 4 selects con label + los 3 multi-select (los multi-select se envuelven en su propio `div` con `gap-2` para mantenerlos agrupados visualmente).
- **Bloque derecho** (acciones): `flex flex-wrap items-center gap-2` con el badge "Cambios sin aplicar", "Descartar" y "Actualizar". Como no llevan label encima, `items-end` del padre los pega al fondo y quedan alineados con la base de los selects.

**3. Consistencia visual de los multi-select**
- Para que los `MultiSelectFilter` (Vendedor / Dependencia / Tercero) no se vean "flotando" sin etiqueta junto a los selects con label, agregarles también una etiqueta superior con el mismo estilo (`text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`) — por ejemplo "Filtros adicionales" como header del grupo, o etiquetas individuales reutilizando el mismo `label` que ya reciben.

Opción elegida: una sola etiqueta de grupo "Filtros adicionales" sobre los tres botones, para evitar redundancia (cada botón ya muestra su nombre).

### Resultado

- Margen visible entre el header y la barra sticky.
- Filtros a la izquierda alineados por su borde inferior, todos a la misma altura.
- Botones de acción (Actualizar / Descartar / badge) anclados al fondo a la derecha, alineados con la base de los selects.
- Sin cambios en lógica, hooks ni en `handleApply` / `handleDiscard` / `hasPendingChanges`.
