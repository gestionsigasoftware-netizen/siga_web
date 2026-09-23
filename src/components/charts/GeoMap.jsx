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
const PREMIUM_STYLE = `
.geomap-premium .leaflet-control-zoom { border: none; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.45); }
.geomap-premium .leaflet-control-zoom a { background: rgba(15,23,42,0.82); backdrop-filter: blur(6px); color: #EAF1FA; border-color: rgba(255,255,255,0.12) !important; }
.geomap-premium .leaflet-control-zoom a:hover { background: rgba(42,120,214,0.9); }
.geomap-premium .leaflet-control-attribution { background: rgba(10,18,36,0.55); color: rgba(234,241,250,0.65); border-radius: 6px 0 0 0; }
.geomap-premium .leaflet-control-attribution a { color: rgba(234,241,250,0.85); }
.geomap-premium .leaflet-tooltip { background: rgba(10,18,36,0.88); backdrop-filter: blur(8px); color: #EAF1FA; border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; box-shadow: 0 12px 28px -10px rgba(0,0,0,0.5); }
.geomap-premium .leaflet-tooltip-top:before { border-top-color: rgba(10,18,36,0.88); }
`

// Mapa con puntos de tamano/color segun un valor (personas por zona,
// congregaciones por ciudad, etc.). Solo se muestran los puntos que ya
// tienen coordenadas -- nunca se adivina una ubicacion.
//
// `premium`: mosaico oscuro real (Mapbox dark-v11, cuenta propia del
// usuario -- VITE_MAPBOX_TOKEN, capa gratuita hasta 50,000 cargas/mes)
// + halo de brillo en cada punto + controles/tooltips rediseñados
// (vidrio oscuro). Se probaron antes CartoDB (su CDN gratuito ahora
// exige API key) y Esri World Imagery/Dark Gray (tecnicamente responde
// sin clave, pero sus terminos prohiben usarlo gratis en una app que
// genera ingresos como SIGAP) -- ninguno de los dos era legal ni
// estable para produccion. Si VITE_MAPBOX_TOKEN no esta configurado,
// se degrada solo a OpenStreetMap estandar (el mismo de siempre) en
// vez de romperse. Opt-in para no cambiarle la apariencia a los mapas
// que ya existian (Distritos, Evangelismo) sin que nadie lo pidiera.
export default function GeoMap({ points, colorHex = '#2a78d6', height = 320, premium = false }) {
  const validPoints = points.filter((point) => Number.isFinite(point.latitud) && Number.isFinite(point.longitud))
  if (validPoints.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm rounded-card ${premium ? 'bg-[#0A1428] text-white/50' : 'bg-surface-1 text-muted'}`} style={{ height }}>
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
            url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
            tileSize={512}
            zoomOffset={-1}
          />
        ) : (
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        )}
        {validPoints.map((point) => {
          const radius = 6 + (14 * (point.valor || 1)) / maxValor
          return (
            <Fragment key={point.id}>
              {premium && (
                <CircleMarker center={[point.latitud, point.longitud]} radius={radius + 7} pathOptions={{ color: 'transparent', fillColor: colorHex, fillOpacity: 0.16, weight: 0, interactive: false }} />
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
