# Plan de optimización integral de la plataforma Tercol

## Objetivo
Reducir la sensación de lentitud global de la plataforma en tres frentes: carga inicial, respuesta al hacer clic/interactuar y fluidez visual en navegación, filtros y apertura/cierre del menú lateral.

## Hallazgos principales
- La lentitud no parece venir de un solo componente, sino de una combinación de bundle inicial pesado, páginas que cargan demasiados datos al cliente y tablas/filtros que reprocesan grandes volúmenes en cada interacción.
- La carga inicial está penalizada por recursos grandes y globales. En la medición del navegador aparecieron, entre otros:
  - `xlsx.js` ~189 KB cargado en el arranque.
  - `lucide-react.js` ~180 KB.
  - `@supabase/supabase-js` ~128 KB.
- Métricas observadas en preview:
  - DOM Interactive ~3.3 s
  - Full page load ~5.7 s
  - First Contentful Paint muy tardío en la sesión medida
  - 147 requests de red / 195 recursos cargados
- Hay varias pantallas que descargan miles de filas completas y luego filtran/ordenan en memoria del navegador.
- `analisis-ventas` hace varias cargas separadas y además construye tablas/rankings/filtros sobre todos los registros en cliente.
- La calculadora y módulos de importación/exportación comparten utilidades Excel que hoy se importan desde módulos normales, lo que empuja `xlsx` al bundle principal aunque el usuario no esté importando archivos.
- Solo `analisis-ventas` está en ruta lazy explícita; varias páginas pesadas siguen entrando por rutas directas.

## Qué voy a corregir

### 1) Aligerar el arranque global
- Separar la lógica de Excel (`xlsx`) en imports dinámicos para que solo cargue cuando el usuario abra un flujo de importación/exportación.
- Revisar los componentes de importación (`ImportWizardDialog`, `UploadVentasDialog`, listas, costos, export Excel de calculadora) para que el parser no se incluya en el primer render de la app.
- Extender carga diferida de rutas pesadas:
  - `calculadora`
  - `listas-precios`
  - `costos-productos`
  - `costos-operacionales`
  - `negociaciones`
  - revisar si `dashboard` también conviene lazy
- Ajustar preloading del router para evitar precargas demasiado agresivas en hover/intención cuando no aporten valor.

### 2) Reducir renders globales innecesarios
- Optimizar el layout autenticado (`_app`, `AppSidebar`, `SidebarProvider`) para que el colapso/expansión del menú no fuerce repintados evitables del árbol completo.
- Revisar el contexto de autenticación para separar mejor el estado de usuario del catálogo de usuarios del login, evitando que datos no usados se propaguen globalmente.
- Aislar componentes visuales del sidebar y encabezado con memoización donde sí aporte valor real.

### 3) Optimizar consultas y volumen de datos
- Auditar y reducir consultas que hoy traen datasets enteros cuando bastaría un subconjunto o un agregado.
- En `analisis-ventas`:
  - limitar columnas y cargas redundantes
  - evitar consultas duplicadas para “hay ventas / meses / costos / descuentos / operacionales” cuando puedan consolidarse o diferirse
  - mover más filtrado al query cuando aplique
- En páginas operativas, revisar `.limit(5000)` y paginación manual para no renderizar miles de filas completas sin necesidad.
- Priorizar “stale-while-revalidate” y cargas por demanda en paneles secundarios.

### 4) Hacer más ligeras las tablas y filtros pesados
- En `analisis-ventas`, optimizar el pipeline actual de detalle:
  - hoy se calcula `filteredCount` y `detailRows` recorriendo la misma data por separado
  - unificar el procesamiento para evitar doble trabajo por cada cambio de filtro
  - mantener sort/filter/search con memoización mejor estructurada
- Aplicar la misma estrategia a `RentabilidadTable` y tablas grandes de costos.
- Evaluar paginación/ventaneo visible para tablas extensas en lugar de renderizar cientos o miles de filas de una vez.
- Reducir el costo de popovers/filtros cuando las listas de opciones son grandes.

### 5) Recortar UI costosa o no prioritaria
- Revisar gráficos restantes de la calculadora y rankings visuales para verificar si todos deben renderizarse de inmediato o si conviene diferirlos.
- Posponer componentes secundarios bajo interacción del usuario cuando no sean críticos para el primer paint.
- Verificar que modales/sheets con tablas grandes carguen datos solo al abrirse, no antes.

### 6) Mejorar percepción de velocidad
- Añadir estados de transición más ligeros donde hoy el usuario siente “tosquedad”.
- Evitar bloqueos visuales en clics de filtros, selects y menú lateral.
- Revisar duraciones/transiciones del sidebar para que se sienta más rápida y menos pesada.

## Orden de implementación
1. Sacar `xlsx` del bundle inicial con imports dinámicos.
2. Convertir rutas pesadas a lazy loading.
3. Optimizar `analisis-ventas` (consultas + pipeline de filtros + tabla).
4. Optimizar calculadora y tablas grandes.
5. Afinar sidebar/layout/contextos globales.
6. Medir antes/después y hacer una segunda pasada fina.

## Validación
Voy a validar la mejora con:
- perfil de performance del navegador
- revisión de requests y tamaño de recursos
- tiempo de carga inicial
- respuesta al colapsar/expandir sidebar
- respuesta al abrir filtros y cambiar selects
- comparación de fluidez en `analisis-ventas`, `calculadora`, `costos-productos` y `negociaciones`

## Resultado esperado
- Menor tiempo de arranque y menos scripts cargados de entrada.
- Menos sensación de “lag” al interactuar con botones, filtros y menú lateral.
- Tablas más ágiles y menos costosas al escribir, ordenar o filtrar.
- Plataforma más estable y fluida de forma general, no solo en `analisis-ventas`.

## Detalles técnicos
- Moveré `xlsx` fuera de `src/lib/excel.ts` de carga directa hacia `import()` bajo demanda, o separaré el parser pesado en un módulo lazy.
- Reestructuraré rutas para usar `createLazyFileRoute` donde hoy se importa el componente completo en el archivo crítico.
- Reharé cálculos duplicados en `AnalisisVentasPage` y, si hace falta, dividiré la tabla grande en componentes memoizados o con virtualización.
- Revisaré el patrón de queries Supabase para evitar traer más filas/columnas de las necesarias y para no repetir lecturas costosas.
- Mantendré intacta la lógica financiera ya aprobada; esta optimización será de performance y UX, no de negocio.