

# Plan: revertir a fondo blanco manteniendo identidad rojo/gris

Mantenemos la nueva identidad de rojo + grises + glass dramático, pero invertimos la base: fondo blanco/claro en lugar de oscuro. Look más limpio tipo Notion/Linear claro con acentos rojos.

## Cambios en `src/styles.css`

### `:root` (modo principal claro)

```css
--background: oklch(0.99 0.002 270);        /* blanco casi puro con tinte gris */
--foreground: oklch(0.18 0.005 270);        /* gris muy oscuro casi negro */
--card: oklch(1 0 0);                       /* blanco puro para cards */
--card-foreground: oklch(0.18 0.005 270);
--popover: oklch(1 0 0);
--popover-foreground: oklch(0.18 0.005 270);
--primary: oklch(0.55 0.22 25);             /* rojo vibrante (mismo) */
--primary-foreground: oklch(0.99 0 0);
--secondary: oklch(0.96 0.003 270);         /* gris muy claro */
--secondary-foreground: oklch(0.22 0.005 270);
--muted: oklch(0.97 0.003 270);
--muted-foreground: oklch(0.50 0.01 270);
--accent: oklch(0.96 0.003 270);
--accent-foreground: oklch(0.22 0.005 270);
--destructive: oklch(0.58 0.24 25);
--border: oklch(0.18 0.005 270 / 0.10);     /* borde gris sutil */
--input: oklch(0.18 0.005 270 / 0.12);
--ring: oklch(0.55 0.22 25);

--sidebar: oklch(0.985 0.002 270 / 85%);    /* casi blanco glassy */
--sidebar-foreground: oklch(0.22 0.005 270);
--sidebar-primary: oklch(0.55 0.22 25);
--sidebar-primary-foreground: oklch(0.99 0 0);
--sidebar-accent: oklch(0.96 0.003 270);
--sidebar-accent-foreground: oklch(0.22 0.005 270);
--sidebar-border: oklch(0.18 0.005 270 / 0.08);
--sidebar-ring: oklch(0.55 0.22 25);
```

### Charts (más saturados sobre fondo claro)

```css
--chart-1: oklch(0.58 0.22 25);   /* rojo principal */
--chart-2: oklch(0.42 0.18 22);   /* rojo oscuro */
--chart-3: oklch(0.70 0.15 30);   /* coral */
--chart-4: oklch(0.55 0.02 270);  /* gris medio */
--chart-5: oklch(0.30 0.01 270);  /* gris oscuro */
```

### Brand gradients (ajustados para fondo claro)

Mantener el gradiente rojo-carbón intacto: sigue funcionando perfecto sobre blanco para botones y el ítem destacado de Calculadora. Sin cambios necesarios en `--gradient-brand`, `--gradient-brand-soft`, `--gradient-text`.

### Glass + sombras (recalibrados para base clara)

```css
--glass-bg: oklch(1 0 0 / 0.65);                          /* blanco translúcido */
--glass-border: oklch(0.18 0.005 270 / 0.08);             /* borde gris sutil */
--shadow-glass:
  0 1px 0 0 oklch(1 0 0 / 0.80) inset,
  0 10px 40px -12px oklch(0.18 0.005 270 / 0.15),
  0 4px 16px -8px oklch(0.18 0.005 270 / 0.10);
--shadow-elegant: 0 20px 60px -20px oklch(0.55 0.22 25 / 0.30);  /* glow rojo se mantiene */
--shadow-soft:
  0 1px 2px 0 oklch(0.18 0.005 270 / 0.06),
  0 4px 12px -4px oklch(0.18 0.005 270 / 0.10);
```

### `.dark` (opcional, queda como estaba en la versión oscura por si el usuario alterna)

Mantener los valores oscuros actuales del `.dark` block para que quien tenga `class="dark"` vea el modo oscuro.

## Sin cambios en

- `AppSidebar.tsx` — el orden Negocios fijos → Calculadora → Análisis → Historial y el tratamiento "featured" de Calculadora con `bg-gradient-brand + Sparkles + shadow-elegant` se mantienen. El gradiente rojo-carbón se ve incluso mejor sobre sidebar blanco.

## Resultado esperado

- Fondo blanco limpio con tinte gris muy sutil, tipo Linear/Notion claro.
- Cards blancos puros con sombras suaves grises (no negras pesadas).
- Sidebar casi blanco con glass effect; ítem de Calculadora resalta como un botón rojo dramático sobre el blanco.
- Texto en gris muy oscuro casi negro (no negro puro, más elegante).
- Acentos rojos visibles y vibrantes en botones primarios, badges, gráficos.
- Bordes muy sutiles (8-10% de opacidad) para no ensuciar el look limpio.

## Archivos a tocar

1. `src/styles.css` — reemplazar bloque `:root`, ajustar `--glass-*` y `--shadow-*`. Charts actualizados. `.dark` y gradientes brand sin cambio.

