# El pulso "en vivo" del mapa nunca funcionó: bug real de react-leaflet, no de producción

**Fecha:** 2026-09-23
**Módulo:** `src/components/charts/GeoMap.jsx`

## Contexto

El usuario reportó, con una captura real de `sigap.com.co`, que el anillo
"en vivo" alrededor de cada punto del mapa se veía estático. La primera
hipótesis (variable de entorno `VITE_MAPBOX_TOKEN` no configurada en
Cloudflare Pages, ver `docs/fixes/...` de hoy sobre ese tema) resultó
real pero **no era la causa de este problema específico** -- una vez
corregida esa variable, los tiles de Mapbox ya cargaban bien en
producción, pero el pulso seguía sin moverse.

## Diagnóstico real (con el navegador del usuario, en vivo)

Se le pidió al usuario correr comandos en la consola de DevTools sobre
la página real:

1. `matchMedia('(prefers-reduced-motion: reduce)').matches` → `false`.
   Descarta que el sistema operativo tuviera "reducir movimiento"
   activado (que es un `@media` que este mismo código respeta a
   propósito).
2. `document.querySelectorAll('.siga-pulse-ring').length` → **`0`**.
   Ningún elemento en toda la página tenía la clase CSS que activa la
   animación -- a pesar de que el círculo (halo) SÍ se veía en pantalla
   (con su color/opacidad puestos directo como atributos SVG, que no
   dependen de la clase CSS).

## Causa raíz

`react-leaflet` trata la prop `pathOptions` de forma especial: la
aplica **después** del montaje inicial, vía `layer.setStyle(pathOptions)`
en un `useEffect` (confirmado leyendo
`node_modules/@react-leaflet/core/lib/path.js`). Leaflet mismo (
`node_modules/leaflet/dist/leaflet-src.js`, método `SVG.prototype._initPath`)
solo agrega la clase CSS (`className`) al elemento **al crearlo por
primera vez** -- un cambio posterior vía `setStyle()` nunca vuelve a
tocar la clase. El resultado: cualquier `className` puesto dentro de
`pathOptions` en un `<CircleMarker>`/`<Circle>`/`<Polygon>` de
react-leaflet **nunca se aplica**, en ningún entorno, mientras que el
resto de propiedades de estilo (`color`, `fillColor`, `fillOpacity`,
`weight`) sí funcionan porque sí se re-aplican en cada `setStyle()`.

**Esto nunca funcionó, ni siquiera en la verificación local de hoy más
temprano** (commit `f423025`, "modo claro + pulso") -- lo que en ese
momento se interpretó como "el halo cambia de tamaño entre dos
capturas" fue casi con certeza la animación normal de encuadre del
mapa (`fitBounds`/zoom easing de Leaflet al cargar), no el pulso CSS.
Ese fue un falso positivo: la verificación de entonces usó `npm run
dev` y comparó capturas visuales, sin nunca confirmar por DOM que la
clase realmente estuviera puesta. Queda como lección aparte (ver
memoria nueva).

## Corrección

`src/components/charts/GeoMap.jsx`: `className` (y de paso
`interactive`, que tiene el mismo problema para la clase
`leaflet-interactive`) se sacan de `pathOptions` y se pasan como props
**directas** del componente `<CircleMarker>`. Al no pasar por
`pathOptions`, react-leaflet las incluye en el objeto de opciones con
el que construye el `L.CircleMarker` la primera vez (confirmado leyendo
`node_modules/react-leaflet/lib/CircleMarker.js`), así que Leaflet sí
las ve en `_initPath`.

```jsx
<CircleMarker
  center={[point.latitud, point.longitud]}
  radius={radius + 7}
  interactive={false}
  className={`siga-pulse-ring siga-pulse-delay-${index % 4}`}
  pathOptions={{ color: 'transparent', fillColor: colorHex, fillOpacity: 0.5, weight: 0 }}
/>
```

## Verificación (esta vez por DOM real, no solo visual)

1. Primer intento de verificación local con `vite preview` dio 0
   elementos -- pero resultó ser porque `vite preview` no hace fallback
   de SPA (la ruta de prueba devolvía 404), así que no probaba nada.
   Corregido usando `wrangler pages dev dist` (que sí tiene el
   fallback SPA configurado en `wrangler.json`).
2. Con el build real servido correctamente:
   `document.querySelectorAll('.siga-pulse-ring').length` → `2`
   (uno por punto). Confirmado con Playwright.
3. `getComputedStyle(el).animationName` → `"siga-map-pulse"`,
   `animationPlayState` → `"running"`.
4. Medido el `transform` y `opacity` computados en dos momentos
   distintos (0.8s de diferencia): cambiaron de verdad (escala 1.999 →
   1.587, opacidad 0.0002 → 0.275) -- prueba definitiva de que la
   animación corre, no solo que el navegador dice que "debería" correr.
5. Confirmado visualmente con captura: cada punto en una fase distinta
   del ciclo (uno compacto/oscuro, otro expandido/difuso), tal como se
   espera con los 4 retrasos escalonados.

## Pendiente para el usuario

Este fix ya está listo para desplegar. Una vez en producción, el
usuario debería ver el anillo pulsando de verdad -- puede confirmarlo
con el mismo comando de consola:
`document.querySelectorAll('.siga-pulse-ring').length` (debería dar 2
o más, nunca 0, en cualquier pantalla con el mapa premium y puntos
visibles).
