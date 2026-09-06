-- SIGA - Captura web solo para correccion y contingencia.
-- Ejecutar despues de schema.sql y accesos.sql.
-- La PWA sigue siendo el canal operativo principal.

alter table registros_actividad add column if not exists origen_captura text not null default 'pwa';
alter table registros_actividad add column if not exists motivo_captura text;

do $$ begin
  alter table registros_actividad add constraint registros_origen_captura_check
    check (origen_captura in ('pwa', 'web'));
exception when duplicate_object then null;
end $$;

create or replace function validar_captura_web()
returns trigger language plpgsql as $$
begin
  if new.origen_captura = 'web' and nullif(trim(new.motivo_captura), '') is null then
    raise exception 'Las capturas web deben indicar un motivo de contingencia o corrección';
  end if;
  return new;
end;
$$;

drop trigger if exists registros_captura_web_validacion on registros_actividad;
create trigger registros_captura_web_validacion
before insert or update of origen_captura, motivo_captura on registros_actividad
for each row execute function validar_captura_web();

create index if not exists registros_actividad_origen_fecha_idx
  on registros_actividad (congregacion_id, origen_captura, fecha desc);

-- La consulta sigue visible según el alcance del rol; escribir requiere permiso.
drop policy if exists registros_scope on registros_actividad;
drop policy if exists registros_read_scope on registros_actividad;
drop policy if exists registros_write_scope on registros_actividad;
drop policy if exists registros_update_scope on registros_actividad;
drop policy if exists registros_delete_scope on registros_actividad;
create policy registros_read_scope on registros_actividad
for select to authenticated
using (congregacion_id in (select mis_congregaciones()));

create policy registros_write_scope on registros_actividad
for insert to authenticated
with check (
  congregacion_id in (select mis_congregaciones())
  and (tiene_permiso(congregacion_id, 'estadisticas.registrar')
    or tiene_permiso(congregacion_id, 'feligresia.editar'))
);

create policy registros_update_scope on registros_actividad
for update to authenticated
using (
  congregacion_id in (select mis_congregaciones())
  and (tiene_permiso(congregacion_id, 'estadisticas.registrar')
    or tiene_permiso(congregacion_id, 'feligresia.editar'))
)
with check (
  congregacion_id in (select mis_congregaciones())
  and (tiene_permiso(congregacion_id, 'estadisticas.registrar')
    or tiene_permiso(congregacion_id, 'feligresia.editar'))
);

create policy registros_delete_scope on registros_actividad
for delete to authenticated
using (
  congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'feligresia.editar')
);
