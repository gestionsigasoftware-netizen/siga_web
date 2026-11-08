-- Permitir eliminar lecciones de REFAM/ESFOB/Discipulado (2026-11-08)
--
-- El usuario pidio poder eliminar una leccion desde "Modulos y
-- actividades" -- hoy solo se puede desactivar. El catalogo
-- (refam_lecciones/esfob_lecciones/discipulado_lecciones) tenia sus
-- tablas de progreso y de notas por leccion enganchadas con
-- `on delete cascade` (ver lecciones_ruta_evangelistica.sql,
-- lecciones_discipulado.sql, notas_leccion_ruta_evangelistica.sql) --
-- borrar una leccion con historial real habria borrado en silencio el
-- progreso y las notas de acompañamiento de cada persona en esa
-- leccion, sin ningun aviso.
--
-- Mismo patron ya usado para "eliminar persona del censo": se cambia
-- `on delete cascade` -> `on delete restrict` en las 6 referencias.
-- Asi, Postgres bloquea solo el borrado de una leccion con progreso o
-- notas reales (error 23503, que el frontend atrapa para mostrar un
-- mensaje claro); una leccion recien creada por error, sin ningun
-- participante que la haya trabajado todavia, se puede borrar sin
-- problema.

alter table refam_progreso_leccion drop constraint if exists refam_progreso_leccion_leccion_id_fkey;
alter table refam_progreso_leccion add constraint refam_progreso_leccion_leccion_id_fkey foreign key (leccion_id) references refam_lecciones(id) on delete restrict;

alter table refam_notas_leccion drop constraint if exists refam_notas_leccion_leccion_id_fkey;
alter table refam_notas_leccion add constraint refam_notas_leccion_leccion_id_fkey foreign key (leccion_id) references refam_lecciones(id) on delete restrict;

alter table esfob_progreso_leccion drop constraint if exists esfob_progreso_leccion_leccion_id_fkey;
alter table esfob_progreso_leccion add constraint esfob_progreso_leccion_leccion_id_fkey foreign key (leccion_id) references esfob_lecciones(id) on delete restrict;

alter table esfob_notas_leccion drop constraint if exists esfob_notas_leccion_leccion_id_fkey;
alter table esfob_notas_leccion add constraint esfob_notas_leccion_leccion_id_fkey foreign key (leccion_id) references esfob_lecciones(id) on delete restrict;

alter table discipulado_progreso_leccion drop constraint if exists discipulado_progreso_leccion_leccion_id_fkey;
alter table discipulado_progreso_leccion add constraint discipulado_progreso_leccion_leccion_id_fkey foreign key (leccion_id) references discipulado_lecciones(id) on delete restrict;

alter table discipulado_notas_leccion drop constraint if exists discipulado_notas_leccion_leccion_id_fkey;
alter table discipulado_notas_leccion add constraint discipulado_notas_leccion_leccion_id_fkey foreign key (leccion_id) references discipulado_lecciones(id) on delete restrict;

-- leccion_actual_id en *_participantes/*_procesos ya usa
-- `on delete set null` (lecciones_ruta_evangelistica.sql,
-- lecciones_discipulado.sql) -- no se toca, ya es seguro: si se borra
-- la leccion actual de alguien, simplemente queda sin "leccion
-- actual" en vez de bloquear el borrado.
