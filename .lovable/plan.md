# Plan actualizado: descuento financiero y nuevo esquema de KPIs en análisis de ventas

## Objetivo
Agregar un parámetro de descuento financiero en `/analisis-ventas`, aplicarlo a los cálculos de rentabilidad y reorganizar las cards para que reflejen correctamente ventas netas, utilidad y utilidad operacional.

## Qué se va a implementar

### 1. Nuevo parámetro: descuento financiero
- Crear una tabla de catálogo para almacenar los porcentajes permitidos de descuento financiero.
- Cargar ese catálogo en la vista como un selector con estas opciones:
  - 1%
  - 1.5%
  - 2%
  - 2.5%
  - 3%
  - 3.5%
  - 4%
- Definir **2.5% como valor por defecto** al abrir la vista.

### 2. Aplicar el descuento financiero a los cálculos
Actualizar `useSalesAnalytics.ts` para calcular los KPIs con esta lógica:
- Ventas totales = suma de ventas importadas.
- Costo total = suma de costos solo de líneas computables.
- Margen bruto en plata = ventas computables - costo total.
- Margen bruto en porcentaje = margen bruto / ventas computables.
- Operacional % = porcentaje total de costos operacionales del mes seleccionado.
- Operacional $ = ventas totales × porcentaje operacional.
- **Ventas netas** = ventas computables - descuento financiero sobre ventas computables.
- **Utilidad** = ventas netas - costo total.
- **Utilidad operacional en plata** = utilidad - operacional $.
- **Utilidad operacional en porcentaje** = margen bruto % - porcentaje operacional.

### 3. Mantener la exclusión de referencias con costo cero o sin costo
- Conservar la lógica ya implementada para excluir referencias con `ctu <= 0` o sin costo del cálculo de costos y márgenes.
- Mantener el aviso de líneas excluidas para que el usuario vea qué ventas no participaron en la rentabilidad.
- Asegurar que el descuento financiero y los porcentajes de utilidad se calculen sobre la base computable correcta, sin contaminarse con referencias inválidas.

### 4. Reorganizar las cards superiores
Reemplazar las cards actuales por dos filas:

#### Primera fila
- Ventas totales
- Margen bruto en plata
- Margen bruto en porcentaje
- Operacional: porcentaje y plata en la misma card, con mayor jerarquía visual para el porcentaje

#### Segunda fila
- Ventas netas
- Costo total
- Utilidad operacional en plata
- Utilidad operacional en porcentaje

### 5. Ajustar etiquetas y conceptos en toda la vista
- Eliminar el concepto de “ventas brutas” y usar únicamente **ventas netas**.
- Eliminar el concepto de “margen operacional” y reemplazarlo por **utilidad operacional**.
- Si existen textos, hints, cards o cálculos auxiliares que aún hablen de “margen neto” o “margen operacional”, alinearlos al nuevo lenguaje para evitar inconsistencias.

### 6. Ajustar la UI del filtro superior
- Agregar el selector de descuento financiero junto a los demás filtros.
- Mostrarlo como un selector simple y consistente con los selects actuales.
- Etiquetarlo claramente para que se entienda que afecta ventas netas, utilidad y utilidad operacional.

## Cambios de datos necesarios
Se requiere una migración para crear una tabla catálogo, por ejemplo `financial_discounts`, con al menos:
- `id`
- `label`
- `percentage`
- `sort_order`
- `is_active`
- timestamps

También se sembrarán los 7 valores iniciales y se dejará **2.5%** como opción por defecto en la experiencia de uso del frontend.

## Archivos previstos
- `src/features/analisis-ventas/useSalesAnalytics.ts`
- `src/features/analisis-ventas/AnalisisVentasPage.tsx`
- nueva migración en `supabase/migrations/...`
- `src/integrations/supabase/types.ts` se actualizará automáticamente según el esquema resultante

## Detalles técnicos
- El hook debe devolver nuevos campos KPI, por ejemplo:
  - `descuentoFinancieroPct`
  - `descuentoFinancieroMonto`
  - `ventasNetas`
  - `operacionalMonto`
  - `utilidad`
  - `utilidadOperacional`
  - `utilidadOperacionalPct`
- El catálogo de descuentos se consulta una vez y se usa para poblar el selector.
- La card operacional de la primera fila destacará visualmente el porcentaje sobre el valor en pesos.
- Los rankings y la tabla detalle se revisarán para que no sigan mostrando conceptos obsoletos como “margen neto” si ya no corresponden al modelo nuevo.

## Resultado esperado
La vista de análisis de ventas quedará alineada con la lógica real del negocio: descuento financiero configurable, ventas netas como base posterior al descuento, utilidad calculada correctamente y utilidad operacional presentada con una estructura de KPIs más clara.