-- SIGA - Catalogo de referencia de las congregaciones reales de la IPUC,
-- extraido de Debora (sistema oficial de la IPUC) el 2026-09-03: 35
-- distritos, 5367 congregaciones.
--
-- Es SOLO un catalogo de referencia -- NO crea tenants activos en
-- `congregaciones`. Se usa para que un lider distrital, al registrar una
-- congregacion nueva, elija el nombre oficial real en vez de escribirlo
-- a mano (evita typos y nombres distintos al censo real de la IPUC), y
-- para mostrarle cuantas le faltan por registrar en su distrito.
--
-- Se decidio NO precargar las 5367 como filas reales de `congregaciones`
-- porque cada una es un tenant activo que aparece en dashboards,
-- suscripciones, comites nacionales, etc. -- crear miles vacias de golpe
-- inflaria esas pantallas para siempre sin necesidad real. La fila real
-- en `congregaciones` se sigue creando solo cuando un distrital la activa
-- de verdad (con su primer pastor), igual que hoy.
--
-- Ejecutar despues de gestion_distrital_congregaciones.sql y
-- gestion_pastoral_distrital_v2.sql. Luego ejecutar
-- seed_catalogo_congregaciones_ipuc.sql (la carga de datos).

create table if not exists catalogo_congregaciones_ipuc (
  id uuid primary key default gen_random_uuid(),
  distrito_numero integer not null,
  nombre text not null,
  id_debora integer,
  congregacion_id uuid references congregaciones(id),
  created_at timestamptz not null default now(),
  unique (distrito_numero, nombre)
);

create index if not exists idx_catalogo_congregaciones_ipuc_distrito on catalogo_congregaciones_ipuc (distrito_numero);

alter table catalogo_congregaciones_ipuc enable row level security;

-- Un distrital solo ve el catalogo de su(s) propio(s) distrito(s);
-- nacional/super_admin ven todo. Es de solo lectura desde la app -- se
-- carga una sola vez via el seed, y se actualiza (columna congregacion_id)
-- unicamente desde crear_congregacion_con_pastor, con security definer.
drop policy if exists catalogo_congregaciones_ipuc_select on catalogo_congregaciones_ipuc;
create policy catalogo_congregaciones_ipuc_select on catalogo_congregaciones_ipuc
for select to authenticated
using (
  distrito_numero in (select numero from distritos where id in (select mis_distritos()))
  or es_nacional() or es_super_admin()
);

-- crear_congregacion_con_pastor: se agrega p_catalogo_id opcional -- si
-- se pasa, liga esa fila del catalogo con la congregacion recien creada
-- (solo si pertenece al mismo distrito que se esta registrando), para
-- que deje de aparecer como pendiente. Reemplaza la version de
-- gestion_pastoral_distrital_v2.sql (se elimina el overload viejo de 6
-- argumentos para no dejar dos versiones de la misma logica).
drop function if exists crear_congregacion_con_pastor(uuid, text, text, text, text, text);

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
