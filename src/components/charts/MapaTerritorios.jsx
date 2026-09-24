import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, useMap } from 'react-leaflet'
import { circle } from '@turf/circle'
import { union } from '@turf/union'
import { featureCollection } from '@turf/helpers'
import { area } from '@turf/area'
import 'leaflet/dist/leaflet.css'

const COLOMBIA_CENTER = [4.5709, -74.2973]
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// Mismo patron que AjustarVista en GeoMap.jsx -- MapContainer solo lee
// center/zoom en el montaje inicial, un encuadre posterior necesita
// moverse a mano via useMap()/fitBounds.
function AjustarVista({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [32, 32] })
  }, [map, bounds])
  return null
}

// Mismo lenguaje visual que GeoMap.jsx (vidrio oscuro para controles y
// tooltips, legible sobre cualquier mosaico) -- se copia aqui en vez de
// modificar GeoMap.jsx, que ya esta verificado en produccion y resuelve
// un problema distinto (puntos, no poligonos).
const PREMIUM_STYLE = `
.mapaterritorios-premium .leaflet-control-zoom { border: none; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.45); }
.mapaterritorios-premium .leaflet-control-zoom a { background: rgba(15,23,42,0.82); backdrop-filter: blur(6px); color: #EAF1FA; border-color: rgba(255,255,255,0.12) !important; }
.mapaterritorios-premium .leaflet-control-zoom a:hover { background: rgba(42,120,214,0.9); }
.mapaterritorios-premium .leaflet-control-attribution { background: rgba(10,18,36,0.55); color: rgba(234,241,250,0.65); border-radius: 6px 0 0 0; }
.mapaterritorios-premium .leaflet-control-attribution a { color: rgba(234,241,250,0.85); }
.mapaterritorios-premium .leaflet-tooltip { background: rgba(10,18,36,0.9); backdrop-filter: blur(8px); color: #EAF1FA; border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; box-shadow: 0 12px 28px -10px rgba(0,0,0,0.5); font-size: 12px; }
.mapaterritorios-premium .leaflet-tooltip-top:before { border-top-color: rgba(10,18,36,0.9); }
`

// Genera un color distinto por indice via el angulo dorado (137.508deg)
// -- separa bien colores adyacentes incluso para muchas categorias (los
// ~36 distritos de la IPUC) sin tener que mantener una paleta fija a mano.
function colorPorIndice(indice) {
  const hue = (indice * 137.508) % 360
  return `hsl(${hue.toFixed(1)}, 60%, 48%)`
}

// Aproxima el "territorio" de cada distrito como la union de un circulo
// de alcance alrededor de cada una de sus congregaciones -- NO es un
// limite oficial (los distritos de la IPUC son una division interna,
// sin poligono propio guardado en ningun lado). Donde no hay mancha de
// ningun distrito, no hay ninguna congregacion cerca -- esa ausencia es
// la senal util para decidir donde enviar mision, no un error del mapa.
export default function MapaTerritorios({ congregaciones, radioKm = 15, height = 480 }) {
  const validas = congregaciones.filter((c) => Number.isFinite(c.latitud) && Number.isFinite(c.longitud) && c.distrito_id)

  const territoriosFC = useMemo(() => {
    const porDistrito = new Map()
    for (const c of validas) {
      if (!porDistrito.has(c.distrito_id)) porDistrito.set(c.distrito_id, { numero: c.distrito_numero, congregaciones: [] })
      porDistrito.get(c.distrito_id).congregaciones.push(c)
    }
    const distritosOrdenados = [...porDistrito.keys()].sort(
      (a, b) => (porDistrito.get(a).numero ?? 0) - (porDistrito.get(b).numero ?? 0),
    )
    const features = distritosOrdenados
      .map((distritoId, indice) => {
        const grupo = porDistrito.get(distritoId)
        const circulos = grupo.congregaciones.map((c) => circle([c.longitud, c.latitud], radioKm, { steps: 32, units: 'kilometers' }))
        const figura = circulos.length === 1 ? circulos[0] : union(featureCollection(circulos))
        if (!figura) return null
        return {
          type: 'Feature',
          geometry: figura.geometry,
          properties: {
            distritoId,
            numero: grupo.numero,
            color: colorPorIndice(indice),
            totalCongregaciones: grupo.congregaciones.length,
            areaKm2: Math.round(area(figura) / 1_000_000),
          },
        }
      })
      .filter(Boolean)
    return { type: 'FeatureCollection', features }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [congregaciones, radioKm])

  if (validas.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm rounded-card bg-surface-1 text-muted" style={{ height }}>
        Aún no hay congregaciones con ubicación y distrito para calcular territorio.
      </div>
    )
  }

  const bounds = validas.map((c) => [c.latitud, c.longitud])

  return (
    <div style={{ height }} className="rounded-card overflow-hidden border border-transparent">
      <style>{PREMIUM_STYLE}</style>
      <MapContainer center={COLOMBIA_CENTER} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} className="mapaterritorios-premium">
        <AjustarVista bounds={bounds} />
        {MAPBOX_TOKEN ? (
          <TileLayer
            attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
            tileSize={512}
            zoomOffset={-1}
          />
        ) : (
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        )}
        {/* key={radioKm} es necesario: el GeoJSON de react-leaflet crea la
            capa de Leaflet una sola vez al montar y no vuelve a leer `data`
            despues -- cambiar el radio sin esto dejaria las manchas viejas
            en pantalla. Forzando un remount con la key, el circulo/union se
            recalcula (arriba, en el useMemo) y el mapa dibuja las manchas
            correctas para el radio nuevo. */}
        <GeoJSON
          key={radioKm}
          data={territoriosFC}
          style={(feature) => ({
            fillColor: feature.properties.color,
            color: feature.properties.color,
            weight: 1.5,
            fillOpacity: 0.32,
          })}
          onEachFeature={(feature, layer) => {
            const { numero, totalCongregaciones, areaKm2 } = feature.properties
            layer.bindTooltip(
              `<strong>Distrito ${numero ?? '?'}</strong><br/>${totalCongregaciones} congregaci${totalCongregaciones === 1 ? 'ón' : 'ones'} · ~${areaKm2} km²`,
              { sticky: true },
            )
          }}
        />
        {validas.map((c) => (
          <CircleMarker
            key={c.id}
            center={[c.latitud, c.longitud]}
            radius={4}
            pathOptions={{ color: '#0A1428', fillColor: '#FFFFFF', fillOpacity: 0.9, weight: 1.5 }}
          />
        ))}
      </MapContainer>
    </div>
  )
}
