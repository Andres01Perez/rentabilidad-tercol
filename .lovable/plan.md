## Objetivo
Quitar el error persistente `Minified React error #284` en `/calculadora` y `/analisis-ventas`, dejando ambas vistas estables, simples y funcionales.

## Diagnóstico
El problema no parece venir de tu lógica de negocio sino de la capa de gráficos.

Los dos módulos que fallan comparten `recharts`:
- `src/features/analisis-ventas/AnalisisVentasPage.tsx`
- `src/features/calculadora/RentabilidadCharts.tsx`

Además, encontré una inconsistencia de dependencias:
- `package.json` declara `recharts: ^3.0.0`
- `package-lock.json` sigue bloqueando `recharts: 2.15.4`

Y la documentación pública de Recharts muestra historial de problemas de compatibilidad/render con React 19 y `ResponsiveContainer`. Eso encaja con tu error de `ref` inválido.

## Plan
1. **Normalizar dependencias para evitar mezcla de versiones**
   - Alinear `package.json` y lockfile para que la versión real instalada sea consistente.
   - Verificar si conviene dejar `recharts` en una versión realmente compatible o retirarlo del flujo crítico.

2. **Eliminar la fuente del error en ambas páginas**
   - Quitar la dependencia de `ResponsiveContainer`/Recharts de `/analisis-ventas` y `/calculadora`.
   - Reemplazar los gráficos por componentes simples hechos con HTML/CSS/SVG nativo de React.
   - Mantener visualizaciones útiles, pero sin librerías que manejen refs internamente.

3. **Conservar valor funcional de ambas vistas**
   - En `/analisis-ventas`: mantener KPIs, tabla, filtros, ordenamiento e insights visuales sencillos.
   - En `/calculadora`: mantener cálculo, tabla completa, exportación a Excel y gráficos/insights simples y estables.

4. **Aplicar una capa de fallback segura**
   - Si no hay datos, mostrar estados vacíos claros.
   - Si hay datos parciales, renderizar tablas/resúmenes sin intentar montar componentes frágiles.
   - Evitar cualquier patrón que dependa de refs complejos o medición automática del contenedor.

5. **Revisar los puntos exactos donde hoy se rompe**
   - `src/features/analisis-ventas/AnalisisVentasPage.tsx` — charts de línea y barras.
   - `src/features/calculadora/RentabilidadCharts.tsx` — barras, distribución y scatter.
   - `src/features/calculadora/CalculadoraPage.tsx` — montaje condicional del bloque de resultados.

## Resultado esperado
- Desaparece el error React #284.
- `/calculadora` vuelve a calcular correctamente al hacer clic en el botón.
- `/analisis-ventas` deja de romperse por los gráficos.
- La app queda más simple, más nativa y más estable.

## Detalles técnicos
Implementaré un reemplazo con componentes propios, por ejemplo:
- barras horizontales con `div` + widths en `%`
- histogramas simples con `div`/CSS grid
- dispersión simplificada con SVG nativo
- tarjetas de insight cuando el gráfico no aporte más que una tabla resumida

Esto evita:
- refs internos de terceros
- `ResponsiveContainer`
- dependencias frágiles frente a React 19

## Archivos a tocar
- `package.json`
- `package-lock.json` si hace falta normalizarlo
- `src/features/analisis-ventas/AnalisisVentasPage.tsx`
- `src/features/calculadora/RentabilidadCharts.tsx`
- posiblemente `src/features/calculadora/CalculadoraPage.tsx`

## Entrega
Haré una corrección enfocada en estabilidad primero, no en sofisticación visual. La prioridad será que funcione bien todos los días, sin seguir atrapados en este error.