-- SIGA - Rediseño del nivel distrital: consolidado por congregación, pastores
-- ligados a personas/acceso real, y catálogo de distritos con número.
-- Ejecutar despues de schema.sql, accesos.sql, pastoral_distrital.sql,
-- gestion_distrital_congregaciones.sql y seguridad_produccion.sql.
-- Es repetible (usa create or replace / add column if not exists).
--
-- Correccion 2026-09-01: trasladar_pastor() actualizaba pastor_id en la
-- congregacion origen y destino, pero nunca sincronizaba el campo de texto
-- pastor_nombre (usado para mostrar el nombre del pastor en el Dashboard
-- distrital, resumen_distrital() y Aprobaciones) — por eso, tras un
-- traslado, la congregacion destino seguia mostrando el nombre del pastor
-- anterior (o el de la creacion de la congregacion), y la de origen seguia
-- mostrando el pastor que ya se fue en vez de "Vacante". Se corrigio para
-- que ambos lados queden sincronizados, igual que ya hacia
-- registrar_pastor_con_acceso().

-- 1. Ciudad/municipio de cada congregación (hoy no existía ningún campo de
--    ubicación) y número identificador de cada distrito (hoy los 36 distritos
--    de la IPUC solo se distinguen por nombre libre).
alter table congregaciones add column if not exists ciudad text;
-- pastor_nombre era NOT NULL desde el esquema original, pero el Dashboard
-- (`c.pastor_nombre || 'Vacante'`, `!c.pastor_nombre` para contar vacantes)
-- ya esperaba que pudiera quedar vacio cuando una congregacion no tiene
-- pastor — esa restriccion nunca se relajo. Se corrige aqui junto con
-- trasladar_pastor() para que "vacante" se represente de verdad como null.
alter table congregaciones alter column pastor_nombre drop not null;

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
  update congregaciones set pastor_id = null, pastor_nombre = null where pastor_id = p_pastor_id;
  update congregaciones set pastor_id = p_pastor_id, pastor_nombre = (select trim(nombres || ' ' || apellidos) from pastores where id = p_pastor_id) where id = p_congregacion_destino;

  if v_persona_id is not null then
    update personas set congregacion_id = p_congregacion_destino where id = v_persona_id;
    update roles_sistema set congregacion_id = p_congregacion_destino
      where persona_id = v_persona_id and nivel = 'local' and fecha_fin is null;
  end if;

  return v_asignacion_id;
end;
$$;

-- Correccion de datos de una sola vez (segura de repetir): recalcula
-- pastor_nombre de TODAS las congregaciones a partir de su pastor_id real,
-- para arreglar cualquier congregacion que haya quedado con el nombre del
-- pastor desincronizado por el bug de trasladar_pastor() corregido arriba
-- (incluye tanto congregaciones con un pastor asignado como las vacantes,
-- que deben quedar en null para mostrar "Vacante").
update congregaciones c
set pastor_nombre = (select trim(p.nombres || ' ' || p.apellidos) from pastores p where p.id = c.pastor_id)
where c.pastor_nombre is distinct from (select trim(p.nombres || ' ' || p.apellidos) from pastores p where p.id = c.pastor_id);

-- 6. Comparativa distrital (resumen_distrital): la definicion original de
-- este archivo se retiro de aqui porque `bi_fase2_insights.sql` la
-- reemplazo con una version ampliada (19 columnas, incluye madurez,
-- sellados, embudo de conversion, etc.) y se ejecuta DESPUES de este
-- archivo — dejar ambas definiciones aqui hacia que volver a correr este
-- archivo fallara con "cannot change return type of existing function"
-- al chocar con la version mas nueva ya aplicada. La funcion sigue
-- existiendo y funcionando igual; su definicion vigente esta en
-- bi_fase2_insights.sql, que ya incluye pastor_nombre y por lo tanto ya
-- refleja la correccion de trasladar_pastor() de mas arriba.

-- 7. Catálogo de distritos: solo nacional/super_admin pueden crear o editar
--    distritos (número + nombre). La lectura ya está cubierta por
--    distritos_select_authenticated.
drop policy if exists distritos_write_nacional on distritos;
create policy distritos_write_nacional on distritos for all to authenticated
using (es_nacional() or es_super_admin())
with check (es_nacional() or es_super_admin());
