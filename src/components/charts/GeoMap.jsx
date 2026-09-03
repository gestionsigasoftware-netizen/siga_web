import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const COLOMBIA_CENTER = [4.5709, -74.2973]

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

// Mapa con puntos de tamano/color segun un valor (personas por zona,
// congregaciones por ciudad, etc.). Solo se muestran los puntos que ya
// tienen coordenadas -- nunca se adivina una ubicacion.
export default function GeoMap({ points, colorHex = '#2a78d6', height = 320 }) {
  const validPoints = points.filter((point) => Number.isFinite(point.latitud) && Number.isFinite(point.longitud))
  if (validPoints.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted bg-surface-1 rounded-card" style={{ height }}>
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
    <div style={{ height }} className="rounded-card overflow-hidden border border-border">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        {bounds && <AjustarVista bounds={bounds} />}
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {validPoints.map((point) => {
          const radius = 6 + (14 * (point.valor || 1)) / maxValor
          return (
            <CircleMarker key={point.id} center={[point.latitud, point.longitud]} radius={radius} pathOptions={{ color: colorHex, fillColor: colorHex, fillOpacity: 0.45, weight: 2 }}>
              <Tooltip direction="top" offset={[0, -radius]}>
                <strong>{point.label}</strong>
                {point.detalle && <><br />{point.detalle}</>}
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
