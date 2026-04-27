
## Diagnóstico

Tras revisar el flujo de importación en todas las secciones, **la lógica de drag&drop, mapeo de columnas y parseo de Excel NO fue modificada**. Los archivos `Dropzone.tsx`, `ColumnMapper.tsx`, `SheetAndHeaderPicker.tsx`, `ImportWizardDialog.tsx`, `UploadVentasDialog.tsx` y `src/lib/excel.ts` están intactos respecto a la versión que funcionaba.

Lo que cambió es **cómo se refrescan los datos después de importar**. Y ahí hay un bug real, especialmente grave en análisis de ventas:

### Bug crítico — Análisis de ventas no refresca tras importar

En `src/features/analisis-ventas/useSalesAnalytics.ts`, el dashboard se migró a `useQuery` con esta queryKey:

```ts
queryKey: ["sales-analytics","dashboard", salesMonth, costPeriodMonth, opPeriodMonth, financialDiscountPct, vKey, dKey, tKey]
// ↑ NO incluye refreshKey
```

Y luego en el hook:
```ts
// refreshKey: si cambia, invalida el cache forzando refetch en el próximo render.
void refreshKey;   // ← se ignora explícitamente
```

Cuando el usuario sube un Excel y `UploadVentasDialog` llama `onUploaded() → setRefreshKey(k+1)`, el cache de React Query **no se invalida** porque `refreshKey` ni está en la queryKey ni se llama a `invalidateQueries`. El dashboard sigue mostrando los datos viejos → el usuario percibe "la importación no funcionó".

Además, los catálogos auxiliares (`get_sales_months`, `financial_discounts`) tienen `staleTime: 5 min`, así que el nuevo mes recién importado tampoco aparece en el selector hasta pasados 5 minutos.

### Otros impactos colaterales

- En **Calculadora**, después de importar costos en otra sección (productos/operacionales), las queries `monthCatalogQueryOptions`, `productCostsQueryOptions`, `operationalQueryOptions` y `sourceOptionsQueryOptions` también quedan en cache 60 s y no se invalidan automáticamente cross-feature.
- En **Negociaciones**, el cache `master_references` (5 min) puede mostrar referencias desactualizadas si se reemplaza una lista de precios.

### Lo que NO está roto (verificado leyendo código)

- `Dropzone.tsx`: drag&drop intacto.
- `parseExcel`, `parseExcelSheets`, `parseExcelWithMapping`: sin cambios.
- `ImportWizardDialog`: 3 pasos (archivo → mapeo → preview) sin cambios.
- `UploadVentasDialog`: lógica de parseo, validación y `chunkedInsert` sin cambios.
- Listas de precios, costos productos, costos operacionales, negociaciones: el handler `refresh` SÍ llama `queryClient.invalidateQueries(...)` correctamente. Estos refrescan bien.

## Plan de arreglo

### 1. Análisis de ventas — refrescar tras importar (causa raíz)

Cambiar `useSalesAnalytics.ts` para que `refreshKey` invalide el cache real:

- Añadir `refreshKey` a la queryKey de `dashboardQueryOptions` y `useSalesDetail` (ésta última ya lo tiene, pero lo confirmo).
- Cambiar `UploadVentasDialog.onUploaded` en `AnalisisVentasPage` para que, además de incrementar `refreshKey`, dispare:
  ```ts
  queryClient.invalidateQueries({ queryKey: ["sales-analytics"] })
  ```
  Eso refresca dashboard + detail + months + financial discounts en una llamada.

### 2. Calculadora — invalidar cuando se importa en otra sección

Cuando el usuario sube costos de producto u operacionales, invalidar también las queries de calculadora:

- En `CostosProductosPage` `refresh()` añadir:
  ```ts
  queryClient.invalidateQueries({ queryKey: ["calc"] })
  ```
- Igual en `CostosOperacionalesPage` `refresh()`.
- Igual en `ListasPreciosPage` y `NegociacionesPage` (cuando cambian, también afectan a calculadora).

### 3. Verificación manual del flujo de importación

Después del fix, validar manualmente:
- **Análisis de ventas**: subir Excel → dashboard se actualiza con KPIs nuevos sin recargar.
- **Listas de precios**: crear lista nueva → aparece en la tabla.
- **Costos de producto**: subir mes → tabla muestra los datos.
- **Costos operacionales**: igual.
- **Negociaciones**: crear → aparece en lista.

### Archivos a modificar

- `src/features/analisis-ventas/useSalesAnalytics.ts` — incluir `refreshKey` en queryKeys del dashboard.
- `src/features/analisis-ventas/AnalisisVentasPage.tsx` — `onUploaded` debe llamar `queryClient.invalidateQueries`.
- `src/features/costos-productos/CostosProductosPage.tsx` — invalidar `["calc"]` al refrescar.
- `src/features/costos-operacionales/CostosOperacionalesPage.tsx` — igual.
- `src/features/listas-precios/ListasPreciosPage.tsx` — igual al refrescar/crear.
- `src/features/negociaciones/NegociacionesPage.tsx` y `NegotiationEditor.tsx` — igual al guardar.

### Lo que NO voy a tocar

- `Dropzone`, `ImportWizardDialog`, `ColumnMapper`, `SheetAndHeaderPicker`, `parseExcel*`: están bien, no se rompieron.
- `React.lazy` en los dialogs: se queda, no es la causa del problema y aporta el ahorro de bundle.
- Migración a React Query: se queda, solo se corrige la invalidación que faltaba.

## Resultado esperado

- En análisis de ventas, subir un Excel actualiza inmediatamente el dashboard, KPIs, tabla detalle y selector de meses.
- En el resto de secciones la importación sigue funcionando como hasta ahora.
- En calculadora, los cambios hechos en costos/listas/negociaciones se reflejan al volver a abrirla, sin esperar 60 s.

