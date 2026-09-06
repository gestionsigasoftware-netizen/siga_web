-- SIGA - Gestion pastoral distrital.
-- Ejecutar despues de schema.sql y accesos.sql.
-- Modulo exclusivo para lideres con nivel distrital.

create table if not exists pastores (
  id uuid primary key default gen_random_uuid(),
  distrito_id uuid not null references distritos(id) on delete cascade,
  nombres text not null,
  apellidos text not null,
  telefono text,
  familia_pastoral text,
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists asignaciones_pastorales (
  id uuid primary key default gen_random_uuid(),
  pastor_id uuid not null references pastores(id) on delete cascade,
  distrito_id uuid not null references distritos(id) on delete cascade,
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  cargo text not null default 'Pastor local',
  fecha_inicio date not null default current_date,
  fecha_fin date,
  observaciones text,
  created_at timestamptz not null default now(),
  check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

alter table congregaciones add column if not exists pastor_id uuid references pastores(id) on delete set null;

create or replace function validar_asignacion_pastoral()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from congregaciones c where c.id = new.congregacion_id and c.distrito_id = new.distrito_id) then
    raise exception 'La congregacion debe pertenecer al distrito indicado';
  end if;
  if new.fecha_fin is null and exists (
    select 1 from asignaciones_pastorales a
    where a.congregacion_id = new.congregacion_id and a.fecha_fin is null and a.id <> new.id
  ) then
    raise exception 'La congregacion ya tiene un pastor asignado';
  end if;
  return new;
end;
$$;

drop trigger if exists asignaciones_pastorales_integridad on asignaciones_pastorales;
create trigger asignaciones_pastorales_integridad before insert or update on asignaciones_pastorales
for each row execute function validar_asignacion_pastoral();

create or replace function es_lider_distrital(p_distrito_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roles_sistema r
    where r.persona_id = mi_persona_id()
      and r.nivel = 'distrital'
      and r.distrito_id = p_distrito_id
      and r.fecha_fin is null
  );
$$;

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
begin
  select distrito_id into v_distrito_id from pastores where id = p_pastor_id;
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
  update asignaciones_pastorales set fecha_fin = p_fecha - 1, observaciones = coalesce(p_observaciones, observaciones)
    where pastor_id = p_pastor_id and fecha_fin is null;
  insert into asignaciones_pastorales (pastor_id, distrito_id, congregacion_id, cargo, fecha_inicio, observaciones)
    values (p_pastor_id, v_distrito_id, p_congregacion_destino, 'Pastor local', p_fecha, p_observaciones)
    returning id into v_asignacion_id;
  update congregaciones set pastor_id = null where pastor_id = p_pastor_id;
  update congregaciones set pastor_id = p_pastor_id where id = p_congregacion_destino;
  return v_asignacion_id;
end;
$$;

alter table pastores enable row level security;
alter table asignaciones_pastorales enable row level security;

drop policy if exists pastores_distrital_read on pastores;
create policy pastores_distrital_read on pastores for select to authenticated
using (es_lider_distrital(distrito_id));

drop policy if exists pastores_distrital_write on pastores;
create policy pastores_distrital_write on pastores for all to authenticated
using (es_lider_distrital(distrito_id))
with check (es_lider_distrital(distrito_id));

drop policy if exists asignaciones_pastorales_distrital_read on asignaciones_pastorales;
create policy asignaciones_pastorales_distrital_read on asignaciones_pastorales for select to authenticated
using (es_lider_distrital(distrito_id));

drop policy if exists asignaciones_pastorales_distrital_write on asignaciones_pastorales;
create policy asignaciones_pastorales_distrital_write on asignaciones_pastorales for all to authenticated
using (es_lider_distrital(distrito_id))
with check (es_lider_distrital(distrito_id));

drop policy if exists congregaciones_pastor_distrital_read on congregaciones;
create policy congregaciones_pastor_distrital_read on congregaciones for select to authenticated
using (distrito_id in (select mis_distritos()));

drop policy if exists congregaciones_pastor_distrital_update on congregaciones;
create policy congregaciones_pastor_distrital_update on congregaciones for update to authenticated
using (es_lider_distrital(distrito_id))
with check (es_lider_distrital(distrito_id));

create index if not exists asignaciones_pastorales_distrito_idx on asignaciones_pastorales (distrito_id, fecha_fin, fecha_inicio desc);
create index if not exists asignaciones_pastorales_congregacion_idx on asignaciones_pastorales (congregacion_id, fecha_fin);
