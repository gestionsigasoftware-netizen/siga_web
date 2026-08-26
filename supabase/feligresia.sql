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

alter table familias enable row level security;
alter table comites enable row level security;
alter table membresias_comite enable row level security;
alter table historial_cargos enable row level security;

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

create index if not exists personas_feligresia_estado_idx on personas (congregacion_id, estado_membresia, bautizado);
create index if not exists personas_familia_idx on personas (familia_id);
