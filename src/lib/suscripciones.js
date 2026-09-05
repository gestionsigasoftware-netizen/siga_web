import { hoyBogota, fechaBogota, inicioDiaBogota } from "./fechaBogota";

// Estado de una suscripcion, calculado siempre a partir de fechas (nunca
// guardado) -- ver supabase/suscripciones.sql para el porque.
export function calcularEstadoSuscripcion(suscripcion) {
  if (!suscripcion) return 'sin_configurar'
  const hoy = hoyBogota()
  if (hoy <= suscripcion.fecha_proximo_pago) return 'activa'
  const diasGraciaMs = Number(suscripcion.dias_gracia || 0) * 86400000
  const limiteGracia = fechaBogota(new Date(inicioDiaBogota(suscripcion.fecha_proximo_pago).getTime() + diasGraciaMs))
  if (hoy <= limiteGracia) return 'en_gracia'
  return 'bloqueada'
}
