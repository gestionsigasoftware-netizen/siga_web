# Mapa de presencia (Fase 1) en Impacto Misionero -- 2026-09-23

## Contexto

Idea del usuario: un mapa interactivo de Colombia para distrital y
nacional, mostrando dónde están ubicadas las congregaciones, con
indicadores y gráficas. Se validó primero con una vista previa visual
(Artifact, no funcional) antes de tocar código real. Esta pieza es la
Fase 1 de verdad: mapa de puntos + indicadores + gráficas, con datos
reales. La Fase 2 (mapa coroplético por municipio, "cuántos municipios
tiene la IPUC") queda fuera de alcance -- necesitaría un catálogo
geográfico de Colombia que hoy no existe (ver conversación del mismo
día para el detalle de por qué es una pieza más grande y separada).

## Ajuste frente a la vista previa

El Artifact usó un mapa oscuro estilizado con tarjetas de vidrio
flotando ENCIMA del mapa, porque ese entorno no puede cargar mosaicos
reales de OpenStreetMap. La implementación real sí puede
(`GeoMap.jsx`, ya usado en Distritos y Evangelismo), pero con mosaicos
claros/a color -- superponer tarjetas encima del mapa interactivo real
arriesgaba tapar los controles de zoom/atribución de Leaflet y no se
vería bien sobre un fondo que no es oscuro. Se optó por indicadores en
fila normal (reutilizando el componente `Metric` que ya existía en
este archivo) justo encima de una tarjeta de mapa con más presencia
visual (sombra con acento de color, borde), sin arriesgar la
interactividad real del mapa.

## Corrección

**Archivo único**: `src/pages/ImpactoMisionero.jsx`. Sin cambios de
SQL/RLS -- todo lo necesario ya era legible con las políticas
existentes.

- Nueva sección "Mapa de presencia", visible solo para distrital y
  nacional/super_admin (`!esLocal`). Sin selector Distrital/Nacional
  como en la vista previa -- la página ya se acota sola por rol.
- `load()`: nueva consulta a `congregaciones` (`id, nombre, ciudad,
  latitud, longitud, created_at`), filtrada por `distrito_id` para
  distrital (columna directa, sin necesitar el truco de embed que sí
  usan las otras tablas de este archivo) y sin filtro para
  nacional/super_admin. Con esos ids, una segunda consulta simple
  (no embebida) a `vw_resumen_feligresia` para `personas_activas` --
  se evitó un embed a través de la vista porque PostgREST no siempre
  puede inferir esa relación de forma confiable.
- 4 indicadores nuevos: congregaciones activas, ciudades con
  presencia (mismo cálculo de agrupar-por-ciudad que ya usa
  `GestionDistritos.jsx:120-136`, reutilizado tal cual), nuevas en
  los últimos 12 meses, y personas alcanzadas (suma de
  `personas_activas`).
- Mapa: `<GeoMap points={...} height={420} />` (componente existente,
  sin tocar), puntos dimensionados por `personas_activas` de cada
  congregación.
- Dos gráficas nuevas, mismo estilo que ya usa esta página:
  congregaciones por ciudad (barras, `distributionDataset`, ya
  importado) y crecimiento acumulado de congregaciones en 6 meses
  (línea, `trendDataset`, nuevo import desde `chartTheme.js` --
  `LineElement`/`PointElement` ya estaban registrados en este archivo
  aunque no se usaban).

## Verificación

- `npm run build` sin errores.
- Confirmado en vivo contra producción real (cuenta
  `pueba691@gmail.com`) que las dos consultas nuevas (congregaciones
  filtradas por `distrito_id`, y `vw_resumen_feligresia` con `.in()`)
  no producen ningún error de PostgREST.
- **Dato real encontrado durante la verificación**: la única
  congregación real del Distrito 6 hoy (Puerto Tejada Cauca Central)
  no tiene `ciudad` ni `latitud`/`longitud` registradas -- así que la
  primera vez que un distrital real abra esta sección, el mapa
  aparecerá vacío ("Aún no hay direcciones registradas para mostrar
  en el mapa", mensaje que `GeoMap.jsx` ya maneja) y "Ciudades con
  presencia" en 0. No es un bug: simplemente falta ese dato en las
  congregaciones reales todavía. Se resuelve solo a medida que se
  completen esos campos (Configuración de cada congregación, o
  editando la dirección).
- **No se pudo probar con clics reales** (no hay cuenta de prueba con
  rol distrital ni nacional) -- verificado por código y por las
  consultas directas de arriba, igual que otras piezas de hoy.
