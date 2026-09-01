-- SIGA - Reasignar el distrito de una congregacion existente.
-- Ejecutar despues de schema.sql, accesos.sql y pastoral_distrital.sql.
-- Es repetible (create or replace).
--
-- Problema que resuelve: no existia ningun camino, ni siquiera para
-- nacional/super_admin, para corregir el distrito de una congregacion
-- despues de creada (por ejemplo, congregaciones dadas de alta bajo un
-- distrito de prueba/demo que deben quedar en su distrito real).
-- GestionDistritos.jsx solo permite crear/editar distritos, no mover
-- congregaciones entre ellos.
--
-- Mueve la congregacion y, si tiene un pastor activo, sincroniza tambien
-- pastores.distrito_id y la asignacion pastoral vigente — de lo contrario
-- quedarian con un distrito distinto al de su propia congregacion, lo que
-- rompe el filtro por distrito que usa Pastoral Distrital y viola la
-- invariante que exige validar_asignacion_pastoral().

create or replace function mover_congregacion_distrito(
  p_congregacion_id uuid,
  p_distrito_destino uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_pastor_id uuid;
begin
  if not (es_nacional() or es_super_admin()) then
    raise exception 'Solo un lider nacional puede reasignar el distrito de una congregacion';
  end if;
  if not exists (select 1 from distritos where id = p_distrito_destino) then
    raise exception 'El distrito destino no existe';
  end if;
  if not exists (select 1 from congregaciones where id = p_congregacion_id) then
    raise exception 'La congregacion no existe';
  end if;

  select pastor_id into v_pastor_id from congregaciones where id = p_congregacion_id;

  update congregaciones set distrito_id = p_distrito_destino where id = p_congregacion_id;

  update asignaciones_pastorales set distrito_id = p_distrito_destino
    where congregacion_id = p_congregacion_id and fecha_fin is null;

  if v_pastor_id is not null then
    update pastores set distrito_id = p_distrito_destino where id = v_pastor_id;
  end if;
end;
$$;

revoke all on function mover_congregacion_distrito(uuid, uuid) from public, anon;
grant execute on function mover_congregacion_distrito(uuid, uuid) to authenticated;
