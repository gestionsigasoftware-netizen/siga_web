import { supabase } from "./supabase";
import { hoyBogota, inicioDiaBogota } from "./fechaBogota";

// Umbrales fijos de "sin avance" por estacion -- decision del usuario:
// valores fijos que yo propongo, no configurables por congregacion.
// Uno Mas y BIS son pasos rapidos de primer contacto/bienvenida; REFAM y
// ESFOB son procesos de varias semanas; Discipulado es continuo, su
// "umbral" es solo un recordatorio de revisar continuidad, no una meta.
export const UMBRAL_DIAS_ESTACION = {
  uno_mas: 15,
  bis: 30,
  refam: 60,
  esfob: 90,
  discipulado: 180,
};

// Un recien bautizado que ya inicio Discipulado se marca como "en formacion"
// en el censo de Feligresia durante esta ventana -- pasado este umbral deja
// de mostrarse la marca y se considera disponible para servicio, como
// cualquier otro feligres. Valor fijo, igual que el resto de umbrales de la
// ruta -- decision del usuario.
export const UMBRAL_DIAS_NUEVO_BAUTIZADO = 30;

export function diasDesde(fecha) {
  if (!fecha) return null;
  const inicio = inicioDiaBogota(fecha);
  if (Number.isNaN(inicio.getTime())) return null;
  return Math.floor((Date.now() - inicio.getTime()) / 86400000);
}

// Que tipo de responsable acepta cada estacion -- decision del usuario
// (2026-09-07): el responsable individual (persona) se reserva para el
// acompañamiento personal de Uno Mas y BIS (un feligres concreto
// visitando/llamando a un amigo); de ahi en adelante (REFAM, ESFOB,
// Discipulado) el responsable general de la estacion debe ser un
// comite completo, no una persona suelta -- son ellos quienes siguen
// el acompañamiento real (visitas a hogares, continuidad) una vez la
// persona ya esta mas establecida en la congregacion. El responsable
// de cada leccion/nota individual (quien la enseño o la escribio) es
// un concepto aparte, siempre una persona, y no se ve afectado por
// esto.
export const TIPO_RESPONSABLE_ESTACION = {
  uno_mas: "persona",
  bis: "persona",
  refam: "comite",
  esfob: "comite",
  discipulado: "comite",
};

// Comites activos de la congregacion, para el selector de "responsable"
// cuando se elige un comite en vez de una persona individual.
export async function getComitesActivos(congregacionId) {
  return supabase
    .from("comites")
    .select("id, nombre")
    .eq("congregacion_id", congregacionId)
    .eq("activo", true)
    .order("nombre");
}

export async function getEstacion(congregacionId, codigo) {
  return supabase
    .from("ruta_estaciones")
    .select("id, nombre, descripcion, orden")
    .eq("congregacion_id", congregacionId)
    .eq("codigo", codigo)
    .single();
}

export async function getEstacionActivos(congregacionId, estacionId) {
  return supabase
    .from("ruta_procesos")
    .select(
      "id, amigo_id, persona_id, responsable_persona_id, responsable_comite_id, fecha_inicio, notas, amigos(id, nombres, zona_id, zonas(nombre)), persona:personas!ruta_procesos_persona_id_fkey(id, nombres, apellidos), responsable:personas!ruta_procesos_responsable_persona_id_fkey(nombres, apellidos), responsable_comite:comites!ruta_procesos_responsable_comite_id_fkey(nombre)"
    )
    .eq("congregacion_id", congregacionId)
    .eq("estacion_id", estacionId)
    .eq("estado", "activo")
    .order("fecha_inicio");
}

/**
 * Un solo mecanismo de traslado para las 5 estaciones de persona (todas
 * menos Metodos, que diagnostica zonas, no amigos). El orden de las 6
 * estaciones NO es obligatorio -- una persona puede entrar directo a
 * cualquiera segun como el lider de zona la caracterice, y trasladarse
 * libremente entre ellas. Si ya tiene un proceso activo (en cualquier
 * estacion), lo cierra como completado y abre uno nuevo en el destino;
 * si no tiene ninguno, simplemente lo crea.
 */
