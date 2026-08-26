-- SIGA - Administracion de feligresia local.
-- Ejecutar despues de schema.sql y migracion_produccion.sql.
-- No depende de la PWA: es el censo administrativo de la congregacion.

alter table personas add column if not exists estado_membresia text not null default 'activo'
  check (estado_membresia in ('activo', 'apartado', 'trasladado', 'inactivo', 'fallecido'));
alter table personas add column if not exists bautizado boolean not null default false;
alter table personas add column if not exists fecha_bautismo date;
alter table personas add column if not exists fecha_ingreso date;
alter table personas add column if not exists fecha_ultima_asistencia date;
alter table personas add column if not exists observaciones_pastorales text;

create table if not exists familias (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre_familia text not null,
  direccion text,
  telefono text,
  created_at timestamptz not null default now()
);

alter table personas add column if not exists familia_id uuid references familias(id) on delete set null;
alter table personas add column if not exists parentesco_familiar text;

create or replace function validar_familia_de_persona()
returns trigger language plpgsql as $$
begin
  if new.familia_id is not null and not exists (
    select 1 from familias f
    where f.id = new.familia_id
      and f.congregacion_id = new.congregacion_id
  ) then
    raise exception 'La familia debe pertenecer a la misma congregación que la persona';
  end if;
  return new;
end;
$$;

drop trigger if exists personas_familia_misma_congregacion on personas;
create trigger personas_familia_misma_congregacion
before insert or update of familia_id, congregacion_id on personas
for each row execute function validar_familia_de_persona();

