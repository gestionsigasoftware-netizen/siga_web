import { supabase } from "./supabase";

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

export function diasDesde(fecha) {
  if (!fecha) return null;
  const inicio = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  return Math.floor((new Date() - inicio) / 86400000);
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
  const hoy = new Date().toISOString().slice(0, 10);
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
