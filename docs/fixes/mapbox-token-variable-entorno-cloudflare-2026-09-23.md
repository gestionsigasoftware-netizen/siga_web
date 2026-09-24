# Mapbox no cargaba en producción: faltaba la variable de entorno en Cloudflare Pages

**Fecha:** 2026-09-23
**Módulo:** despliegue (Cloudflare Pages), no código de la app

## Qué pasó

El usuario reportó que el mapa premium en `sigap.com.co` no se veía
distinto de un mapa básico. `VITE_MAPBOX_TOKEN` solo se había agregado
a `.env` local (correctamente ignorado por git, nunca se sube) y a
`.env.example` (solo un placeholder vacío, documentación). Cloudflare
Pages construye la app en su propia infraestructura con sus propias
variables de entorno configuradas en su panel -- completamente
separado del `.env` local de esta máquina.

Como Vite reemplaza `import.meta.env.VITE_MAPBOX_TOKEN` por su valor
real en tiempo de compilación, si esa variable no existe en el entorno
de build de Cloudflare, Vite la reemplaza por `undefined` -- y el
propio minificador, al ver `premium && undefined ? <Mapbox/> : <OSM/>`,
elimina la rama de Mapbox por completo (es código estáticamente
inalcanzable). El resultado: la app cae siempre al mosaico básico de
OpenStreetMap, sin ningún error visible ni en consola ni en la UI.

**Nota de proceso importante**: las verificaciones de hoy con
`wrangler pages dev dist` (usadas para confirmar el header CSP, y para
varias verificaciones del mapa) corrieron siempre en esta máquina local
usando el `.env` local -- por eso parecían confirmar que todo
funcionaba en "producción", pero en realidad solo probaban el build
local, nunca el build real de Cloudflare con sus propias variables.
Esa es la razón por la que el problema no se detectó hasta que el
usuario miró la app real.

## Corrección

Sin cambios de código. Se le indicó al usuario agregar la variable en
el panel de Cloudflare Pages:

- Workers & Pages → proyecto **siga-web** → Settings → Environment
  variables → Production → agregar `VITE_MAPBOX_TOKEN` con el mismo
  valor del `.env` local.
- Re-desplegar (Retry deployment del último build) para que la
  variable nueva se tome en cuenta -- agregar la variable sola no
  actualiza lo ya publicado.

## Verificación

Confirmado contra `sigap.com.co` real (no local), descargando y
comparando el bundle JS servido antes/después:
- Antes: `assets/GeoMap-*.js` no contenía ninguna referencia a
  `api.mapbox.com` ni al token -- solo la rama de OpenStreetMap.
- Después de que el usuario agregó la variable y Cloudflare
  redesplegó: el hash del bundle principal cambió (confirma build
  nuevo), y el nuevo `GeoMap-*.js` sí contiene
  `api.mapbox.com/styles/v1/mapbox/streets-v12` con el token real
  embebido (no `undefined`).
- Se confirmó además que ese token responde `200` al pedir un tile
  real directamente a Mapbox.

## Lección para cualquier variable `VITE_*` nueva en el futuro

Agregar una variable a `.env`/`.env.example` documenta el formato para
desarrollo local, pero **no alcanza para producción** -- cualquier
`VITE_*` nueva que el build necesite tiene que agregarse también en el
panel de Cloudflare Pages del proyecto, y no toma efecto hasta el
siguiente build/deploy. Ver
[[feedback_env_var_produccion_necesita_cloudflare_pages]] (memoria
nueva).
