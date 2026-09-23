import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const COLOMBIA_CENTER = [4.5709, -74.2973]
const ZOOM_SIN_UBICAR = 6
const ZOOM_UBICADO = 16

function ClicParaUbicar({ onChange }) {
  useMapEvents({ click(e) { onChange(e.latlng.lat, e.latlng.lng) } })
  return null
}

// MapContainer solo lee `center`/`zoom` en el montaje inicial (mismo
// motivo que AjustarVista en GeoMap.jsx) -- un salto posterior (cuando
// el geocodificador encuentra un punto nuevo) necesita moverse a mano
// via useMap(). Se dispara solo con `recenterKey` (no con latitud/
// longitud directamente) para no recentrar el mapa en cada clic manual
// del usuario, que ya está mirando la zona correcta.
function CentrarEnPunto({ latitud, longitud, recenterKey }) {
  const map = useMap()
  useEffect(() => {
    if (Number.isFinite(latitud) && Number.isFinite(longitud)) {
      map.setView([latitud, longitud], ZOOM_UBICADO)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])
  return null
}

// Mapa de un solo punto, editable a mano: clic en cualquier parte del
// mapa coloca o mueve el pin ahí. La geocodificación automática
// (src/lib/geocoding.js, Nominatim) solo da un punto de partida -- no
// siempre tiene el detalle de calle de poblaciones pequeñas -- así que
// la ubicación real y verificable de cada congregación depende de que
// alguien que conoce el lugar confirme o ajuste el pin aquí. Se usa
// CircleMarker (no Marker+ícono) a propósito: evita el bug clásico de
// Leaflet con bundlers donde el ícono por defecto del pin se rompe por
// rutas de asset relativas, y mantiene el mismo lenguaje visual que el
// resto de mapas de SIGAP.
export default function MapaUbicacionEditable({ latitud, longitud, onChange, recenterKey, height = 280 }) {
  const tieneUbicacion = Number.isFinite(latitud) && Number.isFinite(longitud)
  const center = tieneUbicacion ? [latitud, longitud] : COLOMBIA_CENTER
  const zoom = tieneUbicacion ? ZOOM_UBICADO : ZOOM_SIN_UBICAR

  return (
    <div style={{ height }} className="rounded-card overflow-hidden border border-border">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClicParaUbicar onChange={onChange} />
        <CentrarEnPunto latitud={latitud} longitud={longitud} recenterKey={recenterKey} />
        {tieneUbicacion && (
          <CircleMarker center={[latitud, longitud]} radius={10} pathOptions={{ color: '#0A1428', fillColor: '#2a78d6', fillOpacity: 0.85, weight: 2 }} />
        )}
      </MapContainer>
    </div>
  )
}
