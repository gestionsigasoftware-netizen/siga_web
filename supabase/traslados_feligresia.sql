-- SIGA - Traslado real de un feligres entre congregaciones (carta de
-- traslado), preservando el mismo registro y todo su historial
-- (bautismo, sellado, familia, cargos, seguimientos) en vez de recrearlo
-- desde cero en la congregacion destino.
-- Ejecutar despues de schema.sql, accesos.sql, feligresia.sql e
-- hitos_espirituales.sql. Es repetible.
--
-- Problema que resuelve: lo unico que existia hasta ahora
-- (movimientos_membresia tipo 'baja_traslado'/'alta_recibimiento') es
-- solo una anotacion estadistica para el conteo nacional de altas/bajas
-- -- nunca movia realmente a la persona ni la vinculaba a la
-- congregacion destino. Si el pastor receptor queria registrarla, tenia
-- que crearla como persona nueva, perdiendo todo el historial.
--
-- Flujo (como una carta de traslado real): el pastor de origen inicia el
-- traslado (la persona queda 'trasladado' y deja de contar como activa
-- en el censo de origen); el pastor de destino la recibe con un clic, y
-- el MISMO registro pasa a pertenecer a su congregacion, ya activo.

create table if not exists traslados_feligresia (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  congregacion_origen_id uuid not null references congregaciones(id) on delete cascade,
  congregacion_destino_id uuid not null references congregaciones(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'recibido', 'cancelado')),
  fecha_solicitud date not null default current_date,
  fecha_recibido date,
  observaciones text,
  solicitado_por uuid references auth.users(id),
  recibido_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (congregacion_origen_id <> congregacion_destino_id)
);

create index if not exists traslados_feligresia_origen_idx on traslados_feligresia (congregacion_origen_id, estado);
create index if not exists traslados_feligresia_destino_idx on traslados_feligresia (congregacion_destino_id, estado);
create index if not exists traslados_feligresia_persona_idx on traslados_feligresia (persona_id);

-- Solo puede haber un traslado pendiente a la vez por persona.
create unique index if not exists traslados_feligresia_pendiente_unico on traslados_feligresia (persona_id) where estado = 'pendiente';

alter table traslados_feligresia enable row level security;

drop policy if exists traslados_feligresia_read on traslados_feligresia;
create policy traslados_feligresia_read on traslados_feligresia for select to authenticated
using (
  congregacion_origen_id in (select mis_congregaciones())
  or congregacion_destino_id in (select mis_congregaciones())
  or es_super_admin() or es_nacional()
);

revoke all on traslados_feligresia from public, anon;
grant select on traslados_feligresia to authenticated;

