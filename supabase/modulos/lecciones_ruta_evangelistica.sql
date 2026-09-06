-- SIGA - Catalogo de lecciones (con descripcion) y progreso individual
-- medible para REFAM y ESFOB -- las dos estaciones de la Ruta
-- Evangelistica basadas en lecciones. Discipulado no usa este patron
-- (su tabla discipulado_procesos usa objetivos/servicio_actual, no
-- lecciones).
--
-- El catalogo es compartido por congregacion (un solo curriculo, igual
-- que caracteres_culto/ujieres_congregacion en Modulos.jsx) -- no uno
-- distinto por grupo/lider. El progreso es secuencial: quien inicia una
-- leccion permanece en ella hasta que el responsable la marca
-- completada; solo entonces se avanza a la siguiente del catalogo.
--
-- Ejecutar despues de ruta_evangelistica.sql. Repetible.

create table if not exists refam_lecciones (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  numero integer not null check (numero > 0),
  titulo text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, numero)
);

alter table refam_participantes add column if not exists leccion_actual_id uuid references refam_lecciones(id) on delete set null;

create table if not exists refam_progreso_leccion (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references refam_participantes(id) on delete cascade,
  leccion_id uuid not null references refam_lecciones(id) on delete cascade,
  completada boolean not null default true,
  fecha_completada date not null default current_date,
  responsable_persona_id uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (participante_id, leccion_id)
);

create table if not exists esfob_lecciones (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  numero integer not null check (numero > 0),
  titulo text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, numero)
);

alter table esfob_procesos add column if not exists leccion_actual_id uuid references esfob_lecciones(id) on delete set null;

create table if not exists esfob_progreso_leccion (
  id uuid primary key default gen_random_uuid(),
  esfob_proceso_id uuid not null references esfob_procesos(id) on delete cascade,
  leccion_id uuid not null references esfob_lecciones(id) on delete cascade,
  completada boolean not null default true,
  fecha_completada date not null default current_date,
  responsable_persona_id uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (esfob_proceso_id, leccion_id)
);

-- RLS: catalogos con congregacion_id directo -- mismo alcance amplio que
-- el resto de catalogos administrados por el pastor (ver
-- caracteres_culto.sql). Progreso (sin congregacion_id propia) valida
-- por la congregacion del participante/proceso padre, igual patron que
-- refam_asistencia_participante_scope (hitos_espirituales.sql).

alter table refam_lecciones enable row level security;
drop policy if exists refam_lecciones_read on refam_lecciones;
drop policy if exists refam_lecciones_write on refam_lecciones;
create policy refam_lecciones_read on refam_lecciones for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy refam_lecciones_write on refam_lecciones for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

alter table esfob_lecciones enable row level security;
drop policy if exists esfob_lecciones_read on esfob_lecciones;
drop policy if exists esfob_lecciones_write on esfob_lecciones;
create policy esfob_lecciones_read on esfob_lecciones for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy esfob_lecciones_write on esfob_lecciones for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

alter table refam_progreso_leccion enable row level security;
drop policy if exists refam_progreso_leccion_scope on refam_progreso_leccion;
create policy refam_progreso_leccion_scope on refam_progreso_leccion for all to authenticated
using (exists (
  select 1 from refam_participantes p
  where p.id = refam_progreso_leccion.participante_id
    and p.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from refam_participantes p
  where p.id = refam_progreso_leccion.participante_id
    and p.congregacion_id in (select mis_congregaciones())
));

alter table esfob_progreso_leccion enable row level security;
drop policy if exists esfob_progreso_leccion_scope on esfob_progreso_leccion;
create policy esfob_progreso_leccion_scope on esfob_progreso_leccion for all to authenticated
using (exists (
  select 1 from esfob_procesos e
  where e.id = esfob_progreso_leccion.esfob_proceso_id
    and e.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from esfob_procesos e
  where e.id = esfob_progreso_leccion.esfob_proceso_id
    and e.congregacion_id in (select mis_congregaciones())
));

create index if not exists refam_lecciones_congregacion_idx on refam_lecciones (congregacion_id, activo, numero);
create index if not exists esfob_lecciones_congregacion_idx on esfob_lecciones (congregacion_id, activo, numero);
create index if not exists refam_progreso_leccion_participante_idx on refam_progreso_leccion (participante_id);
create index if not exists esfob_progreso_leccion_proceso_idx on esfob_progreso_leccion (esfob_proceso_id);
