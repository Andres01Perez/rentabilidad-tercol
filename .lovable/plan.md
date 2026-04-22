
# Plan: Optimización + Vistas funcionales (Listas, Costos, Costos Operacionales)

## Parte 1 — Optimización de rendimiento

### Causas detectadas

1. **Doble carga de Montserrat**: la fuente se importa tanto en `__root.tsx` (link) como en `styles.css` (`@import url`). El `@import` en CSS bloquea el render hasta resolver Google Fonts.
2. **3 orbes con `blur-3xl`** en login + 2 en `_app` + 1 en cada placeholder. Cada blur es muy costoso de pintar (especialmente en zonas grandes 32rem+).
3. **Glass excesivo**: `backdrop-filter: blur(20px) saturate(160%)` aplicado en sidebar, header, cards, y elementos pequeños — el `backdrop-filter` se reevalúa en cada scroll.
4. **`AuthProvider` bloquea el render** hasta que Supabase responde con `app_users`. Por eso `/login` y `/dashboard` tardan visiblemente al inicio.
5. **`AppSidebar` re-renderiza completo** en cada cambio de ruta (lee `useLocation`), recreando los 9 items.
6. **No hay preload** de rutas. Cada navegación descarga el chunk al hacer click.

### Cambios de optimización

1. **Fuente única**: eliminar `@import url(...)` de `styles.css`. Mantener solo el `<link>` en `__root.tsx` con `preconnect` (ya está). Reduce un round-trip bloqueante.
2. **Reducir orbes**: dejar 1–2 orbes por vista (no 3) y reducir tamaño a 24rem máx. Quitar orbe de `PagePlaceholder` (el del `_app` ya cubre el fondo).
3. **Glass más barato**: bajar blur de 20px → 12px y quitar `saturate(160%)`. Usar `will-change: auto` (no `transform`) para no promover capas innecesarias.
4. **Auth no bloqueante**:
   - Hidratar `user` desde `localStorage` inmediatamente (sin esperar Supabase).
   - Marcar `ready=true` apenas se lee `localStorage`.
   - Cargar `appUsers` en background (solo necesario para `/login`).
   - El guard de `_app.tsx` ya no espera la BD para mostrar el dashboard.
5. **Preload `intent`** en el router (`defaultPreload: "intent"`, `defaultPreloadDelay: 50`). Al hacer hover sobre un item del sidebar, el chunk de la vista se descarga antes del click.
6. **Memoizar `AppSidebar`**: extraer `NavGroup` con `React.memo` y mover los arrays `operacion/analisis/sistema` fuera (ya lo están). Pasar solo `isActive` calculado para que items inactivos no re-rendericen.
7. **`defaultPreloadStaleTime`**: subir a `30_000` para que el cache de preload no se invalide instantáneamente.

### Impacto esperado
- Login: render inmediato (no espera BD).
- Navegación entre vistas: cuasi-instantánea con `preload: "intent"`.
- Pintado: menos repaints por blurs.

---

## Parte 2 — Vistas funcionales

### 2.1 `/listas-precios`

**Layout**: header con botón "Nueva lista" + tabla de listas existentes.

**Listado** (tabla principal):
- Columnas: Nombre, Items, Creada por, Última actualización, Actualizada por, Acciones (Ver / Reemplazar Excel / Eliminar).
- Click en una fila abre un panel/sheet lateral con los items (REFERENCIA, DESCRIPCIÓN, UNIDAD EMPAQUE, PRECIO) en tabla scrollable con buscador.

**Crear lista** (dialog):
1. Input "Nombre de la lista" (obligatorio).
2. Zona drag & drop de Excel (`.xlsx`, `.xls`).
3. Al soltar el archivo, parseo en cliente con **`xlsx`** (SheetJS).
4. Mapeo de columnas tolerante a mayúsculas/acentos: `REFERENCIA`, `DESCRIPCIÓN`, `UNIDAD DE EMPAQUE`, `LISTA DE PRECIOS`.
5. Vista previa con primeras 5 filas + total detectado + warnings (filas sin REF o sin precio se descartan).
6. Botón "Crear lista" → INSERT en `price_lists` + INSERT batch en `price_list_items` (chunks de 500).

