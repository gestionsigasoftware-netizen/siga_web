-- Permite conservar el nombre real de un culto cuando no coincide
-- con el catalogo fijo de tipos_actividad.
-- Ejecutar despues de schema.sql y migracion_produccion.sql.

alter table registros_actividad
  add column if not exists nombre_actividad text;

alter table registros_actividad
  drop constraint if exists registros_actividad_nombre_actividad_length;

alter table registros_actividad
  add constraint registros_actividad_nombre_actividad_length
  check (nombre_actividad is null or char_length(trim(nombre_actividad)) between 3 and 120);

create index if not exists registros_actividad_nombre_fecha_idx
  on registros_actividad (modulo_id, fecha, nombre_actividad);
