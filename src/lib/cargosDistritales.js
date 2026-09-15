export const CARGO_DISTRITAL_LABELS = {
  supervisor: 'Supervisor',
  secretario: 'Secretario',
  tesorero: 'Tesorero',
  presbitero_a: 'Presbítero A',
  presbitero_b: 'Presbítero B',
  veedor: 'Veedor',
  otro: 'Otro',
}

// Los 6 cargos obligatorios de la junta distrital -- "otro" no cuenta
// para la meta de 6, es un cajón de sastre para cargos no catalogados.
export const CARGOS_DISTRITALES_REQUERIDOS = Object.keys(CARGO_DISTRITAL_LABELS).filter((cargo) => cargo !== 'otro')
