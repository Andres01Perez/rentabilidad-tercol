# El lag de 5–15 s es del preview de Lovable, no de tu app

Antes de cambiar nada, necesito ser claro porque llevamos varios pasos sin acertar:

## Qué medí ahora mismo

| Entorno | Vista | Tiempo a render |
|---|---|---|
| **Producción** (`rentabilidad-tercol.lovable.app`) | `/dashboard` | **2.07 s** (DOM Interactive), **2.06 s** (First Paint) |
| **Preview Lovable** (`*.lovableproject.com`) | `/dashboard` | 3.4 s (DOM Interactive), 5.6 s (Full Load) |

En producción la app ya carga rápido. **El lag de 5–15 s que estás viendo es el dev-server del preview de Lovable.** Lo confirma el detalle del network: el preview baja **138 chunks separados**, cada uno entre **800 ms y 1500 ms**, porque Vite los sirve uno a uno sin bundlear. Eso es normal en desarrollo y **no se arregla desde el código**.

Lo único que puede sentirse "lento" en la app real son dos cosas concretas, y ambas las puedo arreglar:

## 1. Bug real: hydration mismatch en el selector de usuario (~200–400 ms extra por vista)

En el log del dev-server hay este error en cada navegación:

```
Hydration failed because the server rendered text didn't match the client.
+ title="Andres Perez"
- title="Sistema (sin firma)"
+ AP
- S
```

Causa: el SSR pinta "Sistema/S" porque no tiene `sessionStorage`, y el cliente lee el storage y pinta "Andres Perez/AP". React tira a la basura **todo el árbol del layout** (sidebar + header + main) y lo vuelve a construir. Eso es lo que sientes como un parpadeo y un retraso al entrar a cualquier vista.

Fix: marcar el `UserSwitcher` como cliente puro con `suppressHydrationWarning` + render diferido en su contenido — es un cambio quirúrgico de un solo archivo, no toca nada más.

## 2. Sobre-ingeniería real que introdujimos en los pasos pasados

Tienes razón en que esto se complicó. Te propongo **revertir el exceso** y dejar solo lo que sí ayuda:

### Lo que voy a SIMPLIFICAR (quitar)

- **Borrar los `*.lazy.tsx`** de las páginas pequeñas (`dashboard`, `historial`, `configuraciones`, `listas-precios`, `costos-operacionales`, `costos-productos`, `calculadora`, `negociaciones`). El `autoCodeSplitting` de TanStack ya hace eso solo; los archivos manuales son ruido y duplican el bootstrap.
- **Quitar `validateSearch` + `zodValidator` + `loaderDeps`** de `costos-operacionales` y `costos-productos`. El `month` vuelve a ser `useState` local. Cuando el usuario cambia de mes, se pide la data al cambiar — exactamente lo mismo que antes, con la mitad del código.
- **Quitar `getRouteApi`** de las páginas (ya no hace falta sin search params).
- **Quitar `useSuspenseQuery`** y los `loader` de las rutas — vuelvo a `useQuery` simple en el componente. El cache de TanStack Query (60 s) sigue ahí, así que no hay regresión de velocidad y se elimina toda la complejidad de "ensureQueryData en el loader".

### Lo que voy a MANTENER (porque sí ayuda y no estorba)

- **`QueryClient` con `staleTime: 60s`** — esto es lo único que de verdad evita refetches al volver a una vista. Cero costo en complejidad.
- **`React.lazy` para `ImportWizardDialog` y `UploadVentasDialog`** — esos sí pesan ~80 KB de SheetJS y solo se necesitan al subir un Excel. Se queda.
- **`defaultPreload: false`** — porque el preload-on-hover saturaba Supabase. Se queda.
- **Estructura `/_app/*` con sidebar compartido** — es la forma "nativa" de TanStack Start, no es complejidad nuestra.

### Lo que NO voy a tocar

- `analisis-ventas` y `negociaciones`: son las páginas pesadas de verdad. La simplificación va para las páginas chiquitas que tú mencionaste.

## Resultado esperado

- **En producción**: igual de rápido que ahora (~2 s primer paint, navegación SPA instantánea entre vistas cacheadas).
- **En el preview de Lovable**: el primer paint seguirá tardando 3–5 s porque es Vite-dev y eso no depende de nosotros, pero **desaparece el parpadeo y los ~400 ms del re-render por hydration**, y el código vuelve a ser legible.
- **Líneas de código netas**: bajan ~150 líneas (los `.lazy.tsx`, los esquemas zod, los `getRouteApi`, los `loader`).

## Aclaración importante

No puedo hacer que el preview de Lovable cargue en menos de 1 s — eso no es código de la app, es cómo Vite sirve el desarrollo. La medida real de tu app es la versión publicada, y ya está en 2 s. Si después de aplicar este plan sientes que la versión publicada sigue lenta, ahí sí tengo más cosas que ajustar (preconnect a Supabase, prefetch de fuentes, etc.). Pero quería ser honesto antes de seguir agregando capas.

## Archivos que tocaría

- `src/components/layout/UserSwitcher.tsx` — fix hydration
- `src/routes/_app/{dashboard,listas-precios,costos-operacionales,costos-productos,calculadora,negociaciones}.lazy.tsx` — eliminar
- `src/routes/_app/{listas-precios,costos-operacionales,costos-productos}.tsx` — quitar `loader`, `validateSearch`, `loaderDeps`; dejar solo `head` + `component`
- `src/features/listas-precios/ListasPreciosPage.tsx` — `useSuspenseQuery` → `useQuery`
- `src/features/costos-operacionales/CostosOperacionalesPage.tsx` — `useSuspenseQuery` → `useQuery`, `month` vuelve a `useState`
- `src/features/costos-productos/CostosProductosPage.tsx` — igual

¿Avanzo con esto?