create table if not exists comites (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists membresias_comite (
  id uuid primary key default gen_random_uuid(),
  comite_id uuid not null references comites(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  cargo text,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  created_at timestamptz not null default now(),
  unique (comite_id, persona_id, fecha_inicio)
);

create table if not exists historial_cargos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  nombre_cargo text not null,
  area text,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists seguimientos_pastorales (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  tipo_alerta text,
  accion text not null,
  notas text,
  fecha date not null default current_date,
  proxima_fecha date,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'completado', 'cancelado')),
  usuario_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table seguimientos_pastorales add column if not exists proxima_fecha date;
alter table seguimientos_pastorales add column if not exists estado text not null default 'pendiente';
do $$ begin
  alter table seguimientos_pastorales add constraint seguimientos_pastorales_estado_check check (estado in ('pendiente', 'completado', 'cancelado'));
exception when duplicate_object then null;
end $$;

create table if not exists estados_alerta_pastoral (
  clave text primary key,
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  estado text not null default 'atendida' check (estado in ('atendida', 'reabierta')),
  notas text,
  atendida_por uuid references auth.users(id) on delete set null,
  atendida_en timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists auditoria_feligresia (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  entidad text not null,
  entidad_id uuid,
  entidad_clave text,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,
  despues jsonb,
  usuario_id uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now()
);

create or replace function registrar_auditoria_feligresia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fila jsonb;
  fila_anterior jsonb;
  congregacion uuid;
  entidad_id uuid;
begin
  fila := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  fila_anterior := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  entidad_id := case when fila->>'id' is not null then (fila->>'id')::uuid else null end;
  congregacion := (fila->>'congregacion_id')::uuid;
  if tg_table_name = 'membresias_comite' and congregacion is null then
    select c.congregacion_id into congregacion from comites c where c.id = (fila->>'comite_id')::uuid;
  elsif tg_table_name = 'historial_cargos' and congregacion is null then
    select p.congregacion_id into congregacion from personas p where p.id = (fila->>'persona_id')::uuid;
  end if;
  if congregacion is not null then
    insert into auditoria_feligresia (congregacion_id, entidad, entidad_id, entidad_clave, accion, antes, despues)
    values (congregacion, tg_table_name, entidad_id, fila->>'clave', tg_op, fila_anterior, case when tg_op = 'DELETE' then null else fila end);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists personas_auditoria on personas;
create trigger personas_auditoria after insert or update or delete on personas for each row execute function registrar_auditoria_feligresia();
drop trigger if exists familias_auditoria on familias;
create trigger familias_auditoria after insert or update or delete on familias for each row execute function registrar_auditoria_feligresia();
drop trigger if exists comites_auditoria on comites;
create trigger comites_auditoria after insert or update or delete on comites for each row execute function registrar_auditoria_feligresia();
drop trigger if exists membresias_comite_auditoria on membresias_comite;
create trigger membresias_comite_auditoria after insert or update or delete on membresias_comite for each row execute function registrar_auditoria_feligresia();
drop trigger if exists historial_cargos_auditoria on historial_cargos;
create trigger historial_cargos_auditoria after insert or update or delete on historial_cargos for each row execute function registrar_auditoria_feligresia();
drop trigger if exists seguimientos_pastorales_auditoria on seguimientos_pastorales;
create trigger seguimientos_pastorales_auditoria after insert or update or delete on seguimientos_pastorales for each row execute function registrar_auditoria_feligresia();
drop trigger if exists estados_alerta_pastoral_auditoria on estados_alerta_pastoral;
create trigger estados_alerta_pastoral_auditoria after insert or update or delete on estados_alerta_pastoral for each row execute function registrar_auditoria_feligresia();

create or replace function validar_nombre_familia_unico()
returns trigger language plpgsql as $$
declare
  existe boolean;
begin
  select exists (select 1 from familias f where f.congregacion_id = new.congregacion_id
    and lower(trim(f.nombre_familia)) = lower(trim(new.nombre_familia)) and f.id <> new.id) into existe;
  if existe then
    raise exception 'Ya existe otra familia con ese nombre en la congregación';
  end if;
  return new;
end;
$$;

drop trigger if exists familias_nombre_unico on familias;
create trigger familias_nombre_unico before insert or update of nombre_familia, congregacion_id on familias
for each row execute function validar_nombre_familia_unico();

create or replace function validar_nombre_comite_unico()
returns trigger language plpgsql as $$
declare
  existe boolean;
begin
  select exists (select 1 from comites c where c.congregacion_id = new.congregacion_id
    and lower(trim(c.nombre)) = lower(trim(new.nombre)) and c.id <> new.id) into existe;
  if existe then
    raise exception 'Ya existe otro comité con ese nombre en la congregación';
  end if;
  return new;
end;
$$;

drop trigger if exists comites_nombre_unico on comites;
create trigger comites_nombre_unico before insert or update of nombre, congregacion_id on comites
for each row execute function validar_nombre_comite_unico();

create or replace function validar_membresia_comite()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from comites c join personas p on p.congregacion_id = c.congregacion_id
    where c.id = new.comite_id and p.id = new.persona_id
  ) then
    raise exception 'El comité y la persona deben pertenecer a la misma congregación';
  end if;
  if new.fecha_fin is null and exists (
    select 1 from membresias_comite mc
    where mc.comite_id = new.comite_id and mc.persona_id = new.persona_id
      and mc.fecha_fin is null and mc.id <> new.id
  ) then
    raise exception 'La persona ya tiene una membresía activa en este comité';
  end if;
  return new;
end;
$$;

drop trigger if exists membresia_comite_integridad on membresias_comite;
create trigger membresia_comite_integridad before insert or update on membresias_comite
for each row execute function validar_membresia_comite();

alter table familias enable row level security;
alter table comites enable row level security;
alter table membresias_comite enable row level security;
alter table historial_cargos enable row level security;
alter table seguimientos_pastorales enable row level security;
alter table estados_alerta_pastoral enable row level security;
alter table auditoria_feligresia enable row level security;

drop policy if exists familias_scope on familias;
create policy familias_scope on familias for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

drop policy if exists comites_scope on comites;
create policy comites_scope on comites for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

drop policy if exists membresias_comite_scope on membresias_comite;
create policy membresias_comite_scope on membresias_comite for all to authenticated
using (exists (
  select 1 from comites c join personas p on p.congregacion_id = c.congregacion_id
  where c.id = membresias_comite.comite_id and p.id = membresias_comite.persona_id
    and c.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from comites c join personas p on p.congregacion_id = c.congregacion_id
  where c.id = membresias_comite.comite_id and p.id = membresias_comite.persona_id
    and c.congregacion_id in (select mis_congregaciones())
));

drop policy if exists historial_cargos_scope on historial_cargos;
create policy historial_cargos_scope on historial_cargos for all to authenticated
using (exists (select 1 from personas p where p.id = historial_cargos.persona_id and p.congregacion_id in (select mis_congregaciones())))
with check (exists (select 1 from personas p where p.id = historial_cargos.persona_id and p.congregacion_id in (select mis_congregaciones())));

drop policy if exists seguimientos_pastorales_scope on seguimientos_pastorales;
create policy seguimientos_pastorales_scope on seguimientos_pastorales for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (
  congregacion_id in (select mis_congregaciones())
  and exists (select 1 from personas p where p.id = seguimientos_pastorales.persona_id and p.congregacion_id = seguimientos_pastorales.congregacion_id)
);

drop policy if exists estados_alerta_pastoral_scope on estados_alerta_pastoral;
create policy estados_alerta_pastoral_scope on estados_alerta_pastoral for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

drop policy if exists auditoria_feligresia_read on auditoria_feligresia;
create policy auditoria_feligresia_read on auditoria_feligresia for select to authenticated
using (congregacion_id in (select mis_congregaciones()));

create index if not exists personas_feligresia_estado_idx on personas (congregacion_id, estado_membresia, bautizado);
create index if not exists personas_familia_idx on personas (familia_id);
create index if not exists seguimientos_pastorales_persona_fecha_idx on seguimientos_pastorales (persona_id, fecha desc);
create index if not exists seguimientos_pastorales_agenda_idx on seguimientos_pastorales (congregacion_id, estado, proxima_fecha);

create or replace view vw_resumen_feligresia as
select
  congregacion_id,
  count(*) filter (where estado_membresia = 'activo') as personas_activas,
  count(*) filter (where bautizado) as bautizados,
  count(*) filter (where estado_membresia = 'apartado') as apartados,
  count(distinct familia_id) filter (where familia_id is not null) as familias_asociadas
from personas
group by congregacion_id;
create index if not exists estados_alerta_pastoral_congregacion_estado_idx on estados_alerta_pastoral (congregacion_id, estado);
create index if not exists auditoria_feligresia_congregacion_fecha_idx on auditoria_feligresia (congregacion_id, creado_en desc);
