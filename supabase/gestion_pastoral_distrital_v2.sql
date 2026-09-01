-- SIGA - Rediseño del nivel distrital: consolidado por congregación, pastores
-- ligados a personas/acceso real, y catálogo de distritos con número.
-- Ejecutar despues de schema.sql, accesos.sql, pastoral_distrital.sql,
-- gestion_distrital_congregaciones.sql y seguridad_produccion.sql.
-- Es repetible (usa create or replace / add column if not exists).

-- 1. Ciudad/municipio de cada congregación (hoy no existía ningún campo de
--    ubicación) y número identificador de cada distrito (hoy los 36 distritos
--    de la IPUC solo se distinguen por nombre libre).
alter table congregaciones add column if not exists ciudad text;
alter table distritos add column if not exists numero integer unique;

-- 2. Vínculo real entre el registro pastoral/traslados (`pastores`) y el
--    censo/acceso de login (`personas`). Hasta ahora eran dos registros
--    paralelos que solo coincidían en nombre; un traslado nunca movía el
--    acceso real del pastor.
alter table pastores add column if not exists persona_id uuid references personas(id);

-- 3. crear_congregacion_con_pastor: agrega ciudad y liga el pastor a su persona.
create or replace function crear_congregacion_con_pastor(
  p_distrito_id uuid,
  p_nombre_congregacion text,
  p_pastor_nombres text,
  p_pastor_apellidos text,
  p_pastor_telefono text default null,
  p_ciudad text default null
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

  return query select v_congregacion_id, v_persona_id;
end;
$$;

revoke all on function crear_congregacion_con_pastor(uuid, text, text, text, text, text) from public, anon;
grant execute on function crear_congregacion_con_pastor(uuid, text, text, text, text, text) to authenticated;

-- 4. Alta de pastor para una congregación EXISTENTE y vacante, con el mismo
--    estándar de acceso real que crear_congregacion_con_pastor. Unifica
--    "Registrar pastor" (antes solo insertaba en pastores, sin acceso).
create or replace function registrar_pastor_con_acceso(
  p_congregacion_id uuid,
  p_pastor_nombres text,
  p_pastor_apellidos text,
  p_pastor_telefono text default null,
  p_cargo text default 'Pastor local'
) returns table (congregacion_id uuid, persona_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_distrito_id uuid;
  v_persona_id uuid;
  v_pastor_id uuid;
begin
  select distrito_id into v_distrito_id from congregaciones where id = p_congregacion_id;
  if v_distrito_id is null or not es_lider_distrital(v_distrito_id) then
    raise exception 'No tienes permisos sobre esa congregacion';
  end if;
  if exists (select 1 from asignaciones_pastorales ap where ap.congregacion_id = p_congregacion_id and ap.fecha_fin is null) then
    raise exception 'Esa congregacion ya tiene un pastor asignado';
  end if;
  if coalesce(trim(p_pastor_nombres), '') = '' or coalesce(trim(p_pastor_apellidos), '') = '' then
    raise exception 'El nombre del pastor es obligatorio';
  end if;

  insert into personas (congregacion_id, nombres, apellidos, telefono, estado_membresia)
  values (p_congregacion_id, trim(p_pastor_nombres), trim(p_pastor_apellidos), nullif(trim(p_pastor_telefono), ''), 'activo')
  returning id into v_persona_id;

  insert into roles_sistema (persona_id, nivel, congregacion_id, rol_local, asignado_por)
  values (v_persona_id, 'local', p_congregacion_id, 'pastor', auth.uid());

  insert into pastores (distrito_id, nombres, apellidos, telefono, persona_id)
  values (v_distrito_id, trim(p_pastor_nombres), trim(p_pastor_apellidos), nullif(trim(p_pastor_telefono), ''), v_persona_id)
  returning id into v_pastor_id;

  insert into asignaciones_pastorales (pastor_id, distrito_id, congregacion_id, cargo, fecha_inicio)
  values (v_pastor_id, v_distrito_id, p_congregacion_id, coalesce(nullif(trim(p_cargo), ''), 'Pastor local'), current_date);

  update congregaciones set pastor_id = v_pastor_id, pastor_nombre = trim(p_pastor_nombres) || ' ' || trim(p_pastor_apellidos) where id = p_congregacion_id;

  return query select p_congregacion_id, v_persona_id;
end;
$$;

revoke all on function registrar_pastor_con_acceso(uuid, text, text, text, text) from public, anon;
grant execute on function registrar_pastor_con_acceso(uuid, text, text, text, text) to authenticated;

-- 5. trasladar_pastor: ahora también mueve el acceso real de login del
--    pastor (si tiene persona vinculada) a la congregación destino, para que
--    quien inicia sesión vea la congregación correcta después del traslado.
create or replace function trasladar_pastor(
  p_pastor_id uuid,
  p_congregacion_destino uuid,
  p_fecha date default current_date,
  p_observaciones text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_distrito_id uuid;
  v_congregacion_origen uuid;
  v_asignacion_id uuid;
  v_persona_id uuid;
begin
  select distrito_id, persona_id into v_distrito_id, v_persona_id from pastores where id = p_pastor_id;
  if v_distrito_id is null or not es_lider_distrital(v_distrito_id) then
    raise exception 'No tienes permisos para trasladar este pastor';
  end if;
  if not exists (select 1 from congregaciones where id = p_congregacion_destino and distrito_id = v_distrito_id) then
    raise exception 'La congregación destino no pertenece a tu distrito';
  end if;
  if exists (select 1 from asignaciones_pastorales where pastor_id = p_pastor_id and fecha_fin is null and congregacion_id = p_congregacion_destino) then
    raise exception 'El pastor ya está asignado a esa congregación';
  end if;
  select congregacion_id into v_congregacion_origen from asignaciones_pastorales where pastor_id = p_pastor_id and fecha_fin is null limit 1;
  if exists (select 1 from asignaciones_pastorales where congregacion_id = p_congregacion_destino and fecha_fin is null) then
    raise exception 'La congregación destino ya tiene un pastor asignado';
  end if;
  update asignaciones_pastorales set fecha_fin = greatest(p_fecha - 1, fecha_inicio), observaciones = coalesce(p_observaciones, observaciones)
    where pastor_id = p_pastor_id and fecha_fin is null;
  insert into asignaciones_pastorales (pastor_id, distrito_id, congregacion_id, cargo, fecha_inicio, observaciones)
    values (p_pastor_id, v_distrito_id, p_congregacion_destino, 'Pastor local', p_fecha, p_observaciones)
    returning id into v_asignacion_id;
  update congregaciones set pastor_id = null where pastor_id = p_pastor_id;
  update congregaciones set pastor_id = p_pastor_id where id = p_congregacion_destino;

  if v_persona_id is not null then
    update personas set congregacion_id = p_congregacion_destino where id = v_persona_id;
    update roles_sistema set congregacion_id = p_congregacion_destino
      where persona_id = v_persona_id and nivel = 'local' and fecha_fin is null;
  end if;

  return v_asignacion_id;
end;
$$;

-- 6. Comparativa distrital: una fila por congregación del distrito, con lo
--    necesario para que un líder distrital compare crecimiento/deserción
--    entre congregaciones y lo lea junto al pastor que las dirige.
create or replace function resumen_distrital(p_distrito_id uuid)
returns table (
  congregacion_id uuid,
  nombre text,
  ciudad text,
  estado text,
  pastor_nombre text,
  personas_activas bigint,
  bautizados bigint,
  familias_asociadas bigint,
  personas_nuevas_3m bigint,
  asistencia_ultimo_mes bigint,
  asistencia_mes_anterior bigint
)
language sql stable security invoker set search_path = public as $$
  select
    c.id as congregacion_id,
    c.nombre,
    c.ciudad,
    c.estado,
    c.pastor_nombre,
    coalesce(r.personas_activas, 0),
    coalesce(r.bautizados, 0),
    coalesce(r.familias_asociadas, 0),
    coalesce((
      select count(*) from personas p
      where p.congregacion_id = c.id and p.created_at >= now() - interval '3 months'
    ), 0) as personas_nuevas_3m,
    coalesce((
      select sum(a.total_asistentes) from registros_actividad a
      where a.congregacion_id = c.id and a.fecha >= (current_date - interval '30 days')
    ), 0) as asistencia_ultimo_mes,
    coalesce((
      select sum(a.total_asistentes) from registros_actividad a
      where a.congregacion_id = c.id and a.fecha >= (current_date - interval '60 days') and a.fecha < (current_date - interval '30 days')
    ), 0) as asistencia_mes_anterior
  from congregaciones c
  left join vw_resumen_feligresia r on r.congregacion_id = c.id
  where c.distrito_id = p_distrito_id
    and c.id in (select mis_congregaciones())
  order by c.nombre;
$$;

revoke all on function resumen_distrital(uuid) from public, anon;
grant execute on function resumen_distrital(uuid) to authenticated;

-- 7. Catálogo de distritos: solo nacional/super_admin pueden crear o editar
--    distritos (número + nombre). La lectura ya está cubierta por
--    distritos_select_authenticated.
drop policy if exists distritos_write_nacional on distritos;
create policy distritos_write_nacional on distritos for all to authenticated
using (es_nacional() or es_super_admin())
with check (es_nacional() or es_super_admin());
