-- SIGA - Corrige un hueco real de seguridad encontrado en la auditoria de
-- aislamiento entre congregaciones (2026-09-10): rotar_asignacion_cargo()
-- es security definer (bypasea RLS de asignaciones_cargo) pero no tenia
-- NINGUN control de permiso adentro, ni un `revoke` que le quitara el
-- EXECUTE por defecto a PUBLIC -- a diferencia de cada otra funcion
-- privilegiada del proyecto (asignar_reinsercion, trasladar_pastor,
-- ascender_licencia_pastor, etc.), que siempre validan el permiso y
-- despues revocan public/anon. Cualquier cuenta autenticada podia llamar
-- este RPC con un cargo_id de OTRA congregacion y reescribir su
-- asignacion, sin pasar por ninguna politica RLS.
--
-- Corregido reproduciendo exactamente la misma condicion que ya exige la
-- politica RLS directa sobre asignaciones_cargo
-- (`asignaciones_cargo_scope`, en migracion_produccion.sql): el cargo
-- debe pertenecer a un modulo de una congregacion en mis_congregaciones().
-- Ejecutar despues de schema.sql y migracion_produccion.sql. Es repetible.

create or replace function rotar_asignacion_cargo(
  p_cargo_id uuid, p_persona_id uuid, p_zona_id uuid default null,
  p_fecha_inicio date default current_date
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (
    select 1
    from cargos ca
    join modulos m on m.id = ca.modulo_id
    where ca.id = p_cargo_id
      and m.congregacion_id in (select mis_congregaciones())
  ) then
    raise exception 'No tienes permisos sobre este cargo';
  end if;

  update asignaciones_cargo set fecha_fin = p_fecha_inicio - interval '1 day'
    where cargo_id = p_cargo_id and fecha_fin is null;
  insert into asignaciones_cargo (cargo_id, persona_id, zona_id, fecha_inicio)
  values (p_cargo_id, p_persona_id, p_zona_id, p_fecha_inicio) returning id into v_id;
  return v_id;
end; $$;

revoke all on function rotar_asignacion_cargo(uuid, uuid, uuid, date) from public, anon;
grant execute on function rotar_asignacion_cargo(uuid, uuid, uuid, date) to authenticated;