export async function iniciarOMoverEstacion({
  congregacionId,
  estacionDestino,
  amigoId,
  personaId,
  responsablePersonaId,
  responsableComiteId,
  fechaInicio,
  notas,
}) {
  const hoy = hoyBogota();
  const columna = amigoId ? "amigo_id" : "persona_id";
  const valor = amigoId || personaId;
  const { data: activo, error: activoError } = await supabase
    .from("ruta_procesos")
    .select("id, estacion_id")
    .eq("congregacion_id", congregacionId)
    .eq(columna, valor)
    .in("estado", ["activo", "pausado"])
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activoError) return { error: activoError };
  // Cada estacion solo acepta un tipo de responsable (ver
  // TIPO_RESPONSABLE_ESTACION) -- si el que llega no coincide (ej. una
  // persona individual heredada de un traslado desde Uno Mas/BIS hacia
  // REFAM/ESFOB/Discipulado, que ahora exigen comite), se descarta en
  // vez de guardarlo mal. Queda sin responsable hasta que se le
  // asigne uno del tipo correcto desde la pantalla de destino.
  const tipoRequerido = TIPO_RESPONSABLE_ESTACION[estacionDestino.codigo];
  if (tipoRequerido === "persona") responsableComiteId = null;
  if (tipoRequerido === "comite") responsablePersonaId = null;
  if (activo && activo.estacion_id === estacionDestino.id) {
    // Ya esta activa en esta misma estacion (ej. REFAM: el traslado ya
    // la movio aqui, y ahora "agregar participante" la engancha a un
    // grupo especifico) -- si se paso un responsable nuevo, se
    // actualiza el registro existente en vez de ignorarlo en silencio.
    if (responsablePersonaId || responsableComiteId) {
      const actualizar = await supabase
        .from("ruta_procesos")
        .update({ responsable_persona_id: responsablePersonaId || null, responsable_comite_id: responsableComiteId || null })
        .eq("id", activo.id);
      if (actualizar.error) return { error: actualizar.error };
    }
    return { data: activo, moved: false, responsablePersonaId, responsableComiteId };
  }
  // Un alta nueva siempre necesita un responsable claro para el
  // seguimiento (una persona o un comite) -- un traslado conserva el
  // responsable que ya tenia, asi que no se vuelve a exigir aqui.
  if (!activo && !responsablePersonaId && !responsableComiteId) {
    return { error: new Error("Selecciona quién será el responsable de esta persona en la estación.") };
  }
  if (activo) {
    const cierre = await supabase
      .from("ruta_procesos")
      .update({ estado: "completado", fecha_cierre: hoy, estacion_siguiente_id: estacionDestino.id })
      .eq("id", activo.id);
    if (cierre.error) return { error: cierre.error };
  }
  const { data, error } = await supabase
    .from("ruta_procesos")
    .insert({
      congregacion_id: congregacionId,
      estacion_id: estacionDestino.id,
      amigo_id: amigoId || null,
      persona_id: personaId || null,
      responsable_persona_id: responsablePersonaId || null,
      responsable_comite_id: responsableComiteId || null,
      fecha_inicio: fechaInicio || hoy,
      estado: "activo",
      notas: notas || null,
    })
    .select("id")
    .single();
  if (error) return { error };
  return { data, moved: Boolean(activo), responsablePersonaId, responsableComiteId };
}

// REFAM, ESFOB y Discipulado no solo viven en ruta_procesos -- tienen su
// propia tabla de detalle (con campos que ruta_procesos no tiene: lecciones,
// mentor, etc.) y sus pantallas leen de ESA tabla, no de ruta_procesos. Un
// traslado que solo mueve ruta_procesos deja a la persona invisible en el
// detalle del destino y "fantasma" (activa) en el detalle del origen. Este
// mapa es la fuente única de verdad de qué tabla de detalle tiene cada
// estación y qué tipo de persona acepta.
export const DETALLE_ESTACION = {
  esfob: { tabla: "esfob_procesos", tablaLecciones: "esfob_lecciones", estadoActivo: "en_formacion", estadoSalida: "retirado", requiere: "amigo" },
  discipulado: { tabla: "discipulado_procesos", tablaLecciones: "discipulado_lecciones", estadoActivo: "activo", estadoSalida: "retirado", requiere: "persona" },
  // refam_participantes exige un grupo_id (hogar/celula) que esta funcion
  // no puede adivinar -- por eso no crea la fila del destino, solo cierra
  // la de origen; avisa al llamador con `avisoRefam` para que le diga al
  // usuario que la agregue a un grupo desde la pantalla de REFAM.
  refam: { tabla: "refam_participantes", estadoActivo: "activo", estadoSalida: "completado", requiere: null },
};

/**
 * Traslado completo entre estaciones: mueve ruta_procesos (via
 * iniciarOMoverEstacion) y ademas cierra la fila de detalle en el origen y
 * crea la del destino cuando aplica. Bloquea el traslado si el destino
 * exige un tipo de persona (amigo/persona) que esta no tiene -- por
 * ejemplo, un amigo no puede entrar a Discipulado porque esa estacion
 * requiere una persona ya bautizada e incorporada a Feligresia.
 */
