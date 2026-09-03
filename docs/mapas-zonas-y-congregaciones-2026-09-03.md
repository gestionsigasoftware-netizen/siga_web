# Mapas: zonas de evangelismo y congregaciones por ciudad (2026-09-03)

## Contexto

El usuario preguntó por mapas después de ver que Highcharts/ECharts los
soporta (aunque el intento de migrar los gráficos existentes a ECharts
se revirtió por completo a pedido explícito — no le convenció
visualmente, ver el commit de esta sesión). Pidió específicamente:

1. Ver personas por zona/barrio en Misiones y Evangelismo, en mapa.
2. Ver congregaciones agrupadas por ciudad (ej. "cuántas hay en Cali"),
   también en mapa, usando la dirección exacta para un punto aproximado
   en vez de solo el nombre de la ciudad.

Se investigó el modelo de datos antes de construir: `zonas` solo tenía
`nombre` (sin ubicación), y `congregaciones` solo tenía `ciudad` (sin
dirección ni coordenadas) — no había nada que "poner en el mapa" sin
agregar esos datos primero.

## Decisión: geocodificación por dirección, no clic en mapa

El usuario prefirió escribir una dirección de texto (ej. "Calle 5
#23-10, Barrio San Fernando") y que el sistema la convierta a un punto
aproximado automáticamente, en vez de hacer clic manual en un mapa.

Se usa **Nominatim** (geocodificador de OpenStreetMap) — gratis, sin
API key, sin restricción de licencia comercial (a diferencia de
Highcharts). `src/lib/geocoding.js` hace la conversión una sola vez, en
el momento de guardar la dirección (no procesamiento masivo).

## Backend — `supabase/geolocalizacion.sql`

Agrega `direccion`, `latitud`, `longitud` a `zonas` y a `congregaciones`.
Las filas sin dirección simplemente no aparecen en ningún mapa — nunca
se adivina una ubicación.

## Mapa reutilizable — `src/components/charts/GeoMap.jsx`

Se instaló **Leaflet + react-leaflet** (react-leaflet v4, compatible con
React 18 — la v5 requiere React 19). Muy liviano comparado con
Highcharts/ECharts, sin licencia. Puntos en círculos de tamaño según un
valor (personas, congregaciones, etc.), con tooltip.

Un bug real que se encontró y corrigió durante la verificación visual:
con 2+ puntos cercanos entre sí (ej. varias zonas de la misma ciudad),
el mapa quedaba demasiado alejado (zoom fijo a nivel país) y los puntos
se veían como una sola mancha borrosa. Se corrigió con un ajuste
automático de vista (`fitBounds`, vía un componente `AjustarVista` con
`useMap()` — el prop `bounds` de `MapContainer` no se aplicaba de forma
confiable junto con `center`/`zoom`). Verificado con captura de pantalla
real (3 puntos en Cali, tamaños proporcionales, calles visibles) antes
de darlo por terminado.

## Frontend

- **`src/pages/Configuracion.jsx`** (local): la tarjeta "Identidad de la
  congregación" ahora tiene Ciudad/Municipio y Dirección. Al guardar, se
  geocodifica y se guarda la ubicación aproximada.
- **`src/pages/Evangelismo.jsx`**: los formularios de crear/editar zona
  tienen un campo de dirección opcional (se geocodifica al guardar).
  Se agregó una sección nueva "Cobertura territorial" con un gráfico de
  barras (amigos alcanzados por zona, con Chart.js — se mantiene la
  librería actual) y un mapa con esos mismos puntos.
- **`src/pages/GestionDistritos.jsx`** (nacional/super_admin): nueva
  sección "Congregaciones por ciudad" — tabla agrupada (ciudad →
  cantidad de congregaciones y de cuántos distritos distintos vienen,
  para casos como Cali con congregaciones de varios distritos) + mapa
  nacional con cada congregación que ya tiene dirección registrada.

## Verificación

`npm run build` corre limpio. Se verificó visualmente el mapa con
Playwright y datos de ejemplo (no hay credenciales de prueba en esta
sesión para probar con datos reales end-to-end).

## Acción requerida del usuario

1. Ejecutar `supabase/geolocalizacion.sql`.
2. Las congregaciones y zonas que ya existen quedan sin ubicación hasta
   que alguien edite su dirección — no hay forma de adivinarla.
