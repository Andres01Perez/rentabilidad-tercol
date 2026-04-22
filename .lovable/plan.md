
# Esquema de base de datos — Tercol (Iteración 1)

Voy a crear el esqueleto en Supabase para las tres secciones (Listas de precios, Costos de producto, Costos operacionales) más una tabla de usuarios de la app para reemplazar el selector hardcodeado.

## Tablas a crear

### 1. `app_users` — Usuarios de la plataforma
Reemplaza la lista fija (Cesar, Andres, Otros) con un catálogo dinámico que se llena desde el flujo "Otros".

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text UNIQUE NOT NULL | Nombre visible |
| `is_default` | boolean default false | true para Cesar y Andres (semilla) |
| `created_at`, `updated_at` | timestamptz | Defaults `now()` |

**Seed inicial**: Cesar Cuartas, Andres Perez (con `is_default = true`).

El selector del login leerá de aquí. Cuando alguien elige "Otros" e ingresa un nombre nuevo, se inserta una fila y queda disponible en el login en futuras sesiones.

---

### 2. `price_lists` — Cabecera de cada lista de precios

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | Nombre que pone el usuario antes de subir |
| `created_by_id` | uuid FK → app_users(id) | Quién la subió |
| `created_by_name` | text NOT NULL | Snapshot del nombre |
| `updated_by_id` | uuid FK → app_users(id) NULL | Quién la reemplazó |
| `updated_by_name` | text NULL | Snapshot |
| `created_at`, `updated_at` | timestamptz | |

### 3. `price_list_items` — Filas de la lista
Una fila por producto dentro de la lista (columnas del Excel).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `price_list_id` | uuid FK → price_lists(id) ON DELETE CASCADE | |
| `referencia` | text NOT NULL | |
| `descripcion` | text | |
| `unidad_empaque` | text | |
| `precio` | numeric(14,2) | Columna "LISTA DE PRECIOS" del Excel |
| `created_at` | timestamptz | |

Índice: `(price_list_id, referencia)`.

**Comportamiento al re-subir**: borrar todas las filas de esa `price_list_id` e insertar las nuevas, actualizando `updated_by_*` y `updated_at` en la cabecera.

---

### 4. `product_costs` — Costos mensuales por producto

Cada fila = un producto en un mes específico. Las 18 columnas del Excel se guardan como columnas reales (no JSON) para poder cruzarlas en análisis después.

| Columna | Tipo |
|---|---|
| `id` | uuid PK |
| `period_month` | date NOT NULL (siempre primer día del mes, ej. 2026-04-01) |
| `grupo` | text |
| `referencia` | text NOT NULL |
| `descripcion` | text |
| `cant` | numeric(14,4) |
| `cumat`, `cumo`, `cunago` | numeric(14,4) |
| `ctmat`, `ctmo`, `ctsit` | numeric(14,4) |
| `pct_part` | numeric(8,4) |
| `cifu`, `mou`, `ctu`, `ct` | numeric(14,4) |
| `puv`, `preciotot` | numeric(14,2) |
| `pct_cto` | numeric(8,4) |
| `created_by_id`, `created_by_name` | uuid + text |
| `updated_by_id`, `updated_by_name` | uuid + text NULL |
| `created_at`, `updated_at` | timestamptz |

**Constraint UNIQUE** `(period_month, referencia)` — garantiza una sola fila por producto por mes.

**Comportamiento al subir**:
1. El frontend selecciona el mes y consulta si ya existen filas para ese `period_month`.
2. Si existen → modal de confirmación "Ya hay datos para Abril 2026, ¿sobrescribir?".
3. Al confirmar → borrar filas del mes e insertar las nuevas en transacción, dejando `updated_by_*` con quien sobrescribió.

---

### 5. `cost_centers` — Catálogo CRUD de centros de costos

| Columna | Tipo |
|---|---|
| `id` | uuid PK |
| `name` | text UNIQUE NOT NULL |
| `is_active` | boolean default true |
| `created_by_id`, `created_by_name` | |
| `created_at`, `updated_at` | timestamptz |

CRUD completo (crear, listar, renombrar, desactivar).

### 6. `operational_costs` — % por centro de costos por mes

| Columna | Tipo |
|---|---|
| `id` | uuid PK |
| `cost_center_id` | uuid FK → cost_centers(id) |
| `period_month` | date NOT NULL |
| `percentage` | numeric(7,4) NOT NULL (0–100) |
| `created_by_id`, `created_by_name` | |
| `updated_by_id`, `updated_by_name` | NULL |
| `created_at`, `updated_at` | timestamptz |

**Constraint UNIQUE** `(cost_center_id, period_month)` — un centro tiene un único % por mes; al "actualizar" se hace UPDATE sobre la fila existente.

---

## Triggers

Trigger genérico `set_updated_at()` que actualiza `updated_at = now()` en cada UPDATE, aplicado a las 6 tablas.

## RLS — Seguridad

Como todavía **no hay autenticación real de Supabase** (solo selector simulado), las queries del frontend usan la `anon key`. Para que la app funcione hoy:

- RLS habilitada en las 6 tablas.
- Políticas permisivas para `anon`: SELECT, INSERT, UPDATE, DELETE.

**Aviso explícito**: esto deja la BD abierta. Es aceptable para esta etapa interna porque la app es de uso interno y aún no implementamos auth real, pero **antes de exponer la app a producción real debemos migrar a Supabase Auth y reemplazar las políticas por unas basadas en `auth.uid()` y la tabla `user_roles`**. Lo dejaré documentado en el código.

## Cambios en frontend (mínimos en esta iteración)

Solo lo necesario para que el nuevo flujo de usuarios funcione — el resto de la UI de carga (drag & drop, selector de mes, CRUD de centros) se hará en iteraciones siguientes una vez aprobado el esquema.

1. **`AuthContext`**: dejar de leer la lista hardcodeada; cargar `app_users` desde Supabase al iniciar.
2. **`/login`**:
   - Selector poblado con `app_users` (siempre incluye "Otros" como opción especial al final).
   - Si elige "Otros" → input para nombre nuevo + botón "Ingresar" que hace `INSERT` en `app_users` y luego inicia sesión con ese usuario.
   - Guardar `{ id, name }` en `localStorage` (no solo el nombre) para usar el `id` como `created_by_id` en futuras inserciones.

## Resumen de entregables

1. Migración SQL con las 6 tablas, índices, constraints, trigger `set_updated_at` y RLS abierta para `anon` (con comentario de seguridad).
2. Seed de `app_users` con Cesar Cuartas y Andres Perez.
3. Refactor de `AuthContext` y `/login` para usar `app_users` real.

Las pantallas de carga (drag & drop de Excel, selector de mes, CRUD de centros, vistas de listado) las construimos en la siguiente iteración una vez el esquema esté en BD.
