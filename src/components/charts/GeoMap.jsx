import { Fragment, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const COLOMBIA_CENTER = [4.5709, -74.2973]
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// El prop `bounds` de MapContainer no siempre gana contra `center`/`zoom`
// en el montaje inicial -- se ajusta la vista explicitamente con
// fitBounds via useMap(), que es el patron confiable documentado por
// react-leaflet para esto.
function AjustarVista({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [32, 32] })
  }, [map, bounds])
  return null
}

// Estilos propios del modo `premium`, aislados bajo .geomap-premium para
// no afectar los otros mapas (Distritos, Evangelismo) que usan este mismo
// componente en su modo normal. Se define una sola vez, no por instancia.
// Los controles/tooltips se quedan en vidrio oscuro a propósito: leen bien
// encima de cualquier mosaico (claro u oscuro), como un panel flotante de
// verdad en vez de fundirse con el mapa de fondo.
const PREMIUM_STYLE = `
.geomap-premium .leaflet-control-zoom { border: none; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.45); }
.geomap-premium .leaflet-control-zoom a { background: rgba(15,23,42,0.82); backdrop-filter: blur(6px); color: #EAF1FA; border-color: rgba(255,255,255,0.12) !important; }
.geomap-premium .leaflet-control-zoom a:hover { background: rgba(42,120,214,0.9); }
.geomap-premium .leaflet-control-attribution { background: rgba(10,18,36,0.55); color: rgba(234,241,250,0.65); border-radius: 6px 0 0 0; }
.geomap-premium .leaflet-control-attribution a { color: rgba(234,241,250,0.85); }
.geomap-premium .leaflet-tooltip { background: rgba(10,18,36,0.88); backdrop-filter: blur(8px); color: #EAF1FA; border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; box-shadow: 0 12px 28px -10px rgba(0,0,0,0.5); }
.geomap-premium .leaflet-tooltip-top:before { border-top-color: rgba(10,18,36,0.88); }

/* Anillo "en vivo" alrededor de cada punto: crece y se desvanece en bucle,
   como el punto de ubicación en tiempo real de apps tipo Uber/Waze. Cada
   punto usa uno de 4 retrasos (siga-pulse-delay-0..3) para que no todos
   pulsen al mismo tiempo -- se ve como actividad real, no un parpadeo
   sincronizado artificial. transform-box:fill-box es necesario para que
   el origen de la transformación sea el centro del círculo SVG, no la
   esquina superior izquierda de su bounding box (comportamiento por
   defecto de SVG). */
.geomap-premium .siga-pulse-ring { transform-box: fill-box; transform-origin: center; animation: siga-map-pulse 2.4s cubic-bezier(0.15, 0.6, 0.35, 1) infinite; }
.geomap-premium .siga-pulse-delay-0 { animation-delay: 0s; }
.geomap-premium .siga-pulse-delay-1 { animation-delay: 0.6s; }
.geomap-premium .siga-pulse-delay-2 { animation-delay: 1.2s; }
.geomap-premium .siga-pulse-delay-3 { animation-delay: 1.8s; }
@keyframes siga-map-pulse { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .geomap-premium .siga-pulse-ring { animation: none; opacity: 0.25; }
}
`

