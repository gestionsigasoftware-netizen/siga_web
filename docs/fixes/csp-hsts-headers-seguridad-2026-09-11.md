# Cabeceras de seguridad: CSP, HSTS y anti-clickjacking — 2026-09-11

## Contexto

Parte de la verificación de producción del 2026-09-10 (ver
`project_siga_verificacion_produccion_2026_09_10` en memoria) dejó
pendiente, a propósito, "monitoreo/alertas/logs y CSP/HSTS/anti-
clickjacking" para después de resolver otros hallazgos. El usuario
pidió cerrarlo ahora, antes de recibir más clientes reales.

## Diseño

El sitio se sirve como Cloudflare Workers Static Assets
(`wrangler.json`, `assets.directory: "./dist/"`). Ese sistema soporta
el mismo archivo `_headers` que Cloudflare Pages (confirmado con
`wrangler dev`: "Parsed 1 valid header rule" y las cabeceras
efectivamente presentes en la respuesta). Se creó `public/_headers`
(Vite lo copia tal cual a `dist/` en cada build) aplicando una sola
regla a `/*`:

- `Strict-Transport-Security` (1 año, incluye subdominios + preload).
- `X-Frame-Options: DENY` + `Content-Security-Policy:
  frame-ancestors 'none'` -- anti-clickjacking (dos capas, la primera
  para navegadores viejos).
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` deshabilitando geolocalización, cámara,
  micrófono y pagos (SIGAP no usa ninguno).
- `Content-Security-Policy` restrictiva: `default-src 'self'` y
  `script-src 'self'` (sin `unsafe-inline`/`unsafe-eval` -- la app no
  usa scripts inline ni `eval`), permitiendo solo los dominios
  externos que la app realmente usa:
  - `style-src`/`font-src`: Google Fonts (`fonts.googleapis.com`/
    `fonts.gstatic.com`). `style-src` necesita `'unsafe-inline'`
    porque React aplica estilos inline dinámicos (`style={{...}}`) en
    varias pantallas (avatares con color por hash, etc.).
  - `img-src`: tiles de OpenStreetMap (`*.tile.openstreetmap.org`),
    usados por `GeoMap.jsx` en Evangelismo y Gestión de Distritos.
  - `connect-src`: Supabase (`https://*.supabase.co` y
    `wss://*.supabase.co` -- este último porque
    `NotificationCenter.jsx` usa Realtime) y Nominatim
    (`nominatim.openstreetmap.org`, geocodificación en
    `src/lib/geocoding.js`).
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
    `upgrade-insecure-requests`.

## Verificación

1. `npm run build` -- `_headers` queda copiado en `dist/_headers`.
2. `wrangler dev` local: "✨ Parsed 1 valid header rule" y `curl -I`
   confirma las 6 cabeceras en la respuesta real.
3. Prueba con Playwright contra ese mismo servidor local: login real
   (`pueba691@gmail.com`), navegación por `/app`, `/feligresia`,
   `/amigos`, `/evangelismo` (mapa), `/distritos` (mapa) y `/reportes`
   -- **cero violaciones de CSP** en consola (se escuchó
   específicamente cualquier mensaje con "Content Security Policy" o
   "Refused to").

## Pendiente

Monitoreo/alertas/logs sigue sin resolver -- se aborda por separado
porque implica una decisión de alcance (herramienta propia vs.
servicio externo que requiere que el usuario cree una cuenta).
