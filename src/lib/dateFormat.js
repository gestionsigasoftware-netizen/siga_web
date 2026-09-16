// Formatea fechas numericas respetando la preferencia personal DD/MM/AAAA o
// MM/DD/AAAA (src/pages/ConfiguracionSistema.jsx). Solo aplica donde el orden
// dia/mes es ambiguo; los formatos con mes escrito (ej. "25 ago 2026") no lo
// necesitan porque no hay ambiguedad que resolver.
export function formatFecha(value, { formato = 'DD/MM/AAAA', conHora = false } = {}) {
  if (!value) return 'Sin datos'
  // Acepta también un Date ya construido (varios llamadores pasan uno) --
  // sin esto, .includes() de abajo revienta porque Date no es string.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return 'Sin datos'
    return formatFecha(value.toISOString(), { formato, conHora })
  }
  // Un valor de solo fecha ("2026-09-10", sin hora) lo interpreta el
  // motor de JS como medianoche UTC -- en cualquier zona detras de UTC
  // (Colombia es UTC-5, todo el año) eso cae en el día anterior al
  // convertirse a hora local, así que un campo `date` de Postgres se
  // veía sistemáticamente un día atrás. Agregar T00:00:00 (sin Z) para
  // fechas sin hora fuerza a interpretarlo en hora local -- mismo
  // arreglo que ya usa formatearFechaLarga() en los certificados. Los
  // timestamps completos (con hora, ej. creado_en) no se tocan.
  if (typeof value !== 'string') return 'Sin datos'
  const date = new Date(!value.includes('T') ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return 'Sin datos'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const datePart = formato === 'MM/DD/AAAA' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`
  if (!conHora) return datePart
  const time = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${time}`
}
