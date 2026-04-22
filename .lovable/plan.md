

# Diagnóstico: pantalla blanca por dependencia rota

## La causa real (no es código tuyo)

El dev-server está fallando con este error desde hace rato:

```
✘ [ERROR] Could not resolve "@radix-ui/react-slot"
  ../@radix-ui/react-separator/.../react-primitive/dist/index.mjs:4:27:
  import { createSlot } from "@radix-ui/react-slot";
```

Lo que pasa:
- `@radix-ui/react-separator` (instalado) requiere `@radix-ui/react-slot` como dependencia interna.
- Esa dependencia **no está resuelta en `node_modules`**, así que Vite no puede empaquetar nada.
- Resultado: ningún módulo lazy carga → pantalla blanca + el error que ves de `analisis-ventas.lazy.tsx` (es solo el primer chunk que intenta pedir; cualquier otro fallaría igual).

Esto **no tiene nada que ver con `/analisis-ventas`** ni con los cambios anteriores de sesión. La ruta es la víctima, no el culpable. Por eso F5 no resuelve nada: el bundler está caído.

## Qué voy a hacer

### 1) Reinstalar `@radix-ui/react-slot` explícitamente
Aunque otros componentes Radix lo traen como peer/sub-dep, varias versiones recientes de los paquetes Radix (separator, label, slot, etc.) lo requieren como dependencia directa. Voy a añadirlo al `package.json` del proyecto para que quede resuelto sí o sí.

### 2) Forzar revalidación del cache de Vite
El error queda "pegado" en `node_modules/.vite/deps`. Después de instalar la dependencia, hay que hacer que Vite reoptimice. Lo más limpio es tocar `vite.config.ts` o forzar el `optimizeDeps.force` en el próximo arranque (lo manejo en el reinicio del dev-server).

### 3) Verificar otras dependencias Radix con el mismo síntoma
Voy a revisar si `@radix-ui/react-label`, `react-toggle`, etc. tienen el mismo problema de sub-dep no resuelta y, si los hay, instalarlos explícitamente. Esto previene que el siguiente F5 caiga en el mismo bug con otro paquete.

### 4) Confirmar build limpio
Después de los cambios, verificar que `tsc --noEmit` y el dev-server arrancan sin el "Could not resolve". Una vez verde, la pantalla blanca desaparece.

## Lo que NO voy a tocar

- No voy a modificar `analisis-ventas.lazy.tsx`, `AnalisisVentasPage`, `AuthContext`, ni la sesión. Esos están bien — el problema es de dependencias del bundler.
- No voy a quitar el lazy split. Funciona, solo que ahora mismo no puede cargar porque el bundler está caído.

## Resultado esperado

- Dev-server arranca sin el error de `@radix-ui/react-slot`.
- La pantalla blanca desaparece en cuanto el navegador haga la próxima petición.
- `/analisis-ventas` y todas las demás rutas vuelven a cargar normalmente con un F5.

## Archivos a tocar

- `package.json` — añadir `@radix-ui/react-slot` (y cualquier otro Radix sub-dep faltante que detecte).
- (Posiblemente) limpiar `node_modules/.vite` para forzar reoptimización.

