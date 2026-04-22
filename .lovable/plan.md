
# Plataforma Tercol — Setup inicial (layout + navegación)

Construiré la base de la plataforma con login simulado, sidebar persistente y las 10 rutas listas como placeholders. Foco en una identidad visual fuerte, minimal y "Apple-like".

## Identidad visual

- **Tipografía**: Montserrat de Google Fonts (cargada vía `<link>` en `__root.tsx`), pesos 300/400/500/600/700/800.
- **Paleta base**: blanco, negros y grises (escala neutra fina).
- **Acentos en gradiente**: púrpura → azul → naranja, usados en:
  - Logo/wordmark "Tercol" con gradient text.
  - Blobs difuminados de fondo (orbes con `blur-3xl`) en login y dashboard.
  - Botones primarios y estados activos del sidebar.
- **Glassmorphism**: tarjetas y sidebar con `backdrop-blur`, bordes 1px translúcidos, sombras suaves multicapa.
- **Mockups visuales** en placeholders: cada vista tendrá un hero con ícono grande, título, descripción y "preview cards" decorativas para que no se vea vacía.
- Tema claro fijo (no dark mode por ahora).

## Autenticación simulada

- `/login`: pantalla centrada con fondo de orbes degradados, card glass con:
  - Logo "Tercol" con gradiente.
  - Selector (Select de shadcn) con: **Cesar Cuartas, Andres Perez, Otros**.
  - Botón "Ingresar" con gradiente.
- Al ingresar, se guarda el usuario seleccionado en `localStorage` + Context (`AuthProvider`) para trazabilidad futura.
- Guard de rutas: layout `_app` que redirige a `/login` si no hay usuario seleccionado.
- `/login` redirige a `/dashboard` si ya hay sesión.

## Estructura de rutas (TanStack Router)

```
src/routes/
  __root.tsx              → shell + Montserrat + AuthProvider
  login.tsx               → selector de usuario
  _app.tsx                → layout protegido con SidebarProvider + sidebar + topbar
  _app/dashboard.tsx
  _app/listas-precios.tsx
  _app/costos-productos.tsx
  _app/costos-operacionales.tsx
  _app/calculadora.tsx
  _app/negocios-fijos.tsx
  _app/analisis-ventas.tsx
  _app/historial.tsx
  _app/configuraciones.tsx
```

Cada ruta protegida tendrá su propio `head()` con title y description únicos.

## Layout principal (`_app.tsx`)

- **Sidebar** (shadcn `Sidebar`, `collapsible="icon"`):
  - Header: logo "Tercol" con gradiente + nombre.
  - Grupo "Operación": Dashboard, Listas de precios, Costos, Costos operacionales.
  - Grupo "Análisis": Calculadora, Negocios fijos, Análisis de ventas, Historial.
  - Grupo "Sistema": Configuraciones.
  - Cada item con ícono Lucide + estado activo con fondo gradiente sutil.
  - Footer del sidebar: avatar + nombre del usuario logueado + botón logout.
- **Topbar**: `SidebarTrigger` siempre visible, breadcrumb de la ruta actual, badge con el usuario activo.
- **Fondo**: blanco con orbe degradado fijo decorativo en esquina superior derecha.

## Vistas placeholder (las 10)

Cada una con la misma estructura elegante:
- Hero con título grande (Montserrat 700), subtítulo gris, ícono en card glass con gradiente.
- 2–3 "skeleton cards" decorativas que insinúan el contenido futuro (tabla, gráfico, formulario, etc.) sin lógica real.
- Badge "Próximamente" o "En construcción" según corresponda.

Esto deja todo listo para conectar el schema de base de datos cuando lo entregues, sin tener que rehacer navegación ni layout.

## Entregables de esta iteración

1. Fuente Montserrat + tokens de diseño (gradientes, glass, sombras) en `styles.css`.
2. `AuthProvider` + `localStorage` para usuario simulado.
3. `/login` funcional con selector.
4. Layout `_app` protegido con sidebar + topbar.
5. 10 rutas creadas con placeholders elegantes y metadata propia.
6. Logout funcional desde el sidebar.
