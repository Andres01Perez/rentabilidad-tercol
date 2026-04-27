Diagnóstico confirmado:

- El archivo sí se está leyendo: la vista previa muestra 12.100 filas y la columna Grupo ya aparece con valores.
- La columna `grupo` ya existe en `public.sales` y el payload actual de `UploadVentasDialog.tsx` también la incluye.
- El bloqueo principal no es la base de datos ni el mapeo de Grupo: el botón está deshabilitado por esta condición en `src/features/analisis-ventas/UploadVentasDialog.tsx`:
  `disabled={!parsed || parsed.length === 0 || uploading || !user}`
- Eso volvió obligatoria la “firma” de usuario, aunque el mismo código ya soporta fallback a `Sistema`:
  `created_by_id: user?.id ?? null`
  `created_by_name: user?.name ?? "Sistema"`
- En otras palabras: la importación sí parsea el Excel, pero queda bloqueada artificialmente si no hay usuario seleccionado en el selector lateral.

Plan propuesto:

1. Quitar el bloqueo indebido del botón de importación
- Eliminar la dependencia de `!user` en el botón “Importar y reemplazar”.
- Mantener la auditoría opcional: si no hay usuario seleccionado, guardar como `Sistema`.
- Revisar que `requestUpload` y `performUpload` no tengan otra validación implícita que vuelva a frenar el flujo.

2. Alinear la UI con el comportamiento real
- Actualizar el texto del diálogo para incluir `Grupo` dentro de las columnas esperadas.
- Mostrar claramente si la importación se registrará con un usuario seleccionado o con `Sistema`, para que no parezca que falta un dato obligatorio.

3. Verificar el flujo completo de `grupo`
- Confirmar que `grupo` siga entrando desde el parser, pase al `ParsedRow`, llegue al payload y se inserte en Supabase.
- Verificar tipado y consistencia en `src/integrations/supabase/types.ts` y cualquier uso posterior en análisis de ventas.

4. Probarlo de extremo a extremo con tu archivo
- Cargar el Excel en la vista previa.
- Confirmar que el botón quede habilitado al terminar el parseo.
- Ejecutar la importación completa.
- Validar que los registros nuevos queden en `sales` con `grupo` poblado y que análisis-ventas refresque correctamente.

5. Hacer una revisión rápida de regresión en importaciones relacionadas
- Revisar los cambios recientes en las otras secciones tocadas para detectar si se repitió el mismo patrón de exigir `user` cuando el sistema ya permite fallback.

Detalles técnicos:

- Archivo principal: `src/features/analisis-ventas/UploadVentasDialog.tsx`
- Causa raíz: requisito artificial de usuario en UI, introducido después de los cambios de optimización/hidratación.
- Base de datos: `sales.grupo` ya está presente; no hace falta otra migración para este caso.
- Resultado esperado tras el arreglo:

```text
Excel válido -> parseo exitoso -> botón habilitado -> confirmación -> delete/insert -> grupo guardado -> análisis actualizado
```

Cuando apruebes, lo implemento y hago la prueba yo mismo en la vista previa con el flujo de importación.