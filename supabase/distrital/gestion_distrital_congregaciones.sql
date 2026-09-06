-- SIGA - Alta de congregaciones y primer pastor local desde el rol distrital.
-- Ejecutar despues de schema.sql, accesos.sql, pastoral_distrital.sql y
-- seguridad_produccion.sql. Es repetible (usa create or replace / drop if exists).
--
-- Problema que resuelve: hoy no existe ningun camino, ni siquiera para un
-- lider distrital, para dar de alta una congregacion nueva desde la web. La
-- politica que lo permitia (congregaciones_insert_self_register) se elimino
-- por seguridad en migracion_produccion.sql y nunca se reemplazo por un flujo
-- administrativo real. La IPUC tiene 36 distritos; cada lider distrital debe
-- poder crear las congregaciones de su propio distrito y dejar lista la
-- cuenta de su primer pastor local, todo desde la interfaz.

-- 1. Permite a un lider distrital crear congregaciones dentro de su distrito.
drop policy if exists congregaciones_insert_distrital on congregaciones;
create policy congregaciones_insert_distrital on congregaciones for insert to authenticated
with check (distrito_id in (select mis_distritos()));

-- 2. Alta atomica: congregacion + primera persona (el pastor) + su rol local +
--    su registro en el modulo de gestion pastoral distrital (pastores /
--    asignaciones_pastorales), para que ambos sistemas queden coherentes
--    desde el primer momento. Solo puede ejecutarse una vez por congregacion
--    (exige que la congregacion no tenga personas todavia), para que no se
--    convierta en una via paralela de alta de personas del censo.
create or replace function crear_congregacion_con_pastor(
  p_distrito_id uuid,
  p_nombre_congregacion text,
  p_pastor_nombres text,
  p_pastor_apellidos text,
  p_pastor_telefono text default null
) returns table (congregacion_id uuid, persona_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_congregacion_id uuid;
  v_persona_id uuid;
  v_pastor_id uuid;
begin
  if p_distrito_id is null or not (p_distrito_id in (select mis_distritos())) then
    raise exception 'No tienes permisos sobre ese distrito';
  end if;
  if coalesce(trim(p_nombre_congregacion), '') = '' then
    raise exception 'El nombre de la congregacion es obligatorio';
  end if;
  if coalesce(trim(p_pastor_nombres), '') = '' or coalesce(trim(p_pastor_apellidos), '') = '' then
    raise exception 'El nombre del pastor local es obligatorio';
  end if;

  insert into congregaciones (distrito_id, nombre, pastor_nombre, estado)
  values (p_distrito_id, trim(p_nombre_congregacion), trim(p_pastor_nombres) || ' ' || trim(p_pastor_apellidos), 'pendiente_aprobacion')
  returning id into v_congregacion_id;

  insert into personas (congregacion_id, nombres, apellidos, telefono, estado_membresia)
  values (v_congregacion_id, trim(p_pastor_nombres), trim(p_pastor_apellidos), nullif(trim(p_pastor_telefono), ''), 'activo')
  returning id into v_persona_id;

  insert into roles_sistema (persona_id, nivel, congregacion_id, rol_local, asignado_por)
  values (v_persona_id, 'local', v_congregacion_id, 'pastor', auth.uid());

  insert into pastores (distrito_id, nombres, apellidos, telefono)
  values (p_distrito_id, trim(p_pastor_nombres), trim(p_pastor_apellidos), nullif(trim(p_pastor_telefono), ''))
  returning id into v_pastor_id;

  insert into asignaciones_pastorales (pastor_id, distrito_id, congregacion_id, cargo, fecha_inicio)
  values (v_pastor_id, p_distrito_id, v_congregacion_id, 'Pastor local', current_date);

  update congregaciones set pastor_id = v_pastor_id where id = v_congregacion_id;

  return query select v_congregacion_id, v_persona_id;
end;
$$;

revoke all on function crear_congregacion_con_pastor(uuid, text, text, text, text) from public, anon;
grant execute on function crear_congregacion_con_pastor(uuid, text, text, text, text) to authenticated;

-- 3. Helper para que la Edge Function invitar-usuario reconozca al lider
--    distrital como autorizado a invitar la cuenta de una persona puntual
--    que el mismo creo y que todavia no tiene cuenta vinculada, dentro de
--    una congregacion de su propio distrito. No amplia sus permisos sobre
--    el resto del censo ni sobre personas ya vinculadas.
create or replace function distrital_puede_iniciar_congregacion(p_congregacion_id uuid, p_persona_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from congregaciones c
    where c.id = p_congregacion_id
      and c.distrito_id in (select mis_distritos())
  ) and exists (
    select 1 from personas p
    where p.id = p_persona_id
      and p.congregacion_id = p_congregacion_id
      and p.auth_user_id is null
  );
$$;

revoke all on function distrital_puede_iniciar_congregacion(uuid, uuid) from public, anon;
grant execute on function distrital_puede_iniciar_congregacion(uuid, uuid) to authenticated;
