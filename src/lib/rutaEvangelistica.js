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
      "id, amigo_id, persona_id, responsable_persona_id, fecha_inicio, notas, amigos(id, nombres, zona_id, zonas(nombre)), persona:personas!ruta_procesos_persona_id_fkey(id, nombres, apellidos), responsable:personas!ruta_procesos_responsable_persona_id_fkey(nombres, apellidos)"
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
  if (activo && activo.estacion_id === estacionDestino.id) {
    return { data: activo, moved: false };
  }
  // Un alta nueva siempre necesita un responsable claro para el
  // seguimiento -- un traslado conserva el responsable que ya tenia,
  // asi que no se vuelve a exigir aqui.
  if (!activo && !responsablePersonaId) {
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
      fecha_inicio: fechaInicio || hoy,
      estado: "activo",
      notas: notas || null,
    })
    .select("id")
    .single();
  if (error) return { error };
  return { data, moved: Boolean(activo) };
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
}) {
  const detalleDestino = DETALLE_ESTACION[estacionDestino.codigo];
  if (detalleDestino?.requiere === "amigo" && !amigoId) {
    return { error: new Error(`${estacionDestino.nombre} es solo para amigos aún no bautizados. Esta persona ya está incorporada a Feligresía.`) };
  }
  if (detalleDestino?.requiere === "persona" && !personaId) {
    return { error: new Error(`${estacionDestino.nombre} requiere que la persona ya esté bautizada e incorporada a Feligresía. Usa "Marcar bautizado" antes de trasladarla aquí.`) };
  }

  const result = await iniciarOMoverEstacion({ congregacionId, estacionDestino, amigoId, personaId, responsablePersonaId });
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
      payload.responsable_persona_id = responsablePersonaId || null;
    } else if (estacionDestino.codigo === "discipulado") {
      payload.persona_id = personaId;
      payload.mentor_persona_id = responsablePersonaId || null;
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