export async function trasladarEstacion({
  congregacionId,
  estacionOrigenCodigo,
  estacionDestino,
  amigoId,
  personaId,
  responsablePersonaId,
  responsableComiteId,
}) {
  const detalleDestino = DETALLE_ESTACION[estacionDestino.codigo];
  if (detalleDestino?.requiere === "amigo" && !amigoId) {
    return { error: new Error(`${estacionDestino.nombre} es solo para amigos aún no bautizados. Esta persona ya está incorporada a Feligresía.`) };
  }
  if (detalleDestino?.requiere === "persona" && !personaId) {
    return { error: new Error(`${estacionDestino.nombre} requiere que la persona ya esté bautizada e incorporada a Feligresía. Usa "Marcar bautizado" antes de trasladarla aquí.`) };
  }

  const result = await iniciarOMoverEstacion({ congregacionId, estacionDestino, amigoId, personaId, responsablePersonaId, responsableComiteId });
  if (result.error) return result;

  const detalleOrigen = DETALLE_ESTACION[estacionOrigenCodigo];
  if (detalleOrigen) {
    let cierre = supabase
      .from(detalleOrigen.tabla)
      .update({ estado: detalleOrigen.estadoSalida })
      .eq("congregacion_id", congregacionId)
      .eq("estado", detalleOrigen.estadoActivo);
    cierre = amigoId ? cierre.eq("amigo_id", amigoId) : cierre.eq("persona_id", personaId);
    await cierre;
  }

  if (detalleDestino && estacionDestino.codigo !== "refam") {
    const payload = { congregacion_id: congregacionId, proceso_id: result.data.id, fecha_inicio: hoyBogota() };
    if (estacionDestino.codigo === "esfob") {
      payload.amigo_id = amigoId;
      payload.responsable_persona_id = result.responsablePersonaId || null;
      payload.responsable_comite_id = result.responsableComiteId || null;
    } else if (estacionDestino.codigo === "discipulado") {
      payload.persona_id = personaId;
      payload.mentor_persona_id = result.responsablePersonaId || null;
      payload.mentor_comite_id = result.responsableComiteId || null;
    }
    if (detalleDestino.tablaLecciones) {
      const { data: primeraLeccion } = await supabase
        .from(detalleDestino.tablaLecciones)
        .select("id")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .order("numero")
        .limit(1)
        .maybeSingle();
      payload.leccion_actual_id = primeraLeccion?.id || null;
    }
    const detalleResult = await supabase.from(detalleDestino.tabla).insert(payload);
    if (detalleResult.error) return { ...result, detalleError: detalleResult.error };
  } else if (estacionDestino.codigo === "refam") {
    return { ...result, avisoRefam: true };
  }

  return result;
}

// Cambia el comite responsable de una persona SIN moverla de estacion --
// distinto de trasladarEstacion, que siempre exige un destino. Resuelve
// el caso de "el comite de seguimiento debe poder cambiar sin que la
// persona cambie de estacion" (ej. una adolescente que cumple 18 años y
// pasa de Adolescentes a Jovenes, sin dejar REFAM). Solo aplica a
// estaciones comite-only (REFAM/ESFOB/Discipulado); ademas de
// ruta_procesos, actualiza la columna espejo en la tabla de detalle
// (esfob_procesos/discipulado_procesos) cuando existe -- a diferencia
// del cortocircuito de iniciarOMoverEstacion, que solo toca
// ruta_procesos. REFAM no tiene columna espejo en refam_participantes,
// asi que ahi basta con ruta_procesos.
export async function reasignarComiteResponsable({ procesoId, estacionCodigo, nuevoComiteId }) {
  if (TIPO_RESPONSABLE_ESTACION[estacionCodigo] !== "comite") {
    return { error: new Error("Esta estación no acepta un comité como responsable.") };
  }
  if (!nuevoComiteId) {
    return { error: new Error("Selecciona el comité de seguimiento.") };
  }
  const actualizarRuta = await supabase
    .from("ruta_procesos")
    .update({ responsable_comite_id: nuevoComiteId, responsable_persona_id: null })
    .eq("id", procesoId);
  if (actualizarRuta.error) return { error: actualizarRuta.error };

  if (estacionCodigo === "esfob") {
    const actualizarDetalle = await supabase
      .from("esfob_procesos")
      .update({ responsable_comite_id: nuevoComiteId, responsable_persona_id: null })
      .eq("proceso_id", procesoId);
    if (actualizarDetalle.error) return { error: actualizarDetalle.error };
  } else if (estacionCodigo === "discipulado") {
    const actualizarDetalle = await supabase
      .from("discipulado_procesos")
      .update({ mentor_comite_id: nuevoComiteId, mentor_persona_id: null })
      .eq("proceso_id", procesoId);
    if (actualizarDetalle.error) return { error: actualizarDetalle.error };
  }
  return { data: { procesoId, nuevoComiteId } };
}
