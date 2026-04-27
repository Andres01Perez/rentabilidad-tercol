## Diagnóstico

El nuevo `Graficos-2.xlsx` es limpio: la fila 0 ya contiene los encabezados reales `Año, Mes, Dia, Vendedor, Dependencia, Tercero, ProductoC, Grupo, Valor, Cantidad`. El parser actual (`parseExcel` en `src/lib/excel.ts`) los lee bien.

El botón **Importar y reemplazar** queda deshabilitado porque:

1. `UploadVentasDialog` no contempla la nueva columna `Grupo`.
2. El parser exige que todas las columnas requeridas se encuentren — al no encontrarse problema en sí pero, además, el flujo lanza el toast de error si algo no encaja con el mapping.

En realidad, con un Excel limpio el parser técnicamente no exige `Grupo` (no está en `requiredKeys`), pero la columna se está ignorando silenciosamente y no se persiste. El usuario quiere que se **lea y se guarde** para uso futuro.

## Cambios a aplicar

### 1. Migración de base de datos

Agregar la columna a la tabla `sales`:

```sql
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS grupo text;
```

Sin defaults, sin constraints — solo persistencia. Los registros existentes quedan con `grupo = NULL`.

### 2. `src/features/analisis-ventas/UploadVentasDialog.tsx`

Pequeñas adiciones, sin tocar el flujo de drag-and-drop ni la lógica de `parseExcel`:

- **`COLUMN_MAP`**: agregar `grupo: ["grupo", "group"]`.
- **`ParsedRow`**: agregar `grupo: string | null`.
- **Loop de limpieza**: incluir `grupo: (r.grupo as string | null) ?? null`.
- **`payload` en `performUpload`**: incluir `grupo: r.grupo`.
- **No** se agrega a `requiredKeys` (es opcional — si en algún Excel no viene, no debe romper la importación).
- **Preview opcional**: agregar columna "Grupo" en la mini-tabla de previsualización entre Ref y Cant para que el usuario vea que se está leyendo bien.

### 3. Lo que NO se toca

- `src/lib/excel.ts` — el parser actual sirve tal cual.
- RPCs `get_sales_dashboard` / `get_sales_detail` — el usuario dijo que `grupo` se usará "más adelante". Lo dejamos persistido y listo; cuando se quiera filtrar/agrupar por él, se actualizan los RPC en otra iteración.
- `src/integrations/supabase/types.ts` — se regenera automático tras la migración.

## Resultado esperado

- Subes `Graficos-2.xlsx` → el parser detecta las 10 columnas, el botón **Importar y reemplazar** se habilita inmediatamente.
- Al confirmar, las 12.100 filas se insertan con su valor de `grupo` poblado en la nueva columna de `sales`.
- Si algún día subes un Excel sin la columna `Grupo`, la importación sigue funcionando y `grupo` se guarda como `NULL`.