-- 1. El pastor de origen inicia el traslado.
create or replace function solicitar_traslado_persona(
  p_persona_id uuid,
  p_congregacion_destino_id uuid,
  p_observaciones text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_origen uuid;
  v_traslado_id uuid;
begin
  select congregacion_id into v_origen from personas where id = p_persona_id;
  if v_origen is null then
    raise exception 'La persona no existe';
  end if;
  if not (puede_administrar_feligresia(v_origen) or es_super_admin() or es_nacional()) then
    raise exception 'No tienes permisos para trasladar personas de esa congregación';
  end if;
  if not exists (select 1 from congregaciones where id = p_congregacion_destino_id) then
    raise exception 'La congregación destino no existe';
  end if;
  if p_congregacion_destino_id = v_origen then
    raise exception 'La congregación destino debe ser distinta a la de origen';
  end if;
  if exists (select 1 from traslados_feligresia where persona_id = p_persona_id and estado = 'pendiente') then
    raise exception 'Esta persona ya tiene un traslado pendiente';
  end if;

  update personas set estado_membresia = 'trasladado' where id = p_persona_id;

  insert into movimientos_membresia (persona_id, congregacion_id, tipo, fecha, congregacion_relacionada_id, observaciones, registrado_por)
  values (p_persona_id, v_origen, 'baja_traslado', current_date, p_congregacion_destino_id, p_observaciones, auth.uid());

  insert into traslados_feligresia (persona_id, congregacion_origen_id, congregacion_destino_id, observaciones, solicitado_por)
  values (p_persona_id, v_origen, p_congregacion_destino_id, p_observaciones, auth.uid())
  returning id into v_traslado_id;

  return v_traslado_id;
end;
$$;

revoke all on function solicitar_traslado_persona(uuid, uuid, text) from public, anon;
grant execute on function solicitar_traslado_persona(uuid, uuid, text) to authenticated;

-- 2. El pastor de destino recibe el traslado — el mismo registro (mismo
--    historial de bautismo, sellado, familia, cargos) pasa a pertenecer
--    a su congregacion.
create or replace function recibir_traslado_persona(p_traslado_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_traslado traslados_feligresia%rowtype;
begin
  select * into v_traslado from traslados_feligresia where id = p_traslado_id;
  if v_traslado.id is null then
    raise exception 'El traslado no existe';
  end if;
  if v_traslado.estado <> 'pendiente' then
    raise exception 'Este traslado ya fue procesado';
  end if;
  if not (puede_administrar_feligresia(v_traslado.congregacion_destino_id) or es_super_admin() or es_nacional()) then
    raise exception 'No tienes permisos para recibir traslados en esa congregación';
  end if;

  update personas set congregacion_id = v_traslado.congregacion_destino_id, estado_membresia = 'activo' where id = v_traslado.persona_id;

  update traslados_feligresia set estado = 'recibido', fecha_recibido = current_date, recibido_por = auth.uid() where id = p_traslado_id;

  insert into movimientos_membresia (persona_id, congregacion_id, tipo, fecha, congregacion_relacionada_id, registrado_por)
  values (v_traslado.persona_id, v_traslado.congregacion_destino_id, 'alta_recibimiento', current_date, v_traslado.congregacion_origen_id, auth.uid());
end;
$$;

revoke all on function recibir_traslado_persona(uuid) from public, anon;
grant execute on function recibir_traslado_persona(uuid) to authenticated;

-- 3. El pastor de origen puede cancelar un traslado que aun no ha sido
--    recibido (ej. se solicito por error).
create or replace function cancelar_traslado_persona(p_traslado_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_traslado traslados_feligresia%rowtype;
begin
  select * into v_traslado from traslados_feligresia where id = p_traslado_id;
  if v_traslado.id is null then
    raise exception 'El traslado no existe';
  end if;
  if v_traslado.estado <> 'pendiente' then
    raise exception 'Este traslado ya fue procesado';
  end if;
  if not (puede_administrar_feligresia(v_traslado.congregacion_origen_id) or es_super_admin() or es_nacional()) then
    raise exception 'No tienes permisos para cancelar este traslado';
  end if;

  update personas set estado_membresia = 'activo' where id = v_traslado.persona_id;
  update traslados_feligresia set estado = 'cancelado' where id = p_traslado_id;
end;
$$;

revoke all on function cancelar_traslado_persona(uuid) from public, anon;
grant execute on function cancelar_traslado_persona(uuid) to authenticated;

-- Busqueda nacional de congregaciones para elegir el destino del
-- traslado (cualquier usuario autenticado puede ver nombre/ciudad/distrito
-- de cualquier congregacion — no expone datos sensibles del censo).
create or replace function buscar_congregaciones(p_busqueda text default '')
returns table (id uuid, nombre text, ciudad text, distrito_nombre text, distrito_numero integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.nombre, c.ciudad, d.nombre, d.numero
  from congregaciones c
  join distritos d on d.id = c.distrito_id
  where c.estado = 'activa'
    and (p_busqueda = '' or c.nombre ilike '%' || p_busqueda || '%' or c.ciudad ilike '%' || p_busqueda || '%')
  order by c.nombre
  limit 20;
$$;

revoke all on function buscar_congregaciones(text) from public, anon;
grant execute on function buscar_congregaciones(text) to authenticated;
