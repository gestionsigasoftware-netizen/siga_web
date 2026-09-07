# Comité que recibió al amigo (conversión intramural) — 2026-09-07

## Contexto

Continuación de la discusión de arquitectura de esta sesión. El
usuario aclaró un punto importante sobre cómo opera la IPUC: **no
hace falta imponer una taxonomía nacional de comités** -- cada
congregación ya decide libremente cuántos subcomités abrir según su
tamaño y necesidad (una congregación de 300 miembros necesita más
granularidad que una de 80), y eso ya lo resuelve la tabla `comites`
libre por congregación tal como existe hoy.

El foco real que señaló: **todo comité debe poder recibir a alguien no
convertido y acompañarlo por la Ruta Evangelística hasta que se
convierta en feligrés, y seguir administrándolo después** -- sin
cambiar de dueño. Esto ya lo resolvimos para los casos extramurales
(Misión Juvenil, Obra Carcelaria) vía el botón "Vincular". El caso que
faltaba es el más común de todos: **la conversión intramural**
(alguien entrega su vida en un culto normal de la congregación). Hoy
eso se sigue anotando en papel -- el sistema no deja constancia de qué
comité lo recibió sino hasta que la persona llega a REFAM, y en la
práctica mucha gente se pierde en el camino.

## Diseño

- No se crea ninguna tabla aislada nueva (a diferencia de Misión
  Juvenil/Obra Carcelaria) -- la conversión intramural ya se captura
  directamente como un `amigo` desde `Amigos.jsx`, sin ningún paso
  intermedio. Solo faltaba poder etiquetar, desde ese mismo momento,
  qué comité lo recibirá.
- Nueva columna `amigos.comite_origen_id` (FK a `comites`, nullable) --
  puramente informativa, **no reemplaza** el responsable-persona
  obligatorio de Uno Más/BIS ni el responsable-comité de
  REFAM/ESFOB/Discipulado, que siguen funcionando exactamente igual.
- Como valor agregado directo a la preocupación del usuario ("no
  soltar a la persona"), el comité de origen se usa para **precargar**
  (sugerir, no forzar) el selector de "comité responsable" cuando esa
  misma persona llega a REFAM o a ESFOB -- si ya alguien la etiquetó
  al recibirla, no hay que volver a preguntar desde cero.

## Construido

- `supabase/modulos/comite_origen_amigo.sql`: `amigos.comite_origen_id`
  + índice parcial.
- `src/pages/Amigos.jsx`: nuevo campo "Comité que lo recibió" en el
  formulario de alta ("Registrar amigo", junto a "Etapa inicial") y en
  el formulario general de edición (junto a "Género"); nueva línea en
  la ficha ("Comité que lo recibió: X") dentro de la sección de Ruta
  Evangelística, visible cuando está asignado.
- `src/pages/EstacionRefam.jsx`: al elegir un amigo en "agregar
  participante", si tiene `comite_origen_id`, se precarga como comité
  responsable sugerido (el usuario puede cambiarlo).
- `src/pages/RutaFormacion.jsx` (modo `esfob`): mismo precargado al
  elegir el amigo en "Iniciar proceso".

## Verificación

Contra la base de datos real (congregación Puerto Tejada Cauca
Central), con el usuario de prueba `pueba691@gmail.com`:

1. Crear un amigo con `comite_origen_id` -- se guarda correctamente.
2. El embed `comite_origen:comites!amigos_comite_origen_id_fkey(nombre)`
   que usa la ficha de `Amigos.jsx` trae el nombre correctamente.
3. El `select` que usan `EstacionRefam.jsx`/`RutaFormacion.jsx` para
   precargar el comité sugerido trae `comite_origen_id` sin problema.
4. Quitar el comité de origen (poner en null) funciona.
5. Limpieza completa, sin residuos.

`npm run build` sin errores.
