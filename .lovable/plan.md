

# Plan: rediseño visual (orden sidebar + destacar Calculadora + nueva paleta negro/gris/rojo)

Tres mejoras visuales coordinadas. Hago las tres en una sola pasada porque comparten archivos (`AppSidebar.tsx` y `styles.css`) y así evitamos repintar dos veces.

## 1. Reordenar sidebar: Negocios fijos arriba de Calculadora

En `src/components/layout/AppSidebar.tsx`, dentro del array `analisis`, mover `Negocios fijos` antes de `Calculadora`:

```ts
const analisis: NavItem[] = [
  { title: "Negocios fijos", to: "/negocios-fijos", icon: Briefcase },
  { title: "Calculadora", to: "/calculadora", icon: Calculator },
  { title: "Análisis de ventas", to: "/analisis-ventas", icon: TrendingUp },
  { title: "Historial", to: "/historial", icon: History },
];
```

## 2. Destacar "Calculadora" como opción estrella

La idea: que visualmente grite "esto es lo importante". Tratamiento especial dentro de `NavGroup` cuando `item.to === "/calculadora"`:

- **Fondo permanente con gradiente brand** (no solo en hover/active): `bg-gradient-brand` con opacidad sutil cuando no está activa, opacidad llena cuando sí.
- **Texto blanco siempre + ícono blanco**, peso `font-semibold`.
- **Halo/glow**: `shadow-elegant` permanente para que "flote" sobre las demás opciones.
- **Badge "Pro"** o ícono `Sparkles` pequeño a la derecha del label cuando el sidebar está expandido, para reforzar el mensaje de "esta es la magia".
- **Sin la barra lateral de active** (la barrita izquierda) — el tratamiento visual ya es suficientemente fuerte; la barra haría ruido.
- En estado colapsado: el botón de Calculadora mantiene el fondo gradiente (un cuadradito brillante entre íconos grises).

Implementación: añadir flag `featured?: boolean` al tipo `NavItem`, marcar `Calculadora` con `featured: true`, y dentro del render del item aplicar clases condicionales si `item.featured`.

## 3. Nueva paleta: negro, gris y rojo (identidad oscura/elegante)

Cambio completo de `src/styles.css`. Mantenemos la estructura (variables oklch, `@theme inline`, utilidades `.glass`, `.bg-gradient-brand`, etc.) — solo reasignamos valores.

### Paleta nueva (modo claro queda igualmente oscuro/grisáceo, no blanco puro)

Para que el look sea **negro/gris/rojo con identidad estética**, el `:root` ya no será fondo blanco. Lo convertimos a un esquema oscuro elegante por defecto (gris muy oscuro casi negro), con acentos en rojo. El `.dark` queda aún más profundo (negro puro).

Valores propuestos para `:root` (modo principal de la app):

```css
--background: oklch(0.14 0.005 270);        /* gris muy oscuro casi negro */
--foreground: oklch(0.96 0.003 270);        /* casi blanco */
--card: oklch(0.18 0.005 270);              /* gris oscuro elevado */
--card-foreground: oklch(0.96 0.003 270);
--popover: oklch(0.18 0.005 270);
--popover-foreground: oklch(0.96 0.003 270);
--primary: oklch(0.58 0.22 25);             /* rojo vibrante */
--primary-foreground: oklch(0.99 0 0);
--secondary: oklch(0.22 0.005 270);         /* gris medio oscuro */
--secondary-foreground: oklch(0.96 0.003 270);
--muted: oklch(0.20 0.004 270);
--muted-foreground: oklch(0.65 0.01 270);
--accent: oklch(0.24 0.006 270);
--accent-foreground: oklch(0.96 0.003 270);
--destructive: oklch(0.62 0.24 25);         /* rojo destructivo (mismo tono familia) */
--border: oklch(1 0 0 / 0.08);              /* borde sutil sobre fondo oscuro */
--input: oklch(1 0 0 / 0.10);
--ring: oklch(0.58 0.22 25);                /* rojo */

--sidebar: oklch(0.12 0.004 270 / 80%);     /* aún más oscuro que el bg, glassy */
--sidebar-foreground: oklch(0.92 0.003 270);
--sidebar-primary: oklch(0.58 0.22 25);
--sidebar-primary-foreground: oklch(0.99 0 0);
--sidebar-accent: oklch(0.22 0.005 270);
--sidebar-accent-foreground: oklch(0.96 0.003 270);
--sidebar-border: oklch(1 0 0 / 0.08);
--sidebar-ring: oklch(0.58 0.22 25);
```

