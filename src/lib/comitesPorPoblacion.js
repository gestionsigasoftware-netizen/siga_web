import { supabase } from "./supabase";

// Edad en años cumplidos a partir de una fecha de nacimiento -- null si
// no hay fecha registrada (no se puede sugerir nada sin ese dato).
export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumple = hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumple) edad -= 1;
  return edad;
}

export async function getRangosEdadComite(congregacionId) {
  return supabase
    .from("rangos_edad_comite")
    .select("id, nombre, edad_desde, edad_hasta, genero, estado_civil, comite_id, activo, comites(nombre)")
    .eq("congregacion_id", congregacionId)
    .eq("activo", true)
    .order("edad_desde");
}

// Filtra los rangos que aplican a una persona segun edad/genero/estado
// civil -- genero/estado_civil en null en el rango significa "aplica a
// cualquiera". Puede devolver varios (a proposito: mas de un comite
// puede corresponderle a la misma persona segun su plan de trabajo).
export function sugerirComites({ edad, genero, estadoCivil }, rangos) {
  if (edad === null || edad === undefined) return [];
  return rangos.filter((rango) => {
    if (edad < rango.edad_desde) return false;
    if (rango.edad_hasta !== null && rango.edad_hasta !== undefined && edad > rango.edad_hasta) return false;
    if (rango.genero && rango.genero !== genero) return false;
    if (rango.estado_civil && estadoCivil && rango.estado_civil !== estadoCivil) return false;
    return true;
  });
}
