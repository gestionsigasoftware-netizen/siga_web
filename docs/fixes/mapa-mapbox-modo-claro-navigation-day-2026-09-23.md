# Mapa premium en modo claro (Mapbox `navigation-day-v1`) + pulso en vivo

**Fecha:** 2026-09-23
**Módulo:** Impacto Misionero → Mapa de presencia (`src/components/charts/GeoMap.jsx`, `src/pages/ImpactoMisionero.jsx`)

## Contexto

El usuario, viendo el mapa premium ya en producción (modo oscuro,
`dark-v11`), pidió dos cosas:

1. Pasar el mapa a modo claro/blanco.
2. Que de verdad aproveche lo que Mapbox puede ofrecer, no solo un
   mosaico básico -- mencionó apps como Uber, Google Maps y Waze como
   referencia de mapas "que muestran más información" y se ven mejor
   elaborados. También notó que la señal "en vivo parpadeante" pedida
   desde el diseño original nunca se había implementado de verdad (el
   halo alrededor de cada punto era estático).

## Elección de estilo dentro de Mapbox

Se evaluaron 3 estilos oficiales de Mapbox, todos bajo el mismo token
público y la misma capa gratuita (sin costo ni decisión de licencia
nueva, ya resuelta en `docs/fixes/mapa-mapbox-dark-2026-09-23.md`):

- **`light-v11`**: minimalista, solo vías principales y nombres de
  ciudad. Descartado por ser demasiado plano -- hubiera repetido la
  misma queja del usuario ("no se ve muy distinto de un mapa básico").
- **`streets-v12`**: máximo detalle tipo Google Maps (edificios, POIs,
  transporte). Descartado: a nivel distrital/nacional, la densidad de
  íconos y etiquetas compite visualmente con los puntos de
  congregaciones y las tarjetas flotantes de KPIs.
- **`navigation-day-v1`** (elegido): el estilo real que usan apps de
  navegación tipo Uber/Waze -- jerarquía vial marcada con color (ver
  autopistas verdes con escudo numerado en la captura de verificación),
  parques, cuerpos de agua, buen nivel de detalle sin ruido de POIs.
  Pensado específicamente para leerse con overlays de datos en vivo
  encima, que es exactamente el caso de este mapa.

## Señal "en vivo" (pulso)

Cada punto de congregación ahora tiene un anillo animado (crece y se
desvanece en bucle, ~2.4s) alrededor del punto sólido, con 4 retrasos
distintos repartidos entre los puntos (`siga-pulse-delay-0..3`) para
que no pulsen todos sincronizados -- se ve como actividad real, no un
parpadeo mecánico. Implementado en CSS puro (`@keyframes` +
`transform-box: fill-box` para que la animación escale desde el centro
del círculo SVG, no su esquina), sin librerías nuevas. Respeta
`prefers-reduced-motion` (desactiva la animación, deja el halo fijo).

## Otros cambios de este ajuste

- Las tarjetas flotantes de KPIs (`ImpactoMisionero.jsx`) y el estado
  vacío del mapa (`GeoMap.jsx`) estaban diseñados para leerse sobre
  fondo oscuro (vidrio claro + texto blanco). Se cambiaron a vidrio
  oscuro (`rgba(10,18,36,0.82)` + texto blanco) -- se lee igual de bien
  sobre el mapa claro nuevo, y es el mismo lenguaje visual que ya usan
  los controles/tooltips de Leaflet en modo premium.
- La etiqueta inferior izquierda ("Congregaciones ubicadas...") pasó de
  depender de `text-shadow` sobre el mapa a tener su propia tarjeta de
  vidrio oscuro, igual que los KPIs de la derecha -- más consistente y
  legible sobre cualquier fondo.

## Verificación

1. `npm run build` sin errores.
2. Verificación visual real con el mismo método de hoy: ruta pública
   temporal (`/_preview-mapa-temp`, eliminada al terminar), `npm run
   dev`, captura con Playwright. Confirmado: mosaico claro real de
   Mapbox (`navigation-day-v1`) con autopistas coloreadas y escudos de
   ruta, parques, agua; tarjetas oscuras flotantes perfectamente
   legibles.
3. Animación confirmada de verdad, no solo por código: 2 capturas
   consecutivas (~0.9s de diferencia) del mismo punto muestran el halo
   en distinto tamaño/opacidad entre una y otra -- la animación corre
   en el navegador real, no es solo CSS sin efecto visible.
4. Archivos y ruta temporales eliminados al terminar; `git diff
   src/App.jsx` confirmado vacío.

Ver también `docs/fixes/mapa-mapbox-dark-2026-09-23.md` (investigación
de proveedores, sigue vigente) y
[[feedback_overlay_sobre_leaflet_necesita_zindex_alto]] /
[[feedback_dominio_externo_nuevo_necesita_csp]] (lecciones previas de
esta misma pieza que siguen aplicando).
