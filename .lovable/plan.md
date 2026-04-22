

# Diagnóstico: por qué aparece "Cargando…" tan seguido

## Causas

Hay **tres lugares** que muestran ese estado, cada uno con un disparador distinto:

### 1. El más visible — `_app.tsx` (gate de autenticación)
```tsx
if (!ready || !user) {
  return <div>Cargando…</div>;
}
```
Aunque `AuthContext` hidrata desde `localStorage` y marca `ready=true` rápido, este flash aparece **en cada recarga dura** (F5, abrir pestaña nueva, navegación directa por URL) durante el primer render del cliente. En SSR `localStorage` no existe, así que el servidor renderiza el árbol con `user=null`; al hidratar en el cliente lee localStorage y re-renderiza. Ese gap es el "Cargando…" que ves.

Además, si `localStorage` está vacío (otro navegador, modo incógnito, sesión limpia) el `useEffect` redirige a `/login` pero entre el render inicial y el `navigate` se alcanza a pintar el spinner.

### 2. `AnalisisVentasPage.tsx`
```tsx
{analytics.loading ? <>Cargando análisis…</> : ...}
```
El hook `useSalesAnalytics` arranca con `loading=true` y hace 3 fetches paginados en cascada (`sales`, `product_costs`, `operational_costs`). Cada vez que cambias el rango de fechas o el mes seleccionado vuelve a ponerse en `loading` y muestra el placeholder durante toda la consulta.

### 3. Páginas de listas/costos
`ListasPreciosPage`, `CostosProductosPage`, `CostosOperacionalesPage` muestran spinners propios mientras consultan Supabase al montar y al cambiar de mes.

## Resumen de por qué se siente "tan seguido"

- **Recargas y navegación directa**: flash del gate de auth (#1).
- **Cambiar mes/rango en análisis**: el dashboard entero se reemplaza por el spinner (#2).
- **Cambiar mes en costos/operacionales**: las tablas se vacían mientras llega la respuesta (#3).

Ninguno indica un fallo real — son estados de carga legítimos pero con UX brusca (todo el contenido desaparece y reaparece).

## Plan de mejoras

### A. Eliminar el flash del gate de auth (#1)
1. **Hidratar `user` de forma síncrona** en `useState` (lazy initializer) en vez de en `useEffect`. Así en el primer render del cliente ya hay `user` si existe en localStorage, sin pasar por el gate.
   ```tsx
   const [user, setUser] = useState<TercolUser | null>(() => {
     if (typeof window === "undefined") return null;
     try {
       const raw = localStorage.getItem(STORAGE_KEY);
       return raw ? JSON.parse(raw) : null;
     } catch { return null; }
   });
   const [ready, setReady] = useState(typeof window !== "undefined");
   ```
2. **Redirigir a `/login` en `beforeLoad`** del route layout `_app` en vez de en un `useEffect`, para que el primer render ya sepa si hay sesión y no muestre el spinner.
3. **Quitar el spinner por completo del `_app.tsx`** una vez la hidratación es síncrona — si no hay user, redirige; si hay, renderiza directo.

### B. Carga no destructiva en `/analisis-ventas` (#2)
1. **Mantener visible el dashboard anterior** mientras llegan datos nuevos (patrón "stale while revalidating"): no reemplazar todo por el spinner cuando `loading=true` y ya hay `salesRows` cacheados.
2. **Indicador sutil**: una barra de progreso fina arriba del header de filtros (animada) en vez de pantalla en blanco.
3. **Sólo mostrar el spinner grande la primera vez** (cuando `salesRows.length === 0 && loading`).
4. **Debounce** del cambio de rango de fechas (300ms) para evitar reconsultas en cascada al ajustar dos fechas seguidas.

### C. Carga no destructiva en costos/listas (#3)
- Mismo patrón: si ya hay datos del mes anterior visibles, dejarlos atenuados (`opacity-60`) con un spinner pequeño en el header en vez de vaciar la tabla.

### D. Opcional pero recomendado
- Migrar los fetches del dashboard a **TanStack Query** (`useQuery` con `placeholderData: keepPreviousData`) para que el cache + transición suave funcionen "gratis" sin escribir lógica manual de `previousData`. El proyecto ya tiene la dependencia y `QueryClientProvider` se monta en el root sin tocar nada más en componentes ya escritos.

## Entregables

1. `AuthContext.tsx`: hidratación síncrona de `user` con lazy `useState`.
2. `_app.tsx`: eliminar el bloque `if (!ready || !user) Cargando…` y mover el guard a `beforeLoad` de la ruta.
3. `AnalisisVentasPage.tsx`: spinner solo en la carga inicial; barra de progreso superior durante recargas; debounce del `DateRangePicker`.
4. `useSalesAnalytics.ts`: no resetear `salesRows` mientras llegan los nuevos (mantener `setSalesRows` solo al éxito).
5. (Opcional) Refactor de los hooks de fetch a TanStack Query con `keepPreviousData`.

Confirma si quieres que aplique solo los puntos 1–4 (rápidos y conservadores) o que incluya también el #5 (refactor más ambicioso pero más limpio a futuro).

