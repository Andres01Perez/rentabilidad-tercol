# Mejoras vista de Negociaciones

Cuatro ajustes en `src/features/negociaciones/NegotiationCalculator.tsx` para mejorar el PDF y el flujo visual.

## 1. PDF en tamaño Carta con buenos márgenes

Reemplazar la configuración actual del documento:

```text
ANTES: jsPDF landscape · A4 · márgenes 40pt
AHORA: jsPDF portrait  · letter · márgenes 54pt (~0.75")
```

- `format: "letter"`, `orientation: "portrait"`.
- `margin: { top: 54, right: 54, bottom: 54, left: 54 }` en `autoTable`.
- Header (título + meta) ubicado dentro del margen superior.
- Pie de página ("Página X de Y") respetando margen inferior.

## 2. PDF: columnas reducidas + card de totales

### Columnas finales de la tabla (6)

| Columna | Origen |
|---|---|
| Referencia | `it.referencia` |
| Precio | `precio_unitario × (1 − descuento_pct/100)` (precio final ya con descuento) |
| CTU | `metricsByRef.get(ref).ctuProm` |
| Margen U $ | `metricsByRef.get(ref).margenUnit` |
| Margen % | `metricsByRef.get(ref).margenPct` |
| Subtotal | `metricsByRef.get(ref).subtotal` |

Se eliminan del PDF: Descripción, Cantidad, Descuento %, PUV bruto.

### Card de totales (debajo de la tabla)

Recuadro con borde redondeado dibujado con `doc.roundedRect` + texto, conteniendo:

```text
┌─ Resumen ───────────────────────────────────┐
│ Venta neta:        $ X.XXX.XXX              │
│ Costo total:       $ X.XXX.XXX              │
│ Margen bruto $:    $ X.XXX.XXX              │
│ Margen bruto %:    XX.X %    (Meta 36 %)    │
│ ───────────────────────────────────────     │
│ Nota: faltan X.X % para llegar a la meta    │
│       del 36 %.   (o "Meta cumplida ✓")     │
└─────────────────────────────────────────────┘
```

- Si `totals.margenBrutoPct >= minMarginPct` → nota "Meta del 36 % cumplida".
- Si está por debajo → "Faltan {gapPct} % para llegar a la meta del 36 %".
- Si la card no entra en la página actual, `doc.addPage()` antes de dibujarla.

## 3. Margen del buscador "Añadir referencia"

Actualmente la sección sticky superior (`pb-2`) y el contenedor padre `space-y-5` dejan el buscador pegado a la card de KPIs y separado de la tabla. Ajuste:

- Cambiar `space-y-5` del `<section>` por espaciado explícito por bloque, o
- Añadir `mt-4` al contenedor del buscador y `mb-1` a su parte inferior, manteniendo cercanía visual con la tabla.
- Resultado: ~16 px sobre el buscador, ~4 px bajo el buscador (acercándolo a la tabla).

## 4. Tabla sin scroll interno

Quitar el scroll interno de la tabla de items para usar el scroll de la página:

- En el wrapper de la tabla (línea 791), eliminar `max-h-[55vh] overflow-auto`.
- Mantener `TableHeader` con `sticky top-...`. Como el header de KPIs ya es `sticky top-14`, el header de la tabla quedará con `sticky top-[<altura aproximada del sticky superior>]` para que no se solape, o simplemente se quita el `sticky` del thead (queda en flujo normal y el scroll de la página muestra todas las filas).
- Decisión simple: **quitar el `sticky` del `<TableHeader>`** para evitar cálculo de altura dinámica del header superior. Toda la tabla fluye con la página.

## Archivos modificados

- `src/features/negociaciones/NegotiationCalculator.tsx` — handler `handleExportPdf` reescrito; clases del buscador y wrapper de tabla ajustadas.

Sin cambios en queries, hooks ni lógica de cálculo.
