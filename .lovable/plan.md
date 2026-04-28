# Reorganización de sticky, z-index y márgenes

Análisis de la jerarquía actual entre `_app.tsx` (header global), `NegociacionesPage.tsx` (contenedor) y `NegotiationCalculator.tsx` (KPIs + buscador + tabla).

## Diagnóstico actual

### Stack de elementos en el viewport

| Capa | Selector | sticky | z-index |
|---|---|---|---|
| Header global | `_app.tsx` `<header>` | `top-0` | `z-20` |
| KPIs negociación | `NegotiationCalculator` div sticky | `top-14` | `z-10` |
| Buscador "Añadir referencia" | div `glass relative` | — | `z-20` |
| Dropdown resultados búsqueda | absolute dentro del buscador | — | `z-50` |
| Tabla items | div `glass relative` | — | `z-0` (con `isolate`) |
| TableHeader | thead | (recién quitado el sticky) | — |

### Problemas detectados

1. **Conflicto z-index header global (z-20) vs KPIs (z-10)**: bien — los KPIs pasan por debajo del header global. Correcto.

2. **Buscador `z-20` >= KPIs `z-10`**: el buscador NO es sticky pero tiene z-20. Cuando hace scroll, los KPIs sticky deberían estar por encima del buscador estático, pero el buscador está en z-20 y los KPIs en z-10 → al hacer scroll el contenido del buscador se pinta sobre los KPIs sticky. **Esto rompe el layering**.

3. **Padding/margen del bloque sticky superior**: `-mx-1 px-1 pb-2 pt-3` con `bg-background/95`. Como el header global ya tiene altura 56 px (`h-14`), el sticky se pega justo debajo, pero sin margen propio. Cuando aparece debajo del header con `backdrop-blur-xl` y el header también lo tiene, se ven dos capas de blur superpuestas (efecto raro). Además `-mx-1` sobresale 4 px lateralmente, creando un mini-overflow.

4. **Tabla con `isolate` + `z-0`**: `isolate` crea un nuevo contexto de apilamiento, lo que es correcto para encapsular los inputs internos, pero en combinación con el dropdown del buscador (z-50 absolute) y el buscador padre (z-20), el dropdown queda encima de la tabla solo porque su padre tiene z-20. Si el buscador baja a z-30 (más alto que sticky) está OK, pero hay que asegurar el orden.

5. **Sección padre `space-y-3` + `mt-4 mb-1` en el buscador**: redundante, `space-y-3` ya añade 12 px y luego `mt-4` añade 16 px más, dando 28 px arriba pero `mb-1` solo 4 px → asimetría OK por intención (acercar a tabla), pero `space-y-3` también añade 12 px entre buscador y tabla → la separación efectiva con la tabla es 12 px (no 4 px). El `mb-1` queda anulado por `space-y-3` (las clases space-y aplican `margin-top` al hermano siguiente, no `margin-bottom`).

6. **Container de la página**: `mt-8` separa el editor del PageHeader, pero como el sticky se pega al header global, esos 32 px hacen que al cargar la página los KPIs estén bajo el PageHeader, y al hacer scroll el sticky "salta" al activarse en `top-14`. Es funcional pero el salto visual se nota.

7. **TableHeader sin sticky**: en la edición anterior se quitó. Funciona pero el header del thead ya no acompaña al usuario al hacer scroll. Para tablas largas pierde contexto. Como hay un sticky superior grande (KPIs), añadirle un thead sticky requeriría calcular `top-[Xpx]` exacto, lo que es frágil.

## Reorganización propuesta

### 1. Sistema de z-index unificado

Definir una escala clara y aplicarla:

```text
z-50  Dropdown de búsqueda (debe flotar sobre todo el contenido)
z-40  Header global (sticky top-0)            ← antes z-20
z-30  Sticky KPIs negociación (sticky top-14) ← antes z-10
z-20  Buscador estático (NO sticky)           ← antes z-20 (mantiene)
z-0   Tabla items                              ← mantener con isolate
```

Con esto:
- El header global siempre cubre lo que pase por debajo.
- Los KPIs sticky cubren el buscador y la tabla al hacer scroll.
- El buscador queda sobre la tabla (necesario para que el dropdown se vea).
- El dropdown z-50 está garantizado por encima de todo, incluso si su padre es z-20, porque al ser `absolute` con `z-50` busca el contexto de apilamiento más cercano (el buscador con z-20 que NO crea isolate, así que escala hacia arriba). Aún así, conviene anclarlo dentro de un padre con `position: relative` y dejar `z-50` como prioridad alta.

