-- "Mi historial" en la PWA (2026-11-08)
--
-- Antes, "Registros recientes" en la PWA vivia en localStorage del
-- telefono, sin relacion con la cuenta que inicio sesion -- cualquiera
-- que usara el mismo telefono despues (otra cuenta, otra prueba) veia
-- los registros de la sesion anterior.
--
-- Arreglo real: que cada tipo de captura de la PWA sepa, en el
-- servidor, que cuenta lo registro -- asi "Mi historial" se puede
-- consultar siempre filtrado por auth.uid(), sin importar el
-- dispositivo. registros_actividad ya tiene `capturado_por` desde el
-- inicio (ver schema.sql); estos 3 tipos de captura de la PWA no lo
-- tenian.

alter table amigos add column if not exists capturado_por uuid references auth.users(id) default auth.uid();
alter table obra_carcelaria_internos add column if not exists capturado_por uuid references auth.users(id) default auth.uid();
alter table obra_carcelaria_cultos add column if not exists capturado_por uuid references auth.users(id) default auth.uid();

-- Los registros que ya existian quedan en NULL -- no hay forma de
-- saber quien los capturo (la columna no existia todavia). Eso
-- simplemente significa que no van a aparecer en el historial de
-- nadie; no se le atribuyen a la cuenta equivocada.

comment on column amigos.capturado_por is 'Cuenta de auth.users que capturo este registro (para "Mi historial" en la PWA) -- distinto de invitado_por, que es texto libre.';
comment on column obra_carcelaria_internos.capturado_por is 'Cuenta de auth.users que capturo este registro (para "Mi historial" en la PWA).';
comment on column obra_carcelaria_cultos.capturado_por is 'Cuenta de auth.users que capturo este registro (para "Mi historial" en la PWA) -- distinto de responsable_persona_id, que es quien se marco como responsable del culto, no necesariamente quien lo tecleo.';
