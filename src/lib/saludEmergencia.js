// Compartido entre Feligresía (personas) y Amigos -- clasifica a alguien
// en categorías de prioridad para una respuesta de emergencia (niño,
// adulto mayor, embarazada, condición médica, alergia, discapacidad).
// No es una clasificación médica ni etaria oficial de la IPUC: los
// umbrales de edad son un corte operativo, ajustar aquí si hace falta.
export const TIPO_SANGRE_OPCIONES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export const EDAD_NINO_MAXIMA = 12
export const EDAD_ADULTO_MAYOR_MINIMA = 60

// `persona` es cualquier registro con los campos de salud (misma forma en
// personas y en amigos); `edad` se recibe calculada porque cada archivo ya
// tiene su propia función de edad a partir de fecha_nacimiento.
export function categoriasPrioridad(persona, edad) {
  const categorias = []
  if (edad !== null && edad !== undefined) {
    if (edad < EDAD_NINO_MAXIMA) categorias.push({ key: 'nino', label: 'Niño/a' })
    else if (edad >= EDAD_ADULTO_MAYOR_MINIMA) categorias.push({ key: 'adulto_mayor', label: 'Adulto mayor' })
  }
  if (persona?.embarazada) categorias.push({ key: 'embarazada', label: 'Embarazada' })
  if (persona?.condiciones_medicas?.trim()) categorias.push({ key: 'condicion_cronica', label: 'Condición médica' })
  if (persona?.alergias?.trim()) categorias.push({ key: 'alergia', label: 'Alergia' })
  if (persona?.discapacidad?.trim()) categorias.push({ key: 'discapacidad', label: 'Discapacidad' })
  return categorias
}
