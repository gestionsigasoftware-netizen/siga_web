// SIGA - Calculo de rangos de trimestre calendario (T1 ene-mar ... T4
// oct-dic) para el Informe Trimestral (Bautizados, Sellados,
// Reconciliados, Entregados). Sin libreria externa de fechas: aritmetica
// pura sobre año/mes usando Date.UTC.
import { hoyBogota } from './fechaBogota'

export const ETIQUETA_TRIMESTRE = { 1: 'T1 (Ene-Mar)', 2: 'T2 (Abr-Jun)', 3: 'T3 (Jul-Sep)', 4: 'T4 (Oct-Dic)' }

export function trimestreDe(fechaCivil) {
  const [anioStr, mesStr] = fechaCivil.split('-')
  const anio = Number(anioStr)
  const trimestre = Math.floor((Number(mesStr) - 1) / 3) + 1
  return { anio, trimestre }
}

export function trimestreActual(fechaCivil = hoyBogota()) {
  return trimestreDe(fechaCivil)
}

export function trimestreAnterior(anio, trimestre) {
  return trimestre === 1 ? { anio: anio - 1, trimestre: 4 } : { anio, trimestre: trimestre - 1 }
}

// El ultimo trimestre ya cerrado -- un trimestre a medias no tiene
// sentido reportarlo todavia; el usuario puede navegar a cualquier otro
// (incluido el actual) con los selectores de la pantalla.
export function trimestreCerradoMasReciente(fechaCivil = hoyBogota()) {
  const actual = trimestreActual(fechaCivil)
  return trimestreAnterior(actual.anio, actual.trimestre)
}

const pad2 = (n) => String(n).padStart(2, '0')
// Date.UTC(anio, mes, 0) da el ultimo dia del mes "mes" (1..12), porque el
// dia 0 de un mes JS (0-indexado) es el ultimo dia del mes anterior.
const ultimoDiaDeMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()

export function rangoTrimestre(anio, trimestre) {
  const mesInicio = (trimestre - 1) * 3 + 1
  const mesFin = mesInicio + 2
  return {
    desde: `${anio}-${pad2(mesInicio)}-01`,
    hasta: `${anio}-${pad2(mesFin)}-${pad2(ultimoDiaDeMes(anio, mesFin))}`,
  }
}

// API principal que consumen las pantallas: dado el trimestre elegido,
// arma los 4 parametros que esperan las funciones SQL
// resumen_informe_trimestral_*.
export function limitesInformeTrimestral(anio, trimestre) {
  const actual = rangoTrimestre(anio, trimestre)
  const previo = trimestreAnterior(anio, trimestre)
  const anteriorRango = rangoTrimestre(previo.anio, previo.trimestre)
  return {
    p_desde: actual.desde,
    p_hasta: actual.hasta,
    p_desde_anterior: anteriorRango.desde,
    p_hasta_anterior: anteriorRango.hasta,
  }
}
