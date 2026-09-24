# Territorio alcanzado por distrito (Impacto Misionero, nacional)

**Fecha:** 2026-09-24
**Módulo:** `src/pages/ImpactoMisionero.jsx` (solo nacional/super_admin), nuevo `src/components/charts/MapaTerritorios.jsx`

## Contexto

El usuario, mirando el mapa de tráfico por país de Cloudflare (un
choropleth), pidió algo parecido pero con un objetivo estratégico
concreto: saber qué territorio de Colombia ya cubre cada distrito de
la IPUC (a partir de dónde están sus congregaciones), para identificar
qué territorio **todavía no** se alcanza y poder enviar misioneros
ahí. Los distritos de la IPUC son una división administrativa interna
-- no tienen un polígono/dirección propia guardada en SIGAP ni en
ninguna fuente oficial (no son departamentos ni municipios), así que
no hay ningún límite territorial que "leer" de ningún lado.

## Métodos evaluados

- **Punto único por distrito (centroide)**: descartado por el propio
  usuario -- un distrito no tiene una sola ubicación real.
- **Diagrama de Voronoi**: descartado -- reparte el 100% del país
  entre los distritos existentes, nunca deja huecos, así que no puede
  mostrar territorio sin alcanzar (contradice el objetivo real).
- **Radio de alcance por congregación, fusionado por distrito**
  (elegido): alrededor de cada congregación se dibuja un círculo de
  alcance aproximado (10/15/20 km, ajustable), y los círculos de un
  mismo distrito se funden en una sola mancha de color. Donde no hay
  mancha de ningún distrito = territorio sin ninguna congregación
  cerca. Es una aproximación explícita, no un límite oficial -- el
  diseño lo comunica así en el propio texto de la pantalla.

## Librería nueva: turf.js (modular)

SIGAP no tenía ninguna librería geoespacial. Se agregaron los paquetes
modulares (no el paquete `turf` completo, más pesado de lo necesario):
`@turf/circle`, `@turf/union`, `@turf/helpers`, `@turf/area`. Como
`ImpactoMisionero.jsx` es una ruta `React.lazy`, este peso solo se
descarga cuando alguien visita esa pantalla (mismo patrón que
`exceljs`, 940 KB, en otras páginas).

**API real de `@turf/union` v7** (verificada leyendo el `.d.ts`
instalado, no supuesta): `union(featureCollection([poly1, poly2, ...]))`
recibe una `FeatureCollection` completa y devuelve una sola figura
fusionada (`Polygon` o `MultiPolygon`), sin necesitar un `reduce`
manual de a pares.

## Cambios

- **`src/pages/ImpactoMisionero.jsx`**: el `select` de
  `congregacionesQuery` ahora incluye `distrito_id, distritos(numero)`
  (FK ya existente, embed estándar). Nuevo estado `radioKm` (10/15/20,
  selector de 3 botones). Nueva sección "Territorio alcanzado por
  distrito", gateada por `esNacionalOSuperAdmin` (no por `!esLocal`
  como el resto de la página -- distrital ya ve un solo distrito, una
  mancha de un color no aporta nada ahí). Ubicada debajo de las
  gráficas existentes de "Congregaciones por ciudad"/"Crecimiento", sin
  tocar el "Mapa de presencia" (puntos) que ya existía -- esto
  **complementa**, no reemplaza.
- **`src/components/charts/MapaTerritorios.jsx`** (nuevo): agrupa las
  congregaciones por `distrito_id`, genera un círculo de alcance
  (`circle`) por congregación y los funde (`union`) en una mancha por
  distrito. Color por distrito vía rotación de tono dorado
  (`hue = i * 137.508° mod 360`) -- separa bien colores adyacentes
  incluso para los ~36 distritos de la IPUC sin mantener una paleta
  fija a mano. Se renderiza con `<GeoJSON>` de react-leaflet (ya
  disponible, sin instalar nada extra ahí), con un tooltip por mancha
  ("Distrito N · X congregaciones · ~Y km²", área calculada con
  `@turf/area`) en vez de una leyenda fija de hasta 36 colores. Encima
  de las manchas, puntos blancos discretos marcan cada congregación
  real. Mismo mosaico Mapbox `streets-v12`/OpenStreetMap y mismo
  lenguaje visual (controles en vidrio oscuro) que `GeoMap.jsx` -- se
  copió ese fragmento en vez de modificar `GeoMap.jsx` (ya verificado
  en producción, resuelve un problema distinto: puntos, no polígonos).
  **Detalle técnico no obvio**: el `<GeoJSON>` de react-leaflet crea la
  capa de Leaflet una sola vez al montar y no vuelve a leer `data`
  después -- cambiar el radio sin más dejaría las manchas viejas en
  pantalla. Se fuerza un remount con `key={radioKm}` para que las
  manchas se recalculen y redibujen correctamente al cambiar el radio.

Sin cambios de SQL ni de RLS -- `congregaciones` ya es legible con la
política existente; solo se agregaron campos al `select` que ya se hacía.

## Verificación

1. Firmas reales de `@turf/circle`/`@turf/union` confirmadas leyendo
   los `.d.ts` instalados (no supuestas de memoria).
2. `npm run build` sin errores.
3. Verificación visual real con datos de ejemplo (7 congregaciones en
   3 "distritos" distintos, coordenadas reales de Cali/Puerto
   Tejada/Popayán) vía ruta pública temporal + Playwright:
   - 3 manchas de color bien diferenciadas (morado, verde, rojo/naranja).
   - Hueco visible sin ninguna mancha entre el grupo Cali/Puerto Tejada
     y el grupo Popayán (territorio sin alcanzar, como se buscaba).
   - Tooltip responde al pasar el mouse sobre una mancha.
   - El selector de radio (10/15/20 km) cambia visiblemente el tamaño
     de las manchas -- confirmado comparando capturas a 15 km y 20 km
     (más solapamiento entre Cali y Puerto Tejada a 20 km).
   - Sin errores de consola ni de página.
4. Archivos y ruta temporales eliminados al terminar; `git diff
   src/App.jsx` confirmado vacío.

## Limitación aceptada, comunicada en la propia pantalla

Es una aproximación por radio de alcance alrededor de cada
congregación -- no un límite territorial oficial, no considera vías de
acceso reales, ríos, montañas ni densidad poblacional. Sirve como
señal para toma de decisiones, no como cartografía autorizada.
