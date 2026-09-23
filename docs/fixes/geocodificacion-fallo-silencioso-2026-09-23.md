# Geocodificación fallaba en silencio al guardar dirección -- 2026-09-23

## Reporte original del usuario

Llenó ciudad y dirección de Puerto Tejada en Configuración, pero la
congregación seguía sin aparecer en el mapa de presencia (Impacto
Misionero) recién construido. Preguntó si hacía falta la Fase 2
(mapa por municipios) para que funcionara.

## Diagnóstico

No tenía nada que ver con la Fase 2 (esa es para un mapa coroplético
por municipio; el mapa de puntos ya construido solo necesita
`latitud`/`longitud`). Se confirmó contra producción real que Puerto
Tejada sí tenía `ciudad` y `direccion` guardadas, pero
`latitud`/`longitud` seguían en `null`.

Causa: `geocodeAddress()` (`src/lib/geocoding.js`) llama a Nominatim
(OpenStreetMap) con la dirección completa. Para direcciones urbanas
específicas de poblaciones pequeñas -- como
`Carrera 21 No. 20C-50/54, Barrio La Esperanza, Puerto Tejada, Cauca` --
Nominatim con frecuencia no tiene ese nivel de detalle y devuelve una
lista vacía. La función entonces devolvía `null`, y
`Configuracion.jsx` guardaba la congregación igual, con
`latitud: null, longitud: null`, mostrando el mismo mensaje de éxito
de siempre ("Información y preferencias de la congregación
guardadas.") -- sin ninguna señal de que la ubicación en el mapa había
fallado. Confirmado en vivo contra el propio Nominatim: la dirección
completa de Puerto Tejada devuelve `[]`, pero buscar solo
"Puerto Tejada, Cauca, Colombia" sí devuelve coordenadas reales.

## Corrección

**`src/lib/geocoding.js`**: `geocodeAddress()` ahora intenta primero
la dirección completa y, si no encuentra nada, reintenta solo con la
ciudad (mucho más probable que Nominatim la tenga). El resultado
incluye `aproximado: true` cuando se usó el respaldo por ciudad, para
poder avisarlo.

**`src/pages/Configuracion.jsx`**: el mensaje al guardar ahora
distingue tres casos:
- Ubicación exacta encontrada → mensaje normal de siempre.
- Solo se encontró por ciudad → "Guardado. No se encontró la
  dirección exacta, así que se ubicó de forma aproximada por ciudad
  en el mapa."
- No se encontró nada (ni siquiera por ciudad) → "Guardado, pero no
  se pudo ubicar esa dirección en el mapa. Revisa que esté bien
  escrita..." -- en vez de fingir que todo salió bien.

## Verificación

- `npm run build` sin errores.
- Confirmado en vivo contra el propio Nominatim (no requiere cuenta
  de SIGAP, es un servicio público): la dirección completa de Puerto
  Tejada devuelve `[]`; "Puerto Tejada, Cauca, Colombia" sí devuelve
  coordenadas reales (`3.2288972, -76.4192267`).
- **Pendiente de que el usuario lo confirme**: el fix no corrige
  retroactivamente los `latitud`/`longitud` ya guardados en `null` --
  aplica solo la próxima vez que se guarde Configuración. Puerto
  Tejada necesita que alguien vuelva a guardar esa pantalla (sin
  cambiar nada más) para que quede ubicada en el mapa.
