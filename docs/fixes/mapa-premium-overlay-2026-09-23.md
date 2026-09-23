# Mapa premium: tarjetas flotantes reales + halo en pines -- 2026-09-23

## Contexto

Tras construir la Fase 1 del mapa de presencia, el usuario pidió que
el mapa real se acercara más a la vista previa (Artifact): pines con
halo, tarjetas flotantes de vidrio sobre el mapa, controles
rediseñados -- en vez del mapa "básico" de OpenStreetMap.

## Lo que se intentó y no funcionó: mosaicos oscuros

Se agregó soporte para mosaicos oscuros de CartoDB
(`basemaps.cartocdn.com/dark_all`) como modo `premium` de `GeoMap.jsx`.
Al verificarlo visualmente (ver más abajo), tanto la URL actual como
una URL "legacy" alternativa devolvían el mismo aviso "API KEY
REQUIRED" incrustado como imagen -- CartoDB cerró el acceso anónimo a
su CDN de mosaicos gratuito y ahora exige una cuenta/clave. No se
registró ninguna cuenta de terceros sin que el usuario lo decida, así
que se revirtió: el mapa premium usa el mismo mosaico de OpenStreetMap
de siempre (el que ya funciona en todas partes), y el tratamiento
"elevado" se logra con lo demás (pines, tarjetas, controles), que sí
son reales.

## El bug real que si se encontró y se corrigió: tarjetas invisibles

Al armar las tarjetas flotantes de vidrio sobre el mapa (indicadores
de "Congregaciones"/"Ciudades" en la esquina), quedaban **invisibles**
-- presentes en el DOM, con los estilos correctos (color, blur,
posición), pero nunca se pintaban en pantalla, sin ningún error en
consola.

**Se verificó visualmente de verdad** (no se asumió): se montó
temporalmente una ruta de prueba (`/_preview-mapa-temp`, eliminada al
terminar, nunca llegó a producción) con datos de ejemplo, se levantó
`npm run dev` y se capturó con Playwright, probando varias hipótesis
una por una hasta aislar la causa real:

1. Primero se sospechó de `overflow-hidden` o de un `<div>` envolviendo
   los `CircleMarker` dentro de `.map()` -- se corrigió a `Fragment`
   (necesario igual, ver abajo), pero no era la causa del problema
   visual.
2. Se probó con colores muy contrastantes (rojo sólido al 90%) para
   descartar que fuera solo "muy sutil" -- con eso sí se veía, lo que
   confirmó que el problema no era de contraste.
3. Se aisló variable por variable (backdrop-filter, opacidad, color)
   hasta confirmar que **el z-index no bastaba**: Leaflet usa
   z-index internos de hasta 1000+ para sus propios paneles/controles
   (`.leaflet-pane` 400, `.leaflet-popup-pane` 700, controles 1000 --
   confirmado leyendo `node_modules/leaflet/dist/leaflet.css`). En
   cuanto la tarjeta flotante recibe su propia capa compuesta (
   `transform`, necesario para que la tarjeta se pinte por encima en
   vez de por detrás), empieza a compararse numéricamente contra esos
   paneles de Leaflet en vez de heredar el orden normal del DOM -- con
   un z-index de 10 (razonable en cualquier otro contexto) quedaba por
   debajo del mapa. Con z-index 1200 (por encima del máximo de
   Leaflet) sí funciona.

## Corrección

**`src/components/charts/GeoMap.jsx`**:
- Se quitó el mosaico de CartoDB -- vuelve a usar siempre OpenStreetMap
  estándar, para `premium` y no-`premium` por igual.
- Se mantiene el halo de brillo en cada punto (un `CircleMarker`
  adicional, más grande y translúcido, detrás del punto sólido) y los
  controles de zoom/tooltip rediseñados (vidrio oscuro), que sí
  funcionan y no dependen de ningún servicio externo.
- Los `CircleMarker` dentro de `.map()` se envuelven en `Fragment`
  (con `key`), no en un `<div>` -- react-leaflet necesita que sus
  capas sean hijos directos reales del árbol de React, un `<div>` de
  por medio no es seguro.

**`src/pages/ImpactoMisionero.jsx`**: las dos tarjetas flotantes ahora
usan `zIndex: 1200` + `transform: "translateZ(0)"` (antes: `zIndex: 10`,
invisible). Se dejó un comentario explicando el porqué exacto, para
que si alguien más intenta superponer algo sobre un mapa de Leaflet en
este código más adelante, no tenga que redescubrir esto desde cero.

## Verificación

- `npm run build` sin errores.
- **Verificado visualmente de verdad, no solo por código**: se montó
  una ruta de prueba temporal, se capturó con Playwright en varias
  iteraciones hasta confirmar que las tarjetas se ven correctamente
  (vidrio translúcido con blur, texto legible, halo en los pines). La
  ruta de prueba y todos los scripts/capturas temporales se eliminaron
  por completo -- no queda nada de esto en el repo ni en producción.
- Confirmado que `GestionDistritos.jsx` y `Evangelismo.jsx` (los otros
  2 usos de `GeoMap.jsx`, en modo no-`premium`) no cambian en
  absoluto -- mismo mosaico de siempre, sin tocar su comportamiento.
