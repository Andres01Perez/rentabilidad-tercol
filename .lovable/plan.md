

# Plan: agrupar columnas colapsables en la tabla de costos

## Cambio

Agrupar dos bloques de columnas en la tabla de `/costos-productos` con un control `+ / −` en el encabezado para expandir/colapsar. Por defecto, ambos grupos quedan **colapsados** para que la tabla quepa cómoda.

### Grupos

- **Costos unitarios (CU)** → `CUMAT`, `CUMO`, `CUNAGO`
- **Costos totales (CT desglose)** → `CTMAT`, `CTMO`, `CTSIT`

### Siempre visibles

`GRUPO`, `REF`, `DESCRIPCIÓN`, `CANT`, `%PART`, `CIFU`, `MOU`, `CTU`, `CT`, `PUV`, `PRECIOTOT`, `%CTO`.

## UX

- En la fila de encabezados, donde antes estaban las 3 columnas del grupo, aparece **una sola celda** con el nombre del grupo (`CU` / `CT desglose`) y un botón pequeño con `+` (colapsado) o `−` (expandido).
- Al hacer clic en `+`, esa celda se reemplaza por las 3 columnas del grupo y aparece un `−` en la última de ellas (o en una celda compacta al inicio del grupo) para volver a colapsar.
- Las celdas del cuerpo respetan el estado: cuando el grupo está colapsado, en su lugar se muestra una celda con `…` muteada (sin valores numéricos) para mantener la tabla alineada y dar pista visual de que hay datos ocultos.
- Estado se guarda en `React.useState` local (no persiste). Sin animaciones complejas — solo cambio inmediato del layout.

```text
Colapsado:
| GRUPO | REF | DESC | CANT | [+ CU] | [+ CT desglose] | %PART | CIFU | ... |
|       |     |      |  10  |   …    |       …         |   …   |  …   |     |

Expandido CU:
| GRUPO | REF | DESC | CANT | CUMAT | CUMO | CUNAGO [−] | [+ CT desglose] | %PART | ... |
```

## Implementación técnica

### `src/features/costos-productos/CostosProductosPage.tsx`

1. Reestructurar `COLUMNS` como una lista de **secciones**:
   ```ts
   type Section =
     | { kind: "cols"; cols: ColDef[] }
     | { kind: "group"; id: "cu" | "ct"; label: string; cols: ColDef[] };
   ```
   Orden:
   - cols: `grupo`, `referencia`, `descripcion`, `cant`
   - group `cu`: `cumat`, `cumo`, `cunago`
   - cols: (nada entre medio)
   - group `ct`: `ctmat`, `ctmo`, `ctsit`
   - cols: `pct_part`, `cifu`, `mou`, `ctu`, `ct`, `puv`, `preciotot`, `pct_cto`

2. Estado: `const [expanded, setExpanded] = useState<{cu: boolean; ct: boolean}>({cu: false, ct: false})`.

3. Render del `<TableHeader>`: iterar `SECTIONS` y para cada `group` colapsado mostrar **un solo `<TableHead>`** con un `<Button variant="ghost" size="sm">` (`+ CU` / `+ CT desglose`). Para cada `group` expandido, mostrar todas sus columnas; en la última añadir un mini botón `−` para colapsar de nuevo.

4. Render del `<TableBody>`: para cada fila, iterar las mismas secciones. Si el grupo está colapsado, renderizar una celda con `<span className="text-muted-foreground">…</span>`. Si está expandido, renderizar las celdas normales.

5. Calcular `colSpan` total dinámicamente para los estados de "loading" y "vacío":
   ```ts
   const visibleColCount = SECTIONS.reduce((n, s) =>
     n + (s.kind === "cols" || expanded[s.id] ? s.cols.length : 1), 0);
   ```

6. Iconos: usar `ChevronRight` (colapsado) y `ChevronDown` (expandido) de `lucide-react` junto al label del grupo, en lugar de `+` / `−`, para look consistente con el resto del proyecto.

## Archivos a tocar

- `src/features/costos-productos/CostosProductosPage.tsx` — refactor de `COLUMNS` a secciones + estado de expansión + render condicional en header y body.

## Resultado

- Tabla por defecto compacta y legible en 1280px sin scroll horizontal forzado.
- Usuario puede ver el desglose de CU o CT con un clic, y volver a esconderlo igual de rápido.
- Estado independiente por grupo: puede expandir solo CU, solo CT, ambos o ninguno.

