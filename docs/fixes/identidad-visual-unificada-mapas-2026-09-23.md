# Misma identidad visual en todos los mapas de SIGAP

**Fecha:** 2026-09-23
**Módulos:** Evangelismo, Gestión de Distritos, Configuración (local)

## Contexto

El mapa premium (mosaico Mapbox `navigation-day-v1` + pulso en vivo +
controles rediseñados) se construyó primero solo para Impacto
Misionero. El usuario pidió unificar ese mismo tratamiento en el resto
de SIGAP donde ya había mapas: Evangelismo (zonas/barrios) y Gestión de
Distritos (mapa nacional de congregaciones), que seguían con el
OpenStreetMap estándar de siempre.

## Cambios

- **`src/pages/Evangelismo.jsx`**: el mapa de "Zonas en el mapa" ahora
  usa `<GeoMap ... height={420} premium colorHex="#5B9BE0" />` -- antes
  se llamaba sin ningún prop extra (mosaico básico, radio por defecto).
- **`src/pages/GestionDistritos.jsx`**: el "Mapa nacional de
  congregaciones" recibe el mismo `premium colorHex="#5B9BE0"`. De paso
  se corrigió el texto de ayuda ("Ubicación aproximada, según la
  dirección...") que ya no era exacto tras el fix de ajuste manual del
  mismo día (`docs/fixes/ubicacion-congregacion-ajuste-manual-2026-09-23.md`)
  -- ahora dice que puede ser exacta (pin ajustado) o aproximada
  (todavía no ajustado).
- **`src/components/charts/MapaUbicacionEditable.jsx`** (el mapa
  editable de Configuración, agregado hoy mismo antes de este ajuste):
  ahora usa el mismo mosaico Mapbox (con el mismo fallback a
  OpenStreetMap si no hay `VITE_MAPBOX_TOKEN`) y el mismo azul
  (`#5B9BE0`) para el pin. **A propósito sin el anillo de pulso**: este
  mapa siempre tiene como máximo un punto y representa una ubicación
  confirmada/estática (la dirección real de la congregación), no
  actividad en tiempo real -- un pulso ahí sugeriría algo que no es.

Ningún cambio de SQL ni de CSP -- mismo dominio `api.mapbox.com` ya
autorizado, mismas columnas de coordenadas ya existentes.

## Ajuste de estilo el mismo día: `navigation-day-v1` → `streets-v12`

El usuario probó el resultado y notó que se veían muy pocos sitios
reales (iglesias, colegios, estaciones de policía, fiscalía,
alcaldías...) -- `navigation-day-v1` está optimizado para navegación en
carretera, no para mostrar puntos de interés. Se comparó en vivo contra
`streets-v12` en el centro de Puerto Tejada (zoom de calle, vía la API
estática de Mapbox): `navigation-day-v1` solo mostraba un puñado de
colegios/salud; `streets-v12` mostraba además comercios, una cancha, un
colegio evangélico ("Ebenezer"), contorno de edificios y mucho más
detalle por categoría. Se verificó también a zoom nacional/distrital
(6-8) que `streets-v12` no agrega ruido ahí -- Mapbox no dibuja íconos
de POI hasta acercarse a nivel de calle, así que no hay contrapartida
visible a la escala en que se usan los mapas de SIGAP la mayor parte
del tiempo. Cambiado en los tres lugares (`GeoMap.jsx`,
`MapaUbicacionEditable.jsx`) al mismo tiempo, sin necesidad de tocar
CSP (mismo dominio `api.mapbox.com`).

## Verificación

- Ruta pública temporal con los dos tipos de mapa lado a lado (premium
  con pulso vs. editable sin pulso, ambos con el mismo mosaico),
  `npm run build` + `npm run dev` + captura con Playwright. Confirmado
  visualmente: mismo mosaico, mismo estilo de pin, controles de zoom
  con el mismo vidrio oscuro en los tres lugares.
- Comparación directa `navigation-day-v1` vs `streets-v12` con la API
  estática de Mapbox (sin pasar por la app) en Puerto Tejada a zoom de
  calle y a zoom nacional, confirmando la decisión con imágenes reales
  antes de cambiar el código.
- Archivos, ruta e imágenes temporales eliminados al terminar; `git
  diff src/App.jsx` confirmado vacío.
