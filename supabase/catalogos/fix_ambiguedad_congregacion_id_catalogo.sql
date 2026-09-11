-- SIGA - Corrige un bug real reportado por el usuario en produccion
-- (2026-09-10): "No se pudo crear la congregacion: column reference
-- 'congregacion_id' is ambiguous" al usar "Registrar nueva congregacion"
-- eligiendo una sugerencia del catalogo oficial de la IPUC.
--
-- Causa: la funcion declara `returns table (congregacion_id uuid,
-- persona_id uuid)`, lo que convierte `congregacion_id` en un parametro
-- de salida de la funcion. La tabla `catalogo_congregaciones_ipuc`
-- TAMBIEN tiene una columna `congregacion_id` -- el UPDATE que marca la
-- fila del catalogo como ya registrada (dentro del `if p_catalogo_id is
-- not null`) referenciaba `congregacion_id` sin calificar, y Postgres no
-- puede decidir si es el parametro de salida o la columna de la tabla,
-- asi que rechaza la llamada en vez de adivinar. Solo se disparaba
-- cuando el distrital elegia una sugerencia del catalogo (por eso no se
-- detecto en pruebas anteriores, que probablemente escribieron el
-- nombre libremente sin seleccionar de la lista).
--
-- Corregido con `#variable_conflict use_column`: le dice a PL/pgSQL que,
-- ante esta ambiguedad especifica, use SIEMPRE la columna de la tabla
-- (que es el comportamiento correcto y esperado aqui) en vez de lanzar
-- error. Mismo cuerpo de funcion, sin ningun otro cambio de logica.
-- Ejecutar despues de catalogo_congregaciones_ipuc.sql. Es repetible.

create or replace function crear_congregacion_con_pastor(
  p_distrito_id uuid,
  p_nombre_congregacion text,
  p_pastor_nombres text,
  p_pastor_apellidos text,
  p_pastor_telefono text default null,
  p_ciudad text default null,
  p_catalogo_id uuid default null
) returns table (congregacion_id uuid, persona_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_congregacion_id uuid;
  v_persona_id uuid;
  v_pastor_id uuid;
  v_distrito_numero integer;
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

  insert into congregaciones (distrito_id, nombre, pastor_nombre, estado, ciudad)
  values (p_distrito_id, trim(p_nombre_congregacion), trim(p_pastor_nombres) || ' ' || trim(p_pastor_apellidos), 'pendiente_aprobacion', nullif(trim(p_ciudad), ''))
  returning id into v_congregacion_id;

  insert into personas (congregacion_id, nombres, apellidos, telefono, estado_membresia)
  values (v_congregacion_id, trim(p_pastor_nombres), trim(p_pastor_apellidos), nullif(trim(p_pastor_telefono), ''), 'activo')
  returning id into v_persona_id;

  insert into roles_sistema (persona_id, nivel, congregacion_id, rol_local, asignado_por)
  values (v_persona_id, 'local', v_congregacion_id, 'pastor', auth.uid());

  insert into pastores (distrito_id, nombres, apellidos, telefono, persona_id)
  values (p_distrito_id, trim(p_pastor_nombres), trim(p_pastor_apellidos), nullif(trim(p_pastor_telefono), ''), v_persona_id)
  returning id into v_pastor_id;

  insert into asignaciones_pastorales (pastor_id, distrito_id, congregacion_id, cargo, fecha_inicio)
  values (v_pastor_id, p_distrito_id, v_congregacion_id, 'Pastor local', current_date);

  update congregaciones set pastor_id = v_pastor_id where id = v_congregacion_id;

  if p_catalogo_id is not null then
    select numero into v_distrito_numero from distritos where id = p_distrito_id;
    update catalogo_congregaciones_ipuc
    set congregacion_id = v_congregacion_id
    where id = p_catalogo_id and distrito_numero = v_distrito_numero and congregacion_id is null;
  end if;

  return query select v_congregacion_id, v_persona_id;
end;
$$;

revoke all on function crear_congregacion_con_pastor(uuid, text, text, text, text, text, uuid) from public, anon;
grant execute on function crear_congregacion_con_pastor(uuid, text, text, text, text, text, uuid) to authenticated;
