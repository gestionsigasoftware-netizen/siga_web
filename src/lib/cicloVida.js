// Embudo del ciclo de vida espiritual (Activos -> Bautizados -> Sellados
// -> Con cargo/comite) y tiempos promedio entre hitos. Compartido entre
// distrital y nacional — cada nivel solo cambia el alcance de las
// consultas a `personas` y `membresias_comite`.

function diasEntre(desde, hasta) {
  const dias = (new Date(`${hasta}T00:00:00`) - new Date(`${desde}T00:00:00`)) / 86400000;
  return dias >= 0 ? dias : null;
}

function promedio(valores) {
  return valores.length ? Math.round(valores.reduce((total, valor) => total + valor, 0) / valores.length) : null;
}

// personas: [{ id, fecha_ingreso, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado }]
// personaIdsConCargo: Set<string> de persona_id con membresia de comite vigente.
export function construirCicloVida(personas, personaIdsConCargo) {
  const activos = personas.length;
  const bautizados = personas.filter((persona) => persona.bautizado).length;
  const sellados = personas.filter((persona) => persona.sellado_espiritu_santo).length;
  const conCargo = personas.filter((persona) => personaIdsConCargo.has(persona.id)).length;

  const diasIngresoBautismo = personas
    .filter((persona) => persona.fecha_ingreso && persona.bautizado && persona.fecha_bautismo)
    .map((persona) => diasEntre(persona.fecha_ingreso, persona.fecha_bautismo))
    .filter((dias) => dias !== null);
  const diasBautismoSellado = personas
    .filter((persona) => persona.bautizado && persona.fecha_bautismo && persona.sellado_espiritu_santo && persona.fecha_sellado)
    .map((persona) => diasEntre(persona.fecha_bautismo, persona.fecha_sellado))
    .filter((dias) => dias !== null);

  return {
    activos,
    bautizados,
    sellados,
    conCargo,
    pctBautizados: activos ? Math.round((bautizados / activos) * 100) : null,
    pctSellados: bautizados ? Math.round((sellados / bautizados) * 100) : null,
    pctConCargo: sellados ? Math.round((conCargo / sellados) * 100) : null,
    diasPromedioIngresoBautismo: promedio(diasIngresoBautismo),
    diasPromedioBautismoSellado: promedio(diasBautismoSellado),
    muestraIngresoBautismo: diasIngresoBautismo.length,
    muestraBautismoSellado: diasBautismoSellado.length,
  };
}
