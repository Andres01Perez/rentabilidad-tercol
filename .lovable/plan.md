## Plan de corrección

1. Corregir la lógica financiera para que toda la rentabilidad parta de ventas netas
- Ajustar `useSalesAnalytics.ts` para que el descuento financiero se reste antes de calcular margen bruto en plata y margen bruto %.
- Cambiar la base del costo operacional para que también use ventas netas, no ventas totales/brutas.
- Recalcular `margenBruto`, `margenPct`, `operacionalMonto`, `utilidad` y `utilidadOperacionalPct` con la misma base financiera.
- Revisar también rankings y cualquier porcentaje derivado para que no mezclen ventas brutas con ventas netas.

2. Alinear la card de operacional con la altura de las demás cards
- Rediseñar `OperationalSplitCard` en `AnalisisVentasPage.tsx` para mantener altura fija/consistente dentro de la grilla.
- Mantener el desglose visible, pero en un formato compacto: bloque principal a la izquierda y lista resumida a la derecha dentro del mismo alto.
- Limitar visualmente el espacio del desglose con distribución interna controlada para evitar que la card crezca cuando existan muchos centros de costo.
- Conservar nombres y porcentajes legibles, priorizando claridad y simetría con el resto de KPIs.

3. Dejar la barra de filtros realmente fija al hacer scroll
- Ajustar el contenedor sticky de filtros para que quede anclado debajo del header principal de la app.
- Refinar `top`, `z-index`, fondo y borde para que no se mezcle visualmente con el contenido al desplazarse.
- Verificar que no haya conflicto con el layout autenticado (`src/routes/_app.tsx`) ni con el sidebar colapsable.
- Mantener comportamiento responsivo para escritorio y pantallas medianas.

4. Validación final
- Revisar que los hints y textos de las cards no contradigan la nueva lógica basada en ventas netas.
- Confirmar que la fila de KPIs conserve alineación vertical homogénea.
- Comprobar que la tabla y los avisos sigan funcionando correctamente con la barra de filtros sticky.

## Hallazgos que se van a corregir
- Hoy `margenBruto` por línea se calcula con `valor_total - costoLinea`, o sea sobre venta bruta.
- Hoy `margenPct` KPI usa `margenBruto / ventasComputables`, también sobre base bruta.
- Hoy `operacionalMonto` se calcula con `ventas * pctOperacional`, cuando debe salir de ventas netas si todo debe tomar esa base.
- La `OperationalSplitCard` actualmente crece en altura porque renderiza todo el desglose debajo del KPI.
- La barra de filtros ya tiene `sticky`, pero necesita afinarse para que quede correctamente fija dentro del layout real de la app.

## Detalles técnicos
- Archivos principales a tocar:
  - `src/features/analisis-ventas/useSalesAnalytics.ts`
  - `src/features/analisis-ventas/AnalisisVentasPage.tsx`
  - posible ajuste menor en `src/routes/_app.tsx` solo si el offset sticky necesita coordinación con el header global.
- Dirección de fórmulas:
```text
ventas computables
  - descuento financiero
= ventas netas

ventas netas
  - costo producto
= margen bruto en plata

margen bruto / ventas netas
= margen bruto %

ventas netas * % operacional
= costo operacional

margen bruto - costo operacional
= utilidad operacional
```

Apenas apruebes, lo implemento.