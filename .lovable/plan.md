## Plan de implementación

1. Simplificar el filtro principal de `/analisis-ventas`
- Reemplazar el `DateRangePicker` por un selector de mes único.
- Construir la lista de meses a partir de las ventas realmente cargadas en la tabla `sales`, para que el usuario elija solo entre meses con información.
- Dejar ese filtro como criterio principal de consulta, usando el mes completo seleccionado de forma automática.

2. Ajustar la lógica de carga en `useSalesAnalytics`
- Cambiar el parámetro `range` por un `salesMonth` (formato `YYYY-MM-01`).
- Convertir internamente ese mes en rango completo de fechas (`desde el día 1 hasta el último día del mes`) para seguir consultando `sale_date` sin cambiar la estructura de la tabla.
- Exponer también el catálogo de meses disponibles en ventas para alimentar el nuevo selector del frontend.

3. Actualizar la UI de `/analisis-ventas`
- Quitar la complejidad de selección por rango y mostrar un control simple de “Mes de ventas”.
- Mantener los selectores actuales de “Mes de costos” y “Mes operacional”, pero con valor por defecto en el mes anterior al actual.
- Si el mes anterior no existe en el catálogo de costos u operacionales, usar el mes más reciente disponible para evitar estados vacíos innecesarios.

4. Ajustar defaults en la calculadora
- Cambiar la selección inicial de meses en `CalculadoraPage` para que:
  - costos de producto arranquen con el mes anterior,
  - costos operacionales arranquen con el mes anterior.
- Mantener la selección múltiple actual para que el usuario todavía pueda cambiar o agregar otros meses manualmente.
- Aplicar la misma regla de fallback: si el mes anterior no existe en el catálogo, preseleccionar el más reciente disponible.

5. Alinear defaults en módulos de mantenimiento
- Cambiar `CostosProductosPage` para que abra por defecto en el mes anterior en vez del mes actual.
- Cambiar `CostosOperacionalesPage` para que abra por defecto en el mes anterior en vez del mes actual.
- Conservar `MonthSelect` tal como está, solo cambiando el valor inicial.

## Resultado esperado
- En análisis de ventas el usuario escogerá un mes, no un rango arbitrario.
- Costos y costos operacionales arrancarán automáticamente en el mes anterior, que es el comportamiento real de uso.
- La navegación será más rápida y con menos fricción porque habrá menos decisiones manuales al entrar a cada módulo.

## Detalles técnicos
- Archivos principales a tocar:
  - `src/features/analisis-ventas/AnalisisVentasPage.tsx`
  - `src/features/analisis-ventas/useSalesAnalytics.ts`
  - `src/features/calculadora/CalculadoraPage.tsx`
  - `src/features/costos-productos/CostosProductosPage.tsx`
  - `src/features/costos-operacionales/CostosOperacionalesPage.tsx`
- Helpers reutilizables:
  - `previousMonth(currentMonthDate())` para el default base.
  - fallback al primer mes disponible cuando el default no exista en la data.
- No hace falta cambiar base de datos ni estructura de tablas; es un ajuste de estado inicial, consulta y experiencia de uso.