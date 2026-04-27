## Resumen del diagnóstico

Tu hipótesis es **parcialmente correcta**: el "login" actual no es autenticación real, es solo un selector de usuario para auditoría (`{id, name}` en `sessionStorage`, lectura síncrona). El guard en sí es prácticamente gratis (~0.01 ms), pero **arrastra costos colaterales reales** que sí impactan la percepción de lentitud:

1. **`ssr: false` en `_app.tsx`** → toda el área protegida se renderiza 100% en el cliente. Esto retrasa el primer pintado.
2. **`AuthProvider` ejecuta `SELECT * FROM app_users` en cada montaje** aunque solo se use en `/login`.
3. **`AuthContext` re-renderiza** cualquier componente que use `useAuth()` (sidebar, layout, 5 páginas) cuando llega la lista de usuarios.
4. **Pantalla de login intermedia**: cada apertura nueva de pestaña obliga a pasar por `/login` antes de ver el dashboard.

## Decisión (basada en tus respuestas)

- **Eliminar** `/login`, `AuthContext`, `AuthProvider`, `lib/session.ts`.
- **Eliminar** el guard `beforeLoad` y el `ssr: false` de `_app.tsx`.
- **Mantener un selector ligero** en el footer del sidebar: dropdown con los usuarios de `app_users` para "firmar" lo que crees. Persiste en `sessionStorage` con la misma key actual (`tercol.activeUser`) para no perder la sesión actual de los usuarios.
- **Default**: si no hay usuario seleccionado, las creaciones se firman como `"Sistema"` (`created_by_name = "Sistema"`, `created_by_id = null`). La columna ya admite `null` en todas las tablas.

## Plan de implementación

### 1. Crear hook ligero `useCurrentUser`
Archivo nuevo `src/hooks/useCurrentUser.ts`:
- Lee/escribe `sessionStorage` directamente.
- Expone `{ user, setUser, clearUser }`.
- **Sin Provider, sin Context** → cero re-renders en cascada.
- Helpers `getCurrentUserForAudit()` que devuelve `{ id: user?.id ?? null, name: user?.name ?? "Sistema" }` para los inserts.

### 2. Crear `UserSwitcher` en el sidebar
Archivo nuevo `src/components/layout/UserSwitcher.tsx`:
- Dropdown pequeño en el footer del `AppSidebar` (reemplaza el bloque actual de avatar+logout).
- Carga los usuarios de `app_users` **bajo demanda** (al abrir el dropdown), no al montar la app.
- Permite seleccionar uno, crear uno nuevo ("Otros…"), o "Cerrar identidad" (vuelve a "Sistema").
- Usa `useCurrentUser` directamente.

### 3. Simplificar `_app.tsx`
- Quitar `ssr: false`.
- Quitar `beforeLoad` (ya no hay redirección a login).
- Quitar dependencia de `useAuth`; usar `useCurrentUser` solo para mostrar el nombre en el header (con fallback "Sistema").
- Mantener el resto del layout intacto.

### 4. Refactor de las páginas que usan `useAuth`
Reemplazar `const { user } = useAuth()` por `const { user } = useCurrentUser()` en:
- `src/features/listas-precios/ListasPreciosPage.tsx`
- `src/features/costos-productos/CostosProductosPage.tsx`
- `src/features/costos-operacionales/CostosOperacionalesPage.tsx`
- `src/features/negociaciones/NegociacionesPage.tsx`
- `src/features/analisis-ventas/UploadVentasDialog.tsx`

En todos los inserts cambiar:
```ts
created_by_id: user?.id ?? null,
created_by_name: user?.name ?? "Sistema",
```
Eliminar las guardas `if (!user) return null` que bloqueaban la página entera (ya no aplican).

### 5. Limpieza de archivos
Borrar:
- `src/contexts/AuthContext.tsx`
- `src/lib/session.ts` (la lógica útil queda absorbida en `useCurrentUser`)
- `src/routes/login.tsx`
- `src/routes/_app/index.tsx` (redirige a `/dashboard`; cambiamos a que `src/routes/_app.tsx` sea el layout y agregamos un `index.tsx` real, o redirigimos desde la raíz)

### 6. Ruta raíz
- Crear `src/routes/index.tsx` que redirija directo a `/dashboard` (en vez de pasar por `/login`).
- `__root.tsx`: quitar `<AuthProvider>`, dejar `<Outlet />` directo.

### 7. Base de datos
- **No tocar nada**. La tabla `app_users` se mantiene (el selector la sigue leyendo on-demand).
- Las columnas `created_by_id` ya son nullable, `created_by_name` acepta `"Sistema"`.

## Resultado esperado

| Antes | Después |
|---|---|
| Pantalla `/login` obligatoria al abrir pestaña | Entrada directa al dashboard |
| `ssr: false` en toda el área autenticada | SSR habilitado → primer pintado más rápido |
| `SELECT app_users` en cada montaje | Solo cuando abres el dropdown del switcher |
| Context global re-renderizando 5+ páginas | Hook local sin re-renders en cascada |
| ~7 archivos involucrados en auth | 2 archivos (`useCurrentUser` + `UserSwitcher`) |

## Riesgos

- **Ninguno funcional**: el flujo de creación sigue funcionando, solo cambia el origen del nombre.
- Quien tenga sesión guardada en `sessionStorage` sigue viéndose firmado igual (misma key).
- Si en el futuro quieres autenticación real, los hooks/columnas siguen ahí para conectarlos.