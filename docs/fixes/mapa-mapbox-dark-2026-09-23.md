# Mosaico oscuro real (Mapbox dark-v11) para el mapa premium

**Fecha:** 2026-09-23
**Módulo:** Impacto Misionero → Mapa de presencia (`src/components/charts/GeoMap.jsx`, prop `premium`)

## Contexto

El mapa premium de "Mapa de presencia" (Impacto Misionero, distrital/nacional)
usaba OpenStreetMap estándar como mosaico de fondo -- funcional, pero muy
distinto al mapa oscuro tipo "centro de monitoreo" que se validó en el
Artifact de diseño previo. Se necesitaba un proveedor de mosaicos oscuros
real, gratuito y **legal para una app que genera ingresos** como SIGAP.

## Proveedores evaluados y descartados

- **CartoDB** (`basemaps.cartocdn.com/dark_all`, y el CDN legado
  `cartodb-basemaps-a.global.ssl.fastly.net`): su acceso anónimo gratuito ya
  no existe. Ambas URLs devuelven hoy la misma imagen "API KEY REQUIRED"
  (3114 bytes, confirmado por bytes idénticos) en vez de un mosaico real.
- **Esri World Imagery / World Dark Gray Base**: técnicamente responde con
  mosaicos reales sin necesitar clave (confirmado con `curl`: JPEG/PNG reales,
  no un watermark). Pero sus términos de uso (verificados en la página de Esri
  del wiki de OSM) exigen una cuenta de desarrollador registrada y prohíben
  el uso gratuito en aplicaciones que generan ingresos directamente -- que es
  exactamente el caso de SIGAP (SaaS por suscripción). Descartado sin
  registrarse y pagar aparte, decisión que no le correspondía tomar a esta
  sesión.

## Proveedor elegido: Mapbox

- Estilo `dark-v11`, coincide con la estética "antigravity"/tablero de
  operaciones pedida para el mapa premium.
- Capa gratuita: 50,000 cargas de mapa/mes -- de sobra para el tráfico
  esperado de SIGAP.
- Token público (`pk.…`) diseñado explícitamente por Mapbox para
  incrustarse en frontend (no es un secreto), y restringible por dominio
  desde el panel de Mapbox si se quiere endurecer más adelante.
- El usuario proveyó su propio token público de cuenta Mapbox para esta
  integración.

## Cambios

- **`src/components/charts/GeoMap.jsx`**: nueva constante
  `MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN`. Cuando `premium` está
  activo y hay token configurado, el `<TileLayer>` usa
  `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=...`
  con `tileSize={512}` y `zoomOffset={-1}` (patrón estándar documentado para
  integrar mosaicos raster de Mapbox en Leaflet). Si no hay token, se
  degrada solo a OpenStreetMap estándar -- el mapa nunca se rompe por falta
  de configuración.
- **`.env`** (no versionado): nueva variable `VITE_MAPBOX_TOKEN` con el
  token real.
- **`.env.example`**: entrada `VITE_MAPBOX_TOKEN=` vacía, con comentario
  explicando que es opcional y qué pasa si se deja vacía.
- **`public/_headers`**: `img-src` del CSP ampliado con
  `https://api.mapbox.com`. Sin este cambio, los tiles de Mapbox se
  hubieran bloqueado en silencio en producción (el navegador descarta
  la imagen sin lanzar ningún error visible en la UI) aunque
  funcionaran perfecto en `npm run dev`, que no aplica CSP -- el mismo
  patrón de "fallo silencioso" ya visto varias veces en esta app.

## Verificación

1. `curl` directo a la URL de tiles de Mapbox con el token real → `200`,
   imagen PNG real de ~42 KB (no un placeholder).
2. `npm run build` sin errores.
3. Verificación visual real: ruta pública temporal
   (`/_preview-mapa-temp`, eliminada al terminar) con 4 puntos de ejemplo,
   `npm run dev` + captura con Playwright. Confirmado: mosaico oscuro real
   de Mapbox (calles, límites de parques naturales, nombres de lugares),
   atribución correcta ("Leaflet | © Mapbox © OpenStreetMap"), puntos con
   halo y tarjetas flotantes (KPIs, etiqueta inferior) visibles por encima
   del mapa sin tapar controles de zoom ni atribución.
4. `public/_headers`: verificado con `npm run build` + `wrangler pages dev dist`
   real (no solo revisado por código) que el header
   `Content-Security-Policy` servido en producción realmente incluye
   `https://api.mapbox.com` en `img-src` -- se detectó y corrigió en el
   camino que la primera verificación usaba un `dist/` desactualizado
   (build previo a este cambio), que hubiera dado una falsa confirmación.
5. Todos los archivos y procesos temporales (componente de preview,
   ruta en `App.jsx`, script de captura, imagen, servidores `vite`/
   `wrangler pages dev` en segundo plano) eliminados/detenidos al
   terminar; `git diff src/App.jsx` confirmado vacío.
