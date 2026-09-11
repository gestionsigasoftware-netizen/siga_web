-- =============================================================================
-- Fix: las congregaciones creadas con crear_congregacion_con_pastor() nunca
-- reciben los 3 "modulos de sistema" (Evangelismo, Mision Juvenil, Obra
-- Carcelaria).
--
-- Causa: esos 3 modulos se siembran con un bloque `do $$ for v_congregacion
-- in select id from congregaciones loop ... end $$` -- un backfill de UNA
-- SOLA VEZ sobre las congregaciones que existian cuando se ejecuto
-- evangelismo.sql / mision_juvenil.sql / sembrar_modulo_obra_carcelaria.sql.
-- Ninguna congregacion creada DESPUES de esas migraciones (con
-- crear_congregacion_con_pastor(), el flujo real de alta de congregaciones)
-- vuelve a pasar por ese backfill -- se quedan sin esos modulos para
-- siempre, a menos que alguien re-ejecute esos 3 archivos a mano.
--
-- Impacto real (encontrado sobre AGUA BONITA SUAREZ CAUCA, congregacion
-- real ya en uso): Evangelismo.jsx y MisionJuvenil.jsx buscan su modulo por
-- nombre exacto (`ilike nombre_modulo 'Evangelismo'` / `'Mision Juvenil'`) y
-- si no existe, la pantalla queda en silencio con listas vacias y sin
-- explicacion -- no hay ningun mensaje de "modulo no configurado". Ademas,
-- "Responsabilidad operativa" en Equipo de trabajo no tiene nada que
-- ofrecer para esos 3 modulos porque no hay fila en `modulos` de la que
-- colgar un cargo.
--
-- Esto afecta a TODA congregacion nueva de aqui en adelante, no solo a la
-- que reporto el usuario.
--
-- Ejecutar en el SQL Editor de Supabase, en orden: primero crea la funcion
-- reutilizable, despues corrige retroactivamente TODAS las congregaciones
-- reales existentes (idempotente, no duplica nada si ya tienen el modulo),
-- y por ultimo actualiza crear_congregacion_con_pastor() para que toda
-- congregacion nueva salga completa desde el primer momento.
-- =============================================================================

-- 1) Funcion reutilizable: crea (si no existen) los 3 modulos de sistema
-- para UNA congregacion, con el mismo catalogo de tipos_actividad que ya
-- usan evangelismo.sql y mision_juvenil.sql. Solo la puede ejecutar el
-- dueño de la funcion (postgres) -- no se expone a usuarios autenticados,
-- para que nadie la use para sembrar modulos en una congregacion ajena.
create or replace function sembrar_modulos_sistema_congregacion(p_congregacion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_modulo_id uuid;
  v_metodo text;
begin
  select id into v_modulo_id from modulos where congregacion_id = p_congregacion_id and lower(nombre_modulo) = 'evangelismo' limit 1;
  if v_modulo_id is null then
    insert into modulos (congregacion_id, nombre_modulo, alcance, requiere_zona)
    values (p_congregacion_id, 'Evangelismo', 'extramural', true)
    returning id into v_modulo_id;
  end if;
  foreach v_metodo in array array['REFAM', 'Culto de barrio', 'Culto relampago', 'Celula', 'Discipulado', 'Visita', 'Culto en salon', 'Evangelismo hospitalario', 'Evangelismo en medios de comunicacion', 'Evangelismo en grupos especiales'] loop
    insert into tipos_actividad (modulo_id, nombre, caracter)
    select v_modulo_id, v_metodo, 'Evangelismo'
    where not exists (select 1 from tipos_actividad where modulo_id = v_modulo_id and lower(nombre) = lower(v_metodo));
  end loop;

  select id into v_modulo_id from modulos where congregacion_id = p_congregacion_id and lower(nombre_modulo) = 'mision juvenil' limit 1;
  if v_modulo_id is null then
    insert into modulos (congregacion_id, nombre_modulo, alcance, requiere_zona)
    values (p_congregacion_id, 'Mision Juvenil', 'extramural', true)
    returning id into v_modulo_id;
  end if;
  foreach v_metodo in array array['Charla de valores', 'REFAM Juvenil', 'Celula Juvenil', 'Discipulado Juvenil', 'Culto Juvenil'] loop
    insert into tipos_actividad (modulo_id, nombre, caracter)
    select v_modulo_id, v_metodo, 'Mision Juvenil'
    where not exists (select 1 from tipos_actividad where modulo_id = v_modulo_id and lower(nombre) = lower(v_metodo));
  end loop;

  if not exists (select 1 from modulos where congregacion_id = p_congregacion_id and lower(nombre_modulo) = 'obra carcelaria') then
    insert into modulos (congregacion_id, nombre_modulo, alcance, requiere_zona)
    values (p_congregacion_id, 'Obra Carcelaria', 'extramural', false);
  end if;
end;
$$;

revoke all on function sembrar_modulos_sistema_congregacion(uuid) from public, anon, authenticated;

-- 2) Backfill retroactivo: corrige a todas las congregaciones reales que ya
-- existen (incluida Agua Bonita) sin esperar a que alguien vuelva a crearlas.
do $$
declare
  v_congregacion record;
begin
  for v_congregacion in select id from congregaciones loop
    perform sembrar_modulos_sistema_congregacion(v_congregacion.id);
  end loop;
end $$;

-- 3) A partir de ahora, toda congregacion nueva sale completa desde el
-- alta -- mismo cuerpo de crear_congregacion_con_pastor() que ya corrige
-- fix_ambiguedad_congregacion_id_catalogo.sql, solo se agrega la siembra
-- de modulos justo antes de devolver el resultado.
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

  perform sembrar_modulos_sistema_congregacion(v_congregacion_id);

  return query select v_congregacion_id, v_persona_id;
end;
$$;

revoke all on function crear_congregacion_con_pastor(uuid, text, text, text, text, text, uuid) from public, anon;
grant execute on function crear_congregacion_con_pastor(uuid, text, text, text, text, text, uuid) to authenticated;
