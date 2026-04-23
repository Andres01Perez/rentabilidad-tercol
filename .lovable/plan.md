

# Plan: importar costos con wizard (mes + hoja + fila + mapeo)

Reutilizar el `ImportWizardDialog` ya existente (creado para `/listas-precios`) en `/costos-productos`. El componente ya soporta los 3 pasos (archivo → hoja+header+mapeo → preview) y acepta cualquier conjunto de campos vía props. Solo hay que adaptarlo a costos.

## Cambios

### `src/features/costos-productos/CostosProductosPage.tsx`

1. **Eliminar el `UploadDialog` local** (todo el componente al final del archivo) y el `useEffect` con `parseExcel` automático.
2. **Reemplazarlo por `<ImportWizardDialog>`** con esta configuración de campos:
   - `referencia` *(obligatorio)* — alias: `["REFERENCIA","REF","Referencia","CODIGO","Código"]`
   - `ctu` *(obligatorio)* — alias: `["CTU","CT U","COSTO TOTAL UNITARIO","Costo total unitario"]`
   - `grupo` (opcional) — alias: `["GRUPO","Grupo","FAMILIA","CATEGORIA"]`
   - `descripcion` (opcional) — alias: `["DESCRIPCION","DESCRIPCIÓN","Descripción","NOMBRE","PRODUCTO"]`
   - `cant` (opcional, numérico)
   - `cumat`, `cumo`, `cunago` (opcional, numéricos)
   - `ctmat`, `ctmo`, `ctsit` (opcional, numéricos)
   - `pct_part`, `cifu`, `mou`, `ct`, `puv`, `preciotot`, `pct_cto` (opcional, numéricos)
3. **Selector de mes en `extraStep1`**: pasar el `MonthSelect` como contenido extra del paso 1, controlado por estado del padre (`uploadMonth`). `step1Valid={true}` (siempre hay mes por defecto).
4. **`onConfirm`**: 
   - Verifica si ya existen costos para ese mes (query `count`).
   - Si existen, abre `AlertDialog` de confirmación; al aceptar, borra y reinserta.
   - Si no, inserta directo con `chunkedInsert`.
   - Cada fila se mapea a `product_costs` con `period_month`, `referencia`, `ctu`, `created_by_id/name` y los opcionales que vengan.
   - Devuelve `true` para cerrar el wizard al terminar, o `false` si el usuario cancela el AlertDialog.
5. **Numéricos**: pasar `numericKeys` con todas las columnas numéricas (`cant`, `cumat`, `cumo`, `cunago`, `ctmat`, `ctmo`, `ctsit`, `pct_part`, `cifu`, `mou`, `ctu`, `ct`, `puv`, `preciotot`, `pct_cto`).
6. **Sin `zeroDropKey`**: en costos un CTU = 0 puede ser válido (producto en armado), no lo descartamos por defecto.

### `src/lib/excel.ts`
No requiere cambios. `parseExcelWithMapping` ya soporta múltiples `requiredKeys` (le pasaremos `["referencia","ctu"]`).

## UX resultante

- Botón **"Subir Excel del mes"** abre el wizard.
- **Paso 1**: selector de mes + dropzone.
- **Paso 2**: elegir hoja → elegir fila de encabezados → mapear cada campo. Solo `Referencia` y `CTU` marcados con `*`. Los 16 opcionales aparecen pero se pueden dejar en "(no usar)".
- **Paso 3**: preview con conteo de filas válidas/descartadas, warnings y tabla de muestra. Botón final **"Subir costos"**. Si el mes ya tiene datos, se muestra `AlertDialog` "Sobrescribir mes".

## Resultado

- Cualquier Excel de costos (incluso con hojas adicionales o filas previas vacías/títulos) se puede importar sin tocar código.
- Solo `referencia` + `CTU` son obligatorios → suficiente para cálculo de rentabilidad.
- Los demás campos opcionales se respetan si están presentes; si faltan, quedan en `null` en BD.
- Mismo flujo y look consistente con el de listas de precios.

## Archivos a tocar

1. `src/features/costos-productos/CostosProductosPage.tsx` — reemplazar `UploadDialog` por `ImportWizardDialog` con los 18 campos y el `MonthSelect` en `extraStep1`.

