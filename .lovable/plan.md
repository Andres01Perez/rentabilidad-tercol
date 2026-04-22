
Objetivo: cerrar de forma definitiva el error de `/analisis-ventas` y dejar la sesión/carga en un estado estable, sin volver a gastar créditos en el mismo problema.

## Qué está pasando realmente

El error que ves ahora no es “la ruta no existe” en el sentido de navegación. La ruta sí está registrada en `routeTree.gen.ts` y el archivo `src/routes/_app/analisis-ventas.tsx` existe.

El fallo actual es otro: el navegador intenta cargar el módulo lazy de esa ruta y el archivo dinámico no se está sirviendo correctamente (`Failed to fetch dynamically imported module`). Eso significa que quedó un problema en la capa de code-splitting/carga del chunk de esa vista, separado del problema anterior de sesión/hydration.

En otras palabras:
1. El problema de sesión/hydration y re-montado del árbol era real.
2. Pero `/analisis-ventas` todavía tiene un problema propio de carga lazy del módulo.

## Plan de corrección

### 1) Hacer `/analisis-ventas` manualmente lazy y dejar de depender del split automático de ese archivo
Cambiar la arquitectura de esa ruta para que quede así:

- `src/routes/_app/analisis-ventas.tsx`:
  - solo configuración crítica de la ruta (`createFileRoute`, `head`, y si hace falta `pendingComponent`)
  - sin importar directamente `AnalisisVentasPage`

- `src/routes/_app/analisis-ventas.lazy.tsx`:
  - `createLazyFileRoute("/_app/analisis-ventas")`
  - ahí vive el `component`
  - opcionalmente `errorComponent` específico con mensaje claro y botón de retry

Esto cambia por completo el asset/chunk que el navegador intenta cargar y elimina el patrón actual `?tsr-split=component` sobre el archivo principal de la ruta, que es justamente lo que está fallando.

### 2) Aislar el origen exacto del fallo del chunk
Antes de volver a dejar la vista completa, rehacer la carga en dos pasos:

1. Confirmar que la ruta lazy abre con un componente mínimo (“Análisis de ventas” + contenedor simple).
2. Reintroducir progresivamente:
   - `PageHeader`
   - filtros (`DateRangePicker`, `MonthSelect`)
   - upload (`UploadVentasDialog`)
   - tablas
   - gráficos `recharts`

Así se identifica si el problema está en:
- la ruta lazy en sí
- un import del feature
- `recharts`
- `DateRangePicker` / `react-day-picker`
- `UploadVentasDialog`
- algún import indirecto

### 3) Blindar la sesión para que no vuelva a parecer “rota”
Mantener el enfoque de `ssr: false` en `_app`, pero endurecer la validación:

- en `beforeLoad` de `src/routes/_app.tsx`, no solo revisar si existe el string en localStorage, sino parsearlo y validar que tenga `id` y `name`
- si el JSON está corrupto, limpiar la storage key y redirigir a `/login`
- en `AppLayout`, no dejar `return null` como salida silenciosa si el storage está inválido; debe redirigir o recuperarse de forma explícita

Esto evita estados fantasma donde:
- `beforeLoad` cree que hay sesión
- pero `AuthContext` no pueda hidratar el usuario
- y el layout quede en blanco o inestable

### 4) Unificar la lógica de sesión entre guard y contexto
Ahora mismo hay dos lecturas separadas de localStorage:
- una en `_app.tsx`
- otra en `AuthContext.tsx`

La corrección será:
- extraer una sola función compartida de lectura/validación de sesión
- usar exactamente esa misma función en el guard y en el contexto

Así evitamos divergencias del tipo:
- el guard acepta algo que el contexto rechaza
- o el contexto cree que no hay usuario mientras la ruta ya dejó pasar

### 5) Endurecer la navegación a `/login`
Ajustar `src/routes/login.tsx` para que:
- si ya hay usuario válido, redirija de forma temprana y consistente
- no dependa solo de un `useEffect` posterior al render
- use navegación de reemplazo cuando aplique, para evitar historiales raros y sensaciones de “rebote” o cache roto

### 6) Dejar `/analisis-ventas` con fallback útil, no con caída global
Agregar un `errorComponent` específico a esa ruta lazy para que, si vuelve a fallar algún import interno, no caiga toda la experiencia con el error global genérico.

Ese fallback debe:
- explicar que falló la carga del módulo de análisis
- ofrecer “Reintentar”
- ofrecer “Volver al dashboard”
- mostrar detalle técnico solo en desarrollo

### 7) Verificación final
Después de aplicar la corrección, validar estos escenarios:

1. Recarga dura en `/dashboard`
2. Navegación sidebar → `/analisis-ventas`
3. Recarga dura directa en `/analisis-ventas`
4. Volver a otra vista y regresar
5. Abrir `UploadVentasDialog`
6. Cambiar rango y meses
7. Confirmar que ya no aparece:
   - `Failed to fetch dynamically imported module`
   - pantalla vacía por sesión inválida
   - flashes repetidos de carga por re-montado

## Archivos a tocar

- `src/routes/_app.tsx`
- `src/contexts/AuthContext.tsx`
- `src/routes/login.tsx`
- `src/routes/_app/analisis-ventas.tsx`
- `src/routes/_app/analisis-ventas.lazy.tsx` (nuevo)
- posiblemente `src/features/analisis-ventas/AnalisisVentasPage.tsx` si hay que aislar imports problemáticos
- opcionalmente un helper compartido para leer la sesión almacenada

## Resultado esperado

- sesión consistente y validada de forma única
- sin estados raros de persistencia/caché
- `/analisis-ventas` vuelve a existir y abrir correctamente
- sin error de módulo dinámico
- navegación más confiable entre vistas
- si algo falla otra vez en esa vista, quedará contenido en un fallback local y no en una caída global
