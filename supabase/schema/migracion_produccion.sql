-- SIGA - Endurecimiento de seguridad y validaciones para producción.
-- Ejecutar una sola vez DESPUÉS de schema.sql y vistas_dashboard.sql.
-- Esta migración es repetible y no elimina datos.

-- Todas las tablas expuestas al cliente deben exigir políticas RLS.
alter table distritos enable row level security;
alter table tipos_actividad enable row level security;
alter table categorias_demograficas enable row level security;
alter table etapas_seguimiento enable row level security;
alter table cargos enable row level security;

-- Las políticas se recrean para que esta migración sea repetible.
drop policy if exists distritos_select_authenticated on distritos;
create policy distritos_select_authenticated on distritos
for select to authenticated using (true);

-- El alta de congregaciones se hará desde un flujo administrativo controlado.
-- No se permite crear tenants libremente desde la anon key.
drop policy if exists congregaciones_insert_self_register on congregaciones;

drop policy if exists modulos_scope on modulos;
create policy modulos_scope on modulos
for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

drop policy if exists registros_scope on registros_actividad;
create policy registros_scope on registros_actividad
for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

drop policy if exists zonas_scope on zonas;
create policy zonas_scope on zonas
for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

drop policy if exists personas_scope on personas;
create policy personas_scope on personas
for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

drop policy if exists tipos_actividad_scope on tipos_actividad;
create policy tipos_actividad_scope on tipos_actividad
for all to authenticated
using (exists (
  select 1 from modulos m
  where m.id = tipos_actividad.modulo_id
    and m.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from modulos m
  where m.id = tipos_actividad.modulo_id
    and m.congregacion_id in (select mis_congregaciones())
));

drop policy if exists categorias_demograficas_scope on categorias_demograficas;
create policy categorias_demograficas_scope on categorias_demograficas
for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

drop policy if exists etapas_seguimiento_scope on etapas_seguimiento;
create policy etapas_seguimiento_scope on etapas_seguimiento
for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

drop policy if exists cargos_scope on cargos;
create policy cargos_scope on cargos
for all to authenticated
using (exists (
  select 1 from modulos m
  where m.id = cargos.modulo_id
    and m.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from modulos m
  where m.id = cargos.modulo_id
    and m.congregacion_id in (select mis_congregaciones())
));

drop policy if exists asignaciones_cargo_scope on asignaciones_cargo;
create policy asignaciones_cargo_scope on asignaciones_cargo
for all to authenticated
using (exists (
  select 1
  from cargos ca
  join modulos m on m.id = ca.modulo_id
  where ca.id = asignaciones_cargo.cargo_id
    and m.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1
  from cargos ca
  join modulos m on m.id = ca.modulo_id
  where ca.id = asignaciones_cargo.cargo_id
    and m.congregacion_id in (select mis_congregaciones())
));

-- Impide que un registro mezcle congregación, módulo, actividad, zona o persona.
create or replace function validar_registro_actividad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.desglose is null or jsonb_typeof(new.desglose) <> 'object' then
    raise exception 'desglose debe ser un objeto JSON';
  end if;

  if exists (
    select 1 from jsonb_each_text(new.desglose)
    where value !~ '^\d+$'
  ) then
    raise exception 'los conteos deben ser enteros no negativos';
  end if;

  if not exists (
    select 1 from modulos
    where id = new.modulo_id
      and congregacion_id = new.congregacion_id
      and activo = true
  ) then
    raise exception 'el modulo no pertenece a la congregacion o esta inactivo';
  end if;

  if new.tipo_actividad_id is not null and not exists (
    select 1 from tipos_actividad
    where id = new.tipo_actividad_id
      and modulo_id = new.modulo_id
      and activo = true
  ) then
    raise exception 'el tipo de actividad no pertenece al modulo o esta inactivo';
  end if;

  if new.zona_id is not null and not exists (
    select 1 from zonas
    where id = new.zona_id
      and congregacion_id = new.congregacion_id
      and (modulo_id is null or modulo_id = new.modulo_id)
  ) then
    raise exception 'la zona no pertenece a la congregacion o al modulo';
  end if;

  if new.responsable_persona_id is not null and not exists (
    select 1 from personas
    where id = new.responsable_persona_id
      and congregacion_id = new.congregacion_id
  ) then
    raise exception 'el responsable no pertenece a la congregacion';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_registro_actividad_trigger on registros_actividad;
create trigger validar_registro_actividad_trigger
before insert or update on registros_actividad
for each row execute function validar_registro_actividad();

-- No permitir valores negativos aunque se escriba directamente por API.
alter table registros_actividad
  drop constraint if exists registros_actividad_total_no_negativo;
alter table registros_actividad
  add constraint registros_actividad_total_no_negativo
  check (total_asistentes >= 0);