**Cambio en `_app.tsx`**: subir el header a `z-40` para que esté siempre por encima del sticky de KPIs (`z-30`), evitando solapamiento al hacer scroll rápido.

### 2. Márgenes y padding del sticky superior

Estado final del bloque KPIs sticky:

```tsx
<div className="sticky top-14 z-30 -mx-4 px-4 pt-2 pb-3 sm:-mx-6 lg:-mx-8 sm:px-6 lg:px-8 bg-background/80 backdrop-blur-xl">
  <div className="rounded-2xl border ...">
    {/* contenido */}
  </div>
</div>
```

Razones:
- `-mx-4 px-4` (con variantes responsive) extiende el fondo del sticky de borde a borde del contenedor padre (`max-w-[1700px] px-4 sm:px-6 lg:px-8`), eliminando los huecos laterales que dejan ver la tabla pasar por detrás.
- `bg-background/80` (en vez de `/95`) + `backdrop-blur-xl` da profundidad sin "tapar" totalmente.
- `pt-2 pb-3` aire mínimo para que la card flotante respire del header global.

### 3. Espaciado entre bloques

Reemplazar `space-y-3` del `<section>` por márgenes explícitos para evitar conflicto con `mt-4`/`mb-1` del buscador:

```tsx
<section className="space-y-0">
  <div className="sticky ..."> KPIs </div>      {/* sin margen extra */}
  <div className="mt-4 mb-2 ..."> Buscador </div>  {/* aire arriba, poco abajo */}
  <div className="..."> Tabla </div>             {/* pegada al buscador */}
</section>
```

Resultado:
- 16 px entre KPIs y buscador (visualmente separados; el sticky tiene su propio `pb-3`).
- 8 px entre buscador y tabla (cercanía visual sugiere relación).

### 4. Container página: ajuste del `mt-8`

Bajar a `mt-6` en `NegociacionesPage.tsx` para reducir el "salto" inicial cuando el sticky se activa al hacer scroll.

### 5. TableHeader: re-añadir sticky compensando los KPIs

El sticky superior tiene altura variable según los items, pero con un `top` calculado en CSS puro mediante `top-[calc(56px+Y)]`, donde 56 px = header global y Y = altura aproximada del bloque KPIs. Como esto es frágil, la decisión es:

**No re-añadir sticky al thead.** En su lugar, el header de la tabla queda en flujo normal y el usuario tiene los KPIs sticky arriba como contexto permanente (que ya muestra totales). Es coherente con la decisión previa de eliminar el scroll interno.

### 6. Buscador (relayer)

```tsx
<div className="glass relative z-20 mt-4 mb-2 rounded-2xl ...">
  {/* input + botón importar */}
  <div className="relative">
    {searchOpen && (
      <div className="absolute left-0 right-0 top-full z-50 mt-1 ...">
        {/* dropdown */}
      </div>
    )}
  </div>
</div>
```

Sin cambios estructurales, solo confirmar:
- Padre `relative z-20` (estático).
- Dropdown `absolute z-50`.
- El padre NO usa `isolate`, por lo que `z-50` del dropdown sale del contexto local y queda sobre la tabla (`z-0` aislado, pero `z-50` del dropdown es del contexto raíz porque su padre no aísla).

## Resumen de cambios por archivo

### `src/routes/_app.tsx`
- Header global: `z-20` → `z-40`.

### `src/features/negociaciones/NegociacionesPage.tsx`
- Wrapper editor: `mt-8` → `mt-6`.

### `src/features/negociaciones/NegotiationCalculator.tsx`
- `<section className="space-y-3">` → `<section>` (sin space-y).
- Sticky KPIs: `top-14 z-10 -mx-1 px-1 pb-2 pt-3 bg-background/95` → `top-14 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-2 pb-3 bg-background/80`.
- Buscador: añadir `mt-4 mb-2` (ya tiene `mt-4 mb-1`, ajuste a `mb-2`); mantiene `z-20`.
- Tabla: sin cambios (ya está en flujo normal sin scroll interno).

## Verificación post-cambio

1. Scroll: el header global cubre los KPIs sticky al hacer scroll bajo el header.
2. Scroll: los KPIs sticky cubren el buscador y la tabla al pasar por encima.
3. Dropdown del buscador aparece sobre la tabla y sobre los KPIs (z-50).
4. Sin huecos laterales en el fondo del sticky superior.
5. Espaciado: KPIs—aire—buscador—tabla con jerarquía visual coherente.

## Archivos modificados

- `src/routes/_app.tsx`
- `src/features/negociaciones/NegociacionesPage.tsx`
- `src/features/negociaciones/NegotiationCalculator.tsx`

Sin cambios en lógica de negocio, queries, hooks ni en el PDF.
