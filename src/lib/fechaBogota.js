// Colombia (America/Bogota) esta siempre en UTC-5, sin horario de
// verano -- por eso alcanza con un desplazamiento fijo, sin necesitar
// Intl.DateTimeFormat con nombre de zona horaria.
//
// El bug que esto corrige: `new Date().toISOString().slice(0, 10)`
// (usado en decenas de paginas para guardar "la fecha de hoy") siempre
// convierte primero a UTC. Entre las 7pm y la medianoche hora Bogota
// -- justo cuando pasan la mayoria de cultos y actividades -- el reloj
// UTC ya marca el dia siguiente, asi que cualquier registro hecho en
// esa ventana quedaba guardado con la fecha de manana, no de hoy.
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

// "Hoy" como fecha civil de Bogota (YYYY-MM-DD), sin importar en que
// zona horaria este configurado el dispositivo que ejecuta el codigo.
export function hoyBogota() {
  return fechaBogota(new Date());
}

// Igual que hoyBogota() pero para un instante especifico (Date), util
// para cosas como "hace N dias".
export function fechaBogota(fecha) {
  return new Date(fecha.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

// Instante UTC exacto de la medianoche de Bogota para una fecha civil
// "YYYY-MM-DD" ya guardada (ej. fecha_inicio de un proceso) -- para
// medir tiempo transcurrido de forma correcta sin depender de la zona
// horaria del navegador que hace el calculo.
export function inicioDiaBogota(fechaCivil) {
  return new Date(`${fechaCivil}T05:00:00Z`);
}
