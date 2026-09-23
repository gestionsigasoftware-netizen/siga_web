// Geocodificacion de direcciones a coordenadas aproximadas, via Nominatim
// (OpenStreetMap) -- gratis, sin API key, sin licencia comercial como el
// problema que tuvimos con Highcharts. Se limita a Colombia para mejorar
// precision. Uso previsto: 1 llamada puntual cuando alguien guarda una
// direccion nueva (no procesamiento masivo -- respeta el uso justo de
// Nominatim).

async function buscarNominatim(query) {
  if (!query.trim()) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=co&q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    if (!response.ok) return null
    const results = await response.json()
    const first = results?.[0]
    if (!first) return null
    return { latitud: Number(first.lat), longitud: Number(first.lon) }
  } catch {
    return null
  }
}

export async function geocodeAddress(direccion, ciudad) {
  const completa = await buscarNominatim([direccion, ciudad, 'Colombia'].filter(Boolean).join(', '))
  if (completa) return { ...completa, aproximado: false }
  // Nominatim no siempre tiene el detalle de calle de poblaciones
  // pequeñas -- antes esto dejaba la congregación sin ubicar en el
  // mapa, sin avisarle a nadie. Una ubicación aproximada por ciudad es
  // mejor que ninguna; se marca `aproximado` para poder decírselo a
  // quien guarda.
  if (ciudad?.trim()) {
    const porCiudad = await buscarNominatim([ciudad, 'Colombia'].filter(Boolean).join(', '))
    if (porCiudad) return { ...porCiudad, aproximado: true }
  }
  return null
}