// Mapa con puntos de tamano/color segun un valor (personas por zona,
// congregaciones por ciudad, etc.). Solo se muestran los puntos que ya
// tienen coordenadas -- nunca se adivina una ubicacion.
//
// `premium`: mosaico real de Mapbox (cuenta propia del usuario --
// VITE_MAPBOX_TOKEN, capa gratuita hasta 50,000 cargas/mes), estilo
// `streets-v12` -- se probo primero `navigation-day-v1` (mas limpio,
// tipo Uber/Waze) pero el usuario senalo que asi no se ven suficientes
// sitios reales (iglesias, colegios, entidades publicas) -- comparado
// en vivo contra streets-v12 en Puerto Tejada: navigation-day-v1 solo
// mostraba un puñado de colegios/salud, streets-v12 mostraba ademas
// comercios, canchas, un colegio evangelico, contorno de edificios y
// mucho mas detalle por categoria. A nivel nacional/distrital (zoom
// alejado) esta densidad de POIs no compite con los puntos de
// congregaciones porque Mapbox no dibuja iconos de POI hasta acercarse
// a nivel de calle -- que es justo donde mas importa verlos. Se
// probaron antes CartoDB (su CDN gratuito ahora exige API key) y Esri
// World Imagery/Dark Gray (tecnicamente responde sin clave, pero sus
// terminos prohiben usarlo gratis en una app que genera ingresos como
// SIGAP) -- ninguno de los dos era legal ni estable para produccion.
// Si VITE_MAPBOX_TOKEN no esta configurado, se degrada solo a
// OpenStreetMap estandar (el mismo de siempre) en vez de romperse.
// Opt-in para no cambiarle la apariencia a los mapas que ya existian
// sin que nadie lo pidiera. Cada punto lleva un anillo que pulsa en
// bucle (ver PREMIUM_STYLE) -- la señal "en vivo" pedida desde el
// diseño original.
export default function GeoMap({ points, colorHex = '#2a78d6', height = 320, premium = false }) {
  const validPoints = points.filter((point) => Number.isFinite(point.latitud) && Number.isFinite(point.longitud))
  if (validPoints.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm rounded-card bg-surface-1 text-muted" style={{ height }}>
        Aún no hay direcciones registradas para mostrar en el mapa.
      </div>
    )
  }
  const maxValor = Math.max(1, ...validPoints.map((point) => point.valor || 1))
  // Con 1 solo punto no hay nada que "encuadrar" -- se centra ahi con un
  // zoom razonable de barrio. Con 2+ se ajusta la vista automaticamente
  // al grupo de puntos (via AjustarVista/fitBounds), en vez de un zoom
  // fijo que se ve muy alejado cuando los puntos estan cerca entre si
  // (ej. zonas de una misma ciudad) o corta puntos cuando estan lejos
  // (ej. congregaciones en ciudades distintas).
  const bounds = validPoints.length > 1 ? validPoints.map((point) => [point.latitud, point.longitud]) : null
  const center = validPoints.length === 1 ? [validPoints[0].latitud, validPoints[0].longitud] : COLOMBIA_CENTER
  const zoom = validPoints.length === 1 ? 14 : 6

  return (
    <div style={{ height }} className={`rounded-card overflow-hidden border ${premium ? 'border-transparent' : 'border-border'}`}>
      {premium && <style>{PREMIUM_STYLE}</style>}
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} className={premium ? 'geomap-premium' : ''}>
        {bounds && <AjustarVista bounds={bounds} />}
        {premium && MAPBOX_TOKEN ? (
          <TileLayer
            attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
            tileSize={512}
            zoomOffset={-1}
          />
        ) : (
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        )}
        {validPoints.map((point, index) => {
          const radius = 6 + (14 * (point.valor || 1)) / maxValor
          return (
            <Fragment key={point.id}>
              {premium && (
                // className (y aca tambien interactive) van como props
                // directas del componente, NO dentro de pathOptions: react-
                // leaflet aplica pathOptions vía layer.setStyle() DESPUES de
                // que Leaflet ya creo el elemento SVG, pero Leaflet solo lee
                // options.className (y options.interactive, para la clase
                // leaflet-interactive) al crearlo por primera vez -- un
                // cambio posterior via setStyle nunca vuelve a tocar la
                // clase. Puesta asi, sin pathOptions, llega a tiempo.
                <CircleMarker
                  center={[point.latitud, point.longitud]}
                  radius={radius + 7}
                  interactive={false}
                  className={`siga-pulse-ring siga-pulse-delay-${index % 4}`}
                  pathOptions={{ color: 'transparent', fillColor: colorHex, fillOpacity: 0.5, weight: 0 }}
                />
              )}
              <CircleMarker center={[point.latitud, point.longitud]} radius={radius} pathOptions={{ color: premium ? '#0A1428' : colorHex, fillColor: colorHex, fillOpacity: premium ? 0.9 : 0.45, weight: premium ? 1.5 : 2 }}>
                <Tooltip direction="top" offset={[0, -radius]}>
                  <strong>{point.label}</strong>
                  {point.detalle && <><br />{point.detalle}</>}
                </Tooltip>
              </CircleMarker>
            </Fragment>
          )
        })}
      </MapContainer>
    </div>
  )
}
