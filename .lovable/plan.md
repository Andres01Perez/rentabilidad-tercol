## Objetivo
Ajustar el layout del bloque de “Añadir referencia” y de la tabla de items para que ninguno se monte sobre el otro durante scroll, apertura del buscador o uso del header sticky de la tabla.

## Qué voy a cambiar
1. Revisar el orden visual y el stacking context del buscador, su dropdown y el contenedor de la tabla.
2. Corregir los `z-index`, `position` y fondos opacos para que:
   - el dropdown del buscador se vea por encima de la tabla cuando esté abierto,
   - el header sticky de la tabla no tape el buscador,
   - no haya transparencias o solapes visuales al hacer scroll.
3. Ajustar el espaciado vertical entre ambos bloques para que el selector de referencias tenga respiración suficiente y no quede “pegado” a la tabla.
4. Validar que el estado vacío, la tabla cargada y el dropdown de resultados se comporten bien en el viewport actual.

## Resultado esperado
- El buscador de “Añadir referencia” queda siempre legible y accesible.
- La tabla no invade el área del buscador.
- El header sticky de la tabla sigue funcionando sin generar superposición indebida.
- El dropdown de resultados aparece por encima solo cuando corresponde.

## Detalles técnicos
- El ajuste se concentrará en `src/features/negociaciones/NegotiationCalculator.tsx`.
- Voy a tratar el problema como uno de capas y contenedores, no de lógica de negocio.
- Si hace falta, se normalizarán estos puntos:
  - `z-0 / z-10 / z-20 / z-50`
  - `relative / sticky / absolute`
  - fondos (`bg-card`, `bg-background`, `bg-popover`) para evitar transparencias aparentes
  - márgenes/padding entre el buscador y la tabla