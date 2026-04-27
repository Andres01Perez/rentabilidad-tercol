
# Importar items a una negociación

Sí, es totalmente posible y el archivo adjunto (`eliminr_2.xlsx`) ya viene con el formato correcto: tres columnas `Referencia`, `cantidad`, `precio unitario`. El plan reutiliza el parser de Excel ya existente (`src/lib/excel.ts`) e incorpora una plantilla descargable rígida para forzar el formato.

## Funcionalidad

En el `NegotiationCalculator`, al lado del buscador de referencias, añadir un botón **"Importar items"** que abre un diálogo con tres pestañas:

1. **Subir Excel/CSV** — dropzone que acepta `.xlsx` y `.csv`. Se parsea con headers fijos.
2. **Pegar texto** — textarea donde el usuario pega filas desde Excel/Sheets (TSV) o CSV. Detecta separador automáticamente (tab o coma o `;`).
3. **Descargar plantilla** — botón que genera y descarga `plantilla_negociacion.xlsx` con solo los encabezados: `Referencia | cantidad | precio unitario`.

## Reglas de validación (estrictas, plantilla obligatoria)

- Headers exactos esperados (case-insensitive, sin acentos): `referencia`, `cantidad`, `precio unitario` (alias: `precio_unitario`, `precio`).
- Si faltan headers requeridos → error claro indicando qué falta.
- `cantidad` y `precio unitario` se parsean como números. Filas con `cantidad <= 0` o `precio <= 0` se marcan como **descartables** pero se muestran en preview con checkbox para que el usuario decida si quiere incluirlas (en el archivo adjunto hay muchas con 0, hay que filtrarlas por defecto).
- Referencias duplicadas dentro del archivo → se consolidan (suma cantidades) o se avisa, según preview.
- Referencias que ya existen en la negociación actual → se omiten con aviso (mismo comportamiento que `addReference`).

## Preview antes de aplicar

Tras parsear, el diálogo muestra una tabla con:
- N° filas detectadas, válidas, descartadas (cant=0 o precio=0), duplicadas.
- Lista de las primeras ~20 filas con su estado (✓ válida / ⚠ descartada / ✗ duplicada).
- Toggle "Incluir filas con cantidad o precio en 0" (default OFF).
- Si hay `sourceListId` seleccionado en la negociación, opcionalmente reemplazar el precio del archivo por el precio de la lista (toggle, default OFF — usar lo que viene en el archivo).
- Botón **"Importar N items"** que añade las filas válidas al estado `items` del calculator. Los cálculos en vivo (margen, KPIs) se actualizarán automáticamente.

## Cambios técnicos

- **Nuevo archivo** `src/features/negociaciones/ImportItemsDialog.tsx`:
  - Componente diálogo con tabs (Upload / Paste / Template).
  - Usa `parseExcel` de `src/lib/excel.ts` con `columnMap = { referencia: ["referencia","ref"], cantidad: ["cantidad","cant","qty"], precio: ["precio unitario","precio_unitario","precio","precio unit"] }`, `requiredKeys: ["referencia","cantidad","precio"]`, `numericKeys: ["cantidad","precio"]`.
  - Para pegar texto: parser propio que detecta `\t`, `;` o `,`; primera línea = headers; usa la misma normalización.
  - Para descargar plantilla: usa el módulo `xlsx` (ya cargado dinámicamente en `excel.ts`) → exponer un helper `downloadTemplate()` o hacerlo inline con `XLSX.utils.aoa_to_sheet([["Referencia","cantidad","precio unitario"]])` + `XLSX.writeFile`.
  - Devuelve un array `{ referencia, cantidad, precio }[]` al componente padre vía callback `onImport`.

- **Edición** `src/features/negociaciones/NegotiationCalculator.tsx`:
  - Importar el nuevo diálogo.
  - Añadir botón "Importar items" junto al buscador (línea ~160 área de search).
  - Handler `handleImport(rows)` que:
    - Filtra duplicados contra `items` actuales.
    - Convierte cada fila a `EditorItem` con `uid: makeUid()`, `cantidad: String(qty)`, `precio_unitario: String(price)`, `descuento_pct: "0"`, `source_price_list_id: null` (o el de la lista si el toggle está activo).
    - Hace `setItems(prev => [...prev, ...nuevos])`.
    - Toast con resumen: "X items importados, Y duplicados omitidos, Z descartados".

## Resultado para el archivo adjunto

Con `eliminr_2.xlsx` (293 filas):
- Filas con cantidad=0 o precio=0: ~80 (descartadas por defecto).
- Filas válidas: ~213 que se importarían directo a la negociación.
- El usuario puede ajustar descuentos individualmente después en la tabla.

## Notas

- No se toca la base de datos: la importación solo llena el estado del editor; al hacer "Guardar" se persiste como cualquier item creado manualmente.
- La plantilla y el parser comparten exactamente los mismos headers para garantizar compatibilidad.
