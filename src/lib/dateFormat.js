// Formatea fechas numericas respetando la preferencia personal DD/MM/AAAA o
// MM/DD/AAAA (src/pages/ConfiguracionSistema.jsx). Solo aplica donde el orden
// dia/mes es ambiguo; los formatos con mes escrito (ej. "25 ago 2026") no lo
// necesitan porque no hay ambiguedad que resolver.
export function formatFecha(value, { formato = 'DD/MM/AAAA', conHora = false } = {}) {
  if (!value) return 'Sin datos'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin datos'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const datePart = formato === 'MM/DD/AAAA' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`
  if (!conHora) return datePart
  const time = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${time}`
}