**Reemplazar Excel** (en lista existente):
- Mismo flujo de drag & drop, sin pedir nombre.
- Modal de confirmación: "Esto borrará las N filas actuales. ¿Continuar?".
- DELETE de `price_list_items` por `price_list_id` + INSERT nuevos + UPDATE en cabecera (`updated_by_*`, `updated_at`).

### 2.2 `/costos-productos`

**Layout**: header con selector de mes + botón "Subir Excel del mes" + tabla.

**Selector de mes**: dropdown con meses (formato "Abril 2026") — por defecto el mes actual. Al cambiar, la tabla recarga los costos de ese mes.

**Tabla**: muestra todas las columnas del Excel (GRUPO, REF, DESCRIPCION, CANT, CUMAT, CUMO, CUNAGO, CTMAT, CTMO, CTSIT, %PART, CIFU, MOU, CTU, CT, PUV, PRECIOTOT, %CTO).
- Tabla con scroll horizontal, sticky header, formato numérico (es-CO).
- Buscador por REF o DESCRIPCION.
- Estado vacío con CTA "Subir Excel del mes".

**Subir Excel** (dialog):
1. Selector de mes (pre-seleccionado el actual).
2. Drag & drop de Excel.
3. Parseo en cliente con `xlsx`, mapeo tolerante de las 18 columnas.
4. **Pre-check**: consulta a BD si ya hay filas para ese `period_month`.
   - Si existen → modal de confirmación: "Ya hay 234 productos para Abril 2026. ¿Sobrescribir?".
   - Si confirma → DELETE por `period_month` + INSERT batch.
5. Vista previa de primeras filas + warnings antes de confirmar.

### 2.3 `/costos-operacionales`

**Layout**: tabs internos.

**Tab 1: "Asignaciones"**:
- Selector de mes en el header.
- Tabla: Centro de costos | % del mes seleccionado | Última actualización | Actualizado por | Acción (editar).
- Botón "Asignar centro" → dialog: select del centro + input de % + auto-rellena el % del mes anterior si existe (sugerencia editable).
- Editar fila → UPDATE sobre `(cost_center_id, period_month)` con `updated_by_*`.

**Tab 2: "Centros de costos" (CRUD)**:
- Lista de centros (`cost_centers`) con badge activo/inactivo.
- Botón "Nuevo centro" → input nombre + INSERT.
- Acciones: renombrar, activar/desactivar (no DELETE para preservar histórico).

### 2.4 Helpers compartidos

- `src/lib/excel.ts`: función `parseExcel(file, columnMap)` que devuelve `{ rows, warnings }` usando `xlsx`.
- `src/lib/period.ts`: helpers `monthToDate(year, month) → "YYYY-MM-01"`, `formatMonth("YYYY-MM-01") → "Abril 2026"`, lista de los últimos 24 meses para el selector.
- `src/components/excel/Dropzone.tsx`: zona drag & drop reutilizable (sin librería extra, drag events nativos).
- `src/components/period/MonthSelect.tsx`: selector de mes basado en shadcn `Select`.

### 2.5 Dependencia nueva

- `xlsx` (SheetJS) — solo para parseo en navegador (no requiere FS).

### 2.6 Trazabilidad

Cada INSERT/UPDATE incluye:
- `created_by_id` / `updated_by_id` = `auth.user.id` (del `AuthContext`).
- `created_by_name` / `updated_by_name` = snapshot de `auth.user.name`.

---

## Entregables

1. Optimizaciones de fuente, glass, orbes, AuthProvider, preload del router y memo en sidebar.
2. `/listas-precios`: listado + crear lista + ver items + reemplazar Excel.
3. `/costos-productos`: selector de mes + tabla + subir Excel con confirmación de sobreescritura.
4. `/costos-operacionales`: tabs con asignaciones mensuales + CRUD de centros.
5. Helpers `excel.ts`, `period.ts`, componentes `Dropzone`, `MonthSelect`.
6. Dependencia `xlsx` agregada.
