

# Plan: filtrar filas "TOTAL" + respuesta sobre la maestra de referencias

## Sobre tu sugerencia de la maestra de referencias

**Mi recomendación: no la construyamos todavía.** Te explico por qué y qué hago en su lugar.

### Por qué NO crear la maestra ahora

1. **Resuelve un problema que no tienes.** El problema real son filas basura ("TOTAL", "SUBTOTAL", "TOTAL GENERAL") que se cuelan en el import. Eso se arregla con un filtro al parsear, no con una tabla nueva.
2. **Te genera fricción operativa.** Si la maestra es obligatoria, cada vez que aparezca una referencia nueva en ventas/costos/precios tendrías que ir primero a registrarla manualmente. Atrasa todo.
3. **Las referencias se van a "auto-construir" solas.** Si las 3 fuentes (ventas, costos, listas) usan los mismos códigos del ERP, ya están sincronizadas por convención. La maestra solo añade burocracia.
4. **Lo que tú quieres (relacionar referencias entre tablas) ya funciona** sin maestra: un `JOIN` por `referencia` entre `sales`, `product_costs` y `price_list_items` ya te da rentabilidad por producto.

### Cuándo SÍ tendría sentido la maestra

Más adelante, como **vista de reconciliación** (no como gate de importación):
- "Referencias en ventas que no tienen costo cargado este mes"
- "Referencias en costos que nunca se han vendido"
- "Productos descontinuados"

Eso lo podemos hacer en su momento como una **vista derivada** (`SELECT DISTINCT referencia FROM ...`) sin tocar el flujo de import.

**Decisión:** seguimos sin maestra. Atacamos el problema real ahora.

## Qué voy a implementar

### Filtrar filas "TOTAL" en el parser genérico

Añadir lógica en `parseExcelWithMapping` (`src/lib/excel.ts`) que descarte filas cuando el valor de la **columna mapeada como `referencia`** (o cualquier campo de texto requerido) cumple alguno de estos patrones:

- Es exactamente o empieza con: `total`, `subtotal`, `total general`, `gran total`, `suma`, `totales` (case-insensitive, sin acentos).
- Contiene solo dígitos cero, guiones o espacios.
- Tiene longitud > 50 caracteres (es una frase, no un código).

Implementación:
- Nueva opción en `MappingOptions`: `textFilterKey?: TKey` (la clave que actúa como "código" — para costos será `referencia`, para listas también).
- Si la celda en esa columna matchea un patrón "total", se descarta y se cuenta en `skippedRows` con warning agregado: *"X filas descartadas por ser totales o subtotales"*.

### Aplicar el filtro en costos y en listas de precios

- `src/features/costos-productos/CostosProductosPage.tsx`: pasar `textFilterKey: "referencia"` al `<ImportWizardDialog>`.
- `src/features/listas-precios/ListasPreciosPage.tsx`: lo mismo.

### Mostrar el descarte en la preview del wizard

Ya existe el bloque de warnings en el paso 3. El nuevo warning aparecerá ahí automáticamente, así el usuario ve *"3 filas descartadas por ser totales"* antes de confirmar.

## Archivos a tocar

1. `src/lib/excel.ts` — añadir helper `isTotalLikeValue(v)` y aplicarlo en `parseExcelWithMapping` cuando se define `textFilterKey`.
2. `src/features/costos-productos/CostosProductosPage.tsx` — pasar `textFilterKey="referencia"` al wizard.
3. `src/features/listas-precios/ListasPreciosPage.tsx` — pasar `textFilterKey="referencia"` al wizard.
4. `src/components/excel/ImportWizardDialog.tsx` — añadir prop `textFilterKey` y pasarla al parser.

## Resultado esperado

- Filas con "TOTAL", "SUBTOTAL", "Total general", etc. se descartan automáticamente en cualquier import (costos y listas).
- El usuario ve cuántas se descartaron antes de confirmar.
- Las referencias guardadas en BD coinciden limpias entre `sales`, `product_costs` y `price_list_items`, así los joins de rentabilidad funcionan sin basura.
- **Sin** crear tabla maestra ni complicar el flujo de import.

