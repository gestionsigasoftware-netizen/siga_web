// Avatar de iniciales compartido por todas las vistas de tipo censo
// (Feligresia, Personas, Amigos, etc.) -- un mismo id siempre cae en el
// mismo tono sin importar la pantalla, para que la identidad visual sea
// consistente en toda la app.
const AVATAR_PALETTE = [
  { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#EAF3DE', fg: '#173404' },
  { bg: '#FAEEDA', fg: '#412402' },
  { bg: '#F1EAFB', fg: '#4B2C82' },
  { bg: '#FCEBEB', fg: '#501313' },
  { bg: '#E1F1EF', fg: '#0E4A44' },
]

export function avatarTone(id) {
  let hash = 0
  const value = id || ''
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

// Sirve tanto para personas (nombres + apellidos separados, ej.
// Feligresia/Personas) como para registros con un solo campo de nombre
// completo (ej. amigos.nombres en la Ruta Evangelistica) -- en ese
// segundo caso toma las primeras letras de las dos primeras palabras.
export function initialesDe(persona) {
  const nombres = (persona?.nombres || '').trim()
  const apellidos = (persona?.apellidos || '').trim()
  if (apellidos) return `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase() || '?'
  const palabras = nombres.split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return '?'
  if (palabras.length === 1) return palabras[0].charAt(0).toUpperCase()
  return `${palabras[0].charAt(0)}${palabras[1].charAt(0)}`.toUpperCase()
}
