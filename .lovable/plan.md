## Por qué el sticky no está funcionando

La barra de filtros tiene las clases correctas (`sticky top-[4.5rem] z-30`), pero hay un bloqueador estructural:

**Causa raíz:** El contenedor padre directo de la página tiene `overflow-x-hidden`:

```tsx
// src/features/analisis-ventas/AnalisisVentasPage.tsx (línea 616)
<div className="mx-auto w-full max-w-[1600px] space-y-8 overflow-x-hidden px-4 py-10 ...">
```

`position: sticky` deja de funcionar como "fijo" cuando cualquier ancestro tiene `overflow: hidden`, `auto` o `scroll` en cualquier eje. El elemento se vuelve sticky **dentro** de ese contenedor, pero como el contenedor en sí hace scroll con la página, la barra se va con él.

Hay un segundo problema menor: el header global (`src/routes/_app.tsx`) mide `h-14` (56px = `3.5rem`), pero la barra usa `top-[4.5rem]` (72px). Eso deja un espacio visible de 16px entre header y filtros al hacer scroll.

## Cambios

### 1. `src/features/analisis-ventas/AnalisisVentasPage.tsx`

- **Quitar `overflow-x-hidden`** del contenedor raíz de la página (línea 616). Si en algún momento se necesita contener overflow horizontal, se aplicará puntualmente al elemento que lo cause (ej. la tabla), no al contenedor que envuelve la barra sticky.
- **Ajustar `top-[4.5rem]` → `top-14`** en la barra de filtros para que quede pegada exactamente debajo del header global (`h-14`), sin gap visible.
- Mantener `z-30` (el header está en `z-20`, así que la barra queda por encima al hacer scroll).
- Mantener `bg-card/95 backdrop-blur-xl` para que el contenido que pasa por debajo no se vea sólido detrás de la barra.

### 2. Verificación de ancestros sticky-safe

Revisar que ningún otro ancestro entre la barra y el viewport tenga `overflow` distinto de `visible`:

- `src/routes/_app.tsx` → `<main className="flex-1 min-w-0">`: sin overflow ✅
- `<div className="relative z-10 flex flex-1 flex-col">`: sin overflow ✅
- `<SidebarProvider>` y `<div className="relative flex min-h-screen w-full bg-background">`: sin overflow ✅

Con quitar el `overflow-x-hidden` de la página queda toda la cadena limpia.

### 3. Sin tocar lógica financiera

Esta corrección es puramente de layout/CSS. No se modifica `useSalesAnalytics.ts` ni ninguna fórmula ya aprobada (ventas netas, margen bruto, costo operacional, desglose de centros de costos).

## Resultado esperado

Al hacer scroll dentro de Análisis de ventas:
- El header global "Tercol › Análisis de ventas" queda fijo arriba (ya funciona).
- La barra de filtros (Mes de ventas, Mes de costos, Mes operacional, Descuento financiero, Vendedor, Dependencia, Tercero) queda fija inmediatamente debajo del header, visible en todo momento.
- El contenido de KPIs, gráficos y tabla se desliza por debajo de la barra con el efecto de blur de fondo.
