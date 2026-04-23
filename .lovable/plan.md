

# Plan: import robusto de listas de precios con mapeo manual de columnas

## Problema actual

`ListasPreciosPage` usa `parseExcel(file, COLUMN_MAP, ...)` con aliases fijos:
- `referencia`: `["REFERENCIA", "REF", "Referencia"]`
- `descripcion`: `["DESCRIPCION", "DESCRIPCIÓN", ...]`
- `unidad_empaque`: `["UNIDAD DE EMPAQUE", "UND", ...]`
- `precio`: `["LISTA DE PRECIOS", "PRECIO", ...]`

Si los headers del Excel del usuario no coinciden exactamente con esos aliases, falla con "Faltan columnas requeridas". Además:
- Asume que la **primera hoja** y la **primera fila** contienen los headers.
- Los Excels reales (como `LISTA_DE_PRECIOS_Oficial_2025.xlsx`) tienen **múltiples hojas** (notas, contactos, datos) y a veces **filas previas en blanco o con títulos** antes del header real.

## Solución: wizard de importación en 3 pasos

Reemplazar el flujo "drop → parsea automático → preview" por un wizard guiado dentro del mismo `Dialog`:

### Paso 1 — Archivo y hoja
- Dropzone (existente).
- Detectar todas las hojas del workbook con `XLSX.read`.
- `Select` para elegir hoja (default: la primera con datos tabulares).

### Paso 2 — Fila de encabezados + mapeo de columnas
- Mostrar las **primeras 8 filas** de la hoja en una tabla compacta, cada fila con un radio para marcar **"esta es la fila de encabezados"**.
  - Auto-sugerencia: la primera fila que contenga texto en ≥3 celdas no numéricas.
- Una vez elegida, mostrar un panel de **mapeo manual**:
  - `Referencia *` → Select con todas las columnas detectadas
  - `Descripción` (opcional) → Select + opción "(no usar)"
  - `Unidad de empaque` (opcional) → Select + opción "(no usar)"
  - `Precio *` → Select
- Auto-rellenar usando los aliases actuales como sugerencia inicial; el usuario puede sobrescribir.
- Validación: `referencia` y `precio` son obligatorios; los demás opcionales.

### Paso 3 — Vista previa y limpieza
- Tabla con primeras 10 filas mapeadas.
- Resumen: "X filas válidas · Y descartadas (sin referencia o sin precio)".
- Reglas de limpieza automáticas (ya aplicadas en backend de parseo):
  - Trim de strings.
  - Filas con todas las celdas vacías → descartadas.
  - Filas sin `referencia` o sin `precio` numérico válido → descartadas.
  - Precios con símbolos (`$`, `,`, `.`) → normalizados a número (la lógica ya existe en `parseExcel`).
- Toggle opcional: **"Descartar filas con precio = 0"** (default ON).
- Botón final: **Crear lista** / **Reemplazar lista**.

## Cambios técnicos

### `src/lib/excel.ts` — extender API
Añadir nueva función `parseExcelWithMapping`:
```ts
parseExcelSheets(file): Promise<{ sheetNames: string[]; previewBySheet: Record<string, unknown[][]> }>
parseExcelWithMapping(file, {
  sheetName, headerRowIndex,
  mapping: Record<TKey, string | null>,  // header label → key, null = ignorar
  numericKeys, requiredKeys
}): Promise<ParsedExcelResult<TKey>>
```
- Lee sheet como matriz cruda (`sheet_to_json` con `header: 1`).
- Toma `headerRowIndex` como fila de encabezados.
- Mapea cada columna según el `mapping` provisto por el usuario.
- Mantiene la lógica actual de coerción numérica y warnings.

Mantener `parseExcel` original para no romper `analisis-ventas`, `costos-productos` y `costos-operacionales`.

### `src/features/listas-precios/ListasPreciosPage.tsx`
- Extraer el wizard a un nuevo componente compartido `ImportWizardDialog` para que `CreateListDialog` y `ReplaceListDialog` lo reutilicen.
- Reemplazar el `useEffect` actual de auto-parse por el flujo de 3 pasos con state machine simple (`step: "file" | "map" | "preview"`).
- Conservar los aliases actuales como **sugerencias automáticas** (no como única vía).

### `src/components/excel/ColumnMapper.tsx` (nuevo)
Componente reusable para el paso 2:
- Props: `headers: string[]`, `sampleRows: unknown[][]`, `fields: { key, label, required, suggestedAliases }[]`, `value`, `onChange`.
- Render: lista de filas `{label} → <Select>`, y debajo una tabla con las primeras 5 filas resaltando las columnas mapeadas.

### `src/components/excel/SheetAndHeaderPicker.tsx` (nuevo)
Componente para el paso 1:
- Props: `workbook`, `value: { sheet, headerRow }`, `onChange`.
- Render: select de hojas + tabla preview con radios para seleccionar fila de header.

## UX details

- Botones de navegación: **Atrás / Siguiente** entre pasos; **Crear / Reemplazar** solo activo en el paso 3.
- Si el auto-detect encuentra todos los campos requeridos, mostrar un banner "Detectamos automáticamente las columnas. ¿Confirmas o prefieres mapearlas manualmente?" con dos botones (Continuar / Mapear manual).
- Si el archivo tiene una sola hoja con datos válidos y headers en la fila 1, el wizard puede saltar directo al paso 3 (modo rápido).

## Archivos a tocar

1. `src/lib/excel.ts` — añadir `parseExcelSheets` y `parseExcelWithMapping` (sin romper API existente).
2. `src/components/excel/ColumnMapper.tsx` — nuevo.
3. `src/components/excel/SheetAndHeaderPicker.tsx` — nuevo.
4. `src/components/excel/ImportWizardDialog.tsx` — nuevo (orquesta los 3 pasos).
5. `src/features/listas-precios/ListasPreciosPage.tsx` — reemplazar `CreateListDialog` y `ReplaceListDialog` por uso del wizard.

## Resultado esperado

- Cualquier Excel con columnas equivalentes a referencia/descripción/unidad/precio se puede importar, sin importar:
  - Nombres exactos de las columnas.
  - Hojas adicionales con notas/contactos al inicio del workbook.
  - Filas previas con títulos o blancos antes del header.
- El usuario tiene control total: ve el preview, elige hoja, elige fila de header, mapea cada campo a la columna correcta.
- Filas vacías o inválidas se descartan automáticamente con feedback claro.
- Compatible con los archivos `LISTA_DE_PRECIOS_Oficial_2025.xlsx` y `LP_prueba_rentabilidad.xlsx` que adjuntaste.

