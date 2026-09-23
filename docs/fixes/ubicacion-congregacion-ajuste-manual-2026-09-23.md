# Ubicación exacta de la congregación: geocodificador + ajuste manual en mapa

**Fecha:** 2026-09-23
**Módulo:** Configuración (local) → `src/pages/Configuracion.jsx`, nuevo `src/components/charts/MapaUbicacionEditable.jsx`

## Contexto

El usuario notó que las ubicaciones de las congregaciones en el mapa de
presencia no siempre son veraces -- son aproximadas. La causa de fondo:
la geocodificación automática (Nominatim/OpenStreetMap, `src/lib/geocoding.js`)
no siempre tiene el detalle de calle de poblaciones pequeñas colombianas,
y hasta ahora esa era la ÚNICA fuente de la ubicación -- si Nominatim no
encontraba la dirección exacta, se guardaba una aproximación por ciudad
sin ninguna forma de corregirla. Ningún geocodificador automático puede
garantizar precisión perfecta para cada dirección real; la única forma
de garantizarla es que alguien que conoce el lugar confirme o ajuste el
punto.

Se evaluaron 3 caminos con el usuario y eligió el más completo:
geocodificador automático como punto de partida + ajuste manual sobre un
mapa (en vez de solo cambiar de proveedor de geocodificación, o quitarla
por completo).

## Cambios

- **`src/components/charts/MapaUbicacionEditable.jsx`** (nuevo): mapa de
  un solo punto donde un clic en cualquier parte coloca o mueve el pin
  ahí (`useMapEvents('click')`). Usa `CircleMarker` en vez de
  `Marker`+ícono a propósito -- evita el bug clásico de Leaflet con
  bundlers donde el ícono por defecto del pin se rompe por rutas de
  asset relativas, y mantiene el mismo lenguaje visual que el resto de
  mapas de SIGAP. Expone `recenterKey`: como `MapContainer` solo lee
  `center`/`zoom` en el montaje inicial (mismo motivo que `AjustarVista`
  en `GeoMap.jsx`), un salto de vista posterior (cuando el
  geocodificador encuentra un punto lejano) necesita moverse a mano vía
  `useMap().setView(...)`, disparado solo cuando `recenterKey` cambia
  -- no en cada clic manual, para no pelearse con el usuario mientras
  ajusta el pin.
- **`src/pages/Configuracion.jsx`**:
  - La consulta de la congregación ahora trae `latitud, longitud`
    (antes se guardaban pero nunca se volvían a leer -- el formulario
    no tenía forma de mostrar la ubicación ya guardada).
  - Nuevo botón "Buscar dirección en el mapa" (`buscarEnMapa()`): corre
    `geocodeAddress()` una sola vez, a demanda -- ya no se geocodifica
    en cada guardado (antes pasaba en silencio dentro de
    `guardarPreferencias`, sin que la persona viera el resultado antes
    de guardar). Mueve el pin y centra el mapa ahí; el aviso indica si
    la ubicación fue aproximada por ciudad.
  - El mapa editable se muestra debajo de los campos de Ciudad/Dirección;
    cualquier clic ahí actualiza el pin de inmediato.
  - `guardarPreferencias` ya no llama a `geocodeAddress` -- guarda
    exactamente `organizacion.latitud`/`longitud`, sea cual sea su
    origen (sugerencia automática o clic manual). La dirección de texto
    queda como referencia descriptiva; el pin es la fuente de verdad
    para el mapa.
  - De paso se eliminó una consulta muerta (`select('distrito_id')`
    sobre la congregación) que se hacía al guardar sin usarse para nada.

## Verificación

1. `npm run build` sin errores.
2. Verificación visual e interactiva real con Playwright (ruta pública
   temporal, eliminada al terminar): estado inicial sin ubicar → clic en
   el mapa coloca el pin exactamente donde se hizo clic (confirmado
   comparando lat/lng antes/después vía un `data-testid` temporal) →
   simulación de "Buscar dirección" mueve y centra el mapa en el punto
   nuevo con zoom de calle (probado con las coordenadas reales de
   Puerto Tejada, Cauca -- se ve el callejero real: Calle 16, El
   Centro, etc.).
3. Sin cambios de SQL: `latitud`/`longitud` ya existían como columnas
   en `congregaciones` desde la funcionalidad de mapas de 2026-09-03, y
   la política de `update` para el rol local ya permitía escribirlas
   (ya se usaba para el resultado del geocodificador automático).
4. Archivos y ruta temporales eliminados al terminar; `git diff
   src/App.jsx` confirmado vacío.