### Brand gradients (reemplazan azul/púrpura/naranja)

```css
--brand-red: oklch(0.58 0.22 25);
--brand-red-deep: oklch(0.45 0.20 22);
--brand-charcoal: oklch(0.22 0.005 270);

--gradient-brand: linear-gradient(135deg,
  oklch(0.55 0.22 25) 0%,
  oklch(0.40 0.18 22) 55%,
  oklch(0.18 0.01 270) 100%);

--gradient-brand-soft: linear-gradient(135deg,
  oklch(0.58 0.22 25 / 0.18) 0%,
  oklch(0.45 0.18 22 / 0.10) 60%,
  oklch(0.20 0.005 270 / 0.05) 100%);

--gradient-text: linear-gradient(120deg,
  oklch(0.70 0.22 25) 0%,
  oklch(0.55 0.20 20) 50%,
  oklch(0.85 0.05 25) 100%);
```

### Glass + sombras (más dramáticas sobre fondo oscuro)

```css
--glass-bg: oklch(0.20 0.005 270 / 0.55);
--glass-border: oklch(1 0 0 / 0.08);
--shadow-glass:
  0 1px 0 0 oklch(1 0 0 / 0.05) inset,
  0 10px 40px -12px oklch(0 0 0 / 0.55),
  0 4px 16px -8px oklch(0 0 0 / 0.40);
--shadow-elegant: 0 20px 60px -20px oklch(0.55 0.22 25 / 0.35);  /* glow rojo */
--shadow-soft:
  0 1px 2px 0 oklch(0 0 0 / 0.20),
  0 4px 12px -4px oklch(0 0 0 / 0.30);
```

### `.dark` queda igual estructura pero aún más profundo (negro puro)

```css
.dark {
  --background: oklch(0.08 0.002 270);   /* casi negro puro */
  --card: oklch(0.13 0.004 270);
  --sidebar: oklch(0.10 0.003 270 / 85%);
  /* resto hereda del mismo lenguaje, con misma familia roja */
}
```

### Charts: actualizar a tonos rojo/gris/cobre

```css
--chart-1: oklch(0.62 0.22 25);    /* rojo principal */
--chart-2: oklch(0.45 0.15 25);    /* rojo oscuro */
--chart-3: oklch(0.75 0.10 30);    /* coral/salmón */
--chart-4: oklch(0.55 0.02 270);   /* gris medio */
--chart-5: oklch(0.35 0.01 270);   /* gris oscuro */
```

### Por qué este look funciona

- **Fondo casi negro** hace que los `.glass` cards (con `backdrop-filter: blur(12px)` y borde `oklch(1 0 0 / 0.08)`) parezcan flotar e iluminarse — exactamente lo que pediste de "que resalten más los glass".
- **Rojo como único color de acento** + escala de grises = identidad visual fuerte, premium, tipo Tesla / Stripe dashboard / Linear.
- El gradiente brand (rojo → carbón) se ve dramático en botones y en el ítem destacado de Calculadora.

## Archivos a tocar

1. **`src/styles.css`** — reemplazar bloques `:root`, `.dark` y los gradientes brand con la nueva paleta.
2. **`src/components/layout/AppSidebar.tsx`** — reordenar `analisis`, añadir `featured` flag, aplicar tratamiento visual especial para `/calculadora`.

## Resultado esperado

- Sidebar: orden Negocios fijos → Calculadora → Análisis de ventas → Historial.
- Calculadora se ve como un botón "premium" con fondo gradiente rojo-carbón permanente, ícono Sparkles a su lado, sombra con glow rojo. Imposible no verla.
- Toda la app pasa a un esquema oscuro elegante negro/gris con rojo como único acento. Glass cards resaltan mucho más por el contraste con el fondo oscuro. Sin rastro de azul/púrpura/naranja.
- Al final: te enseño y si quieres ajustamos saturación del rojo (más sangre vs más coral) o si prefieres modo claro grisáceo en lugar de oscuro casi negro.

