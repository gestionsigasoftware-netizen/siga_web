-- SIGA - Finalizar la asignacion de un pastor SIN necesidad de una
-- congregacion destino conocida (retiro, renuncia, u otro motivo donde
-- no hay a donde trasladarlo dentro de SIGAP).
-- Ejecutar despues de gestion_pastoral_distrital_v2.sql. Es repetible.
--
-- Problema que resuelve: trasladar_pastor() solo cubre el caso de mover
-- un pastor a OTRA congregacion especifica. Si un pastor simplemente se
-- retira, no habia forma de vaciar su congregacion (dejarla sin pastor)
-- ni de revocar su acceso — habria que hacerlo manualmente en la base de
-- datos. Esta funcion deja la congregacion vacante y revoca el acceso
-- local del pastor saliente, lista para que registrar_pastor_con_acceso()
-- le de la custodia a quien lo reemplace.

create or replace function finalizar_asignacion_pastoral(
  p_pastor_id uuid,
  p_fecha date default current_date,
  p_observaciones text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_distrito_id uuid;
  v_persona_id uuid;
  v_congregacion_id uuid;
begin
  select distrito_id, persona_id into v_distrito_id, v_persona_id from pastores where id = p_pastor_id;
  if v_distrito_id is null or not es_lider_distrital(v_distrito_id) then
    raise exception 'No tienes permisos para finalizar la asignación de este pastor';
  end if;

  select congregacion_id into v_congregacion_id from asignaciones_pastorales where pastor_id = p_pastor_id and fecha_fin is null limit 1;
  if v_congregacion_id is null then
    raise exception 'Este pastor no tiene una asignación activa';
  end if;

  update asignaciones_pastorales set fecha_fin = greatest(p_fecha, fecha_inicio), observaciones = coalesce(p_observaciones, observaciones)
    where pastor_id = p_pastor_id and fecha_fin is null;

  update congregaciones set pastor_id = null, pastor_nombre = null where id = v_congregacion_id;

  if v_persona_id is not null then
    update roles_sistema set fecha_fin = p_fecha
      where persona_id = v_persona_id and nivel = 'local' and congregacion_id = v_congregacion_id and fecha_fin is null;
  end if;
end;
$$;

revoke all on function finalizar_asignacion_pastoral(uuid, date, text) from public, anon;
grant execute on function finalizar_asignacion_pastoral(uuid, date, text) to authenticated;
