// Estado de una suscripcion, calculado siempre a partir de fechas (nunca
// guardado) -- ver supabase/suscripciones.sql para el porque.
export function calcularEstadoSuscripcion(suscripcion) {
  if (!suscripcion) return 'sin_configurar'
  const hoy = new Date().toISOString().slice(0, 10)
  const limiteGracia = new Date(suscripcion.fecha_proximo_pago)
  limiteGracia.setDate(limiteGracia.getDate() + Number(suscripcion.dias_gracia || 0))
  if (hoy <= suscripcion.fecha_proximo_pago) return 'activa'
  if (hoy <= limiteGracia.toISOString().slice(0, 10)) return 'en_gracia'
  return 'bloqueada'
}
