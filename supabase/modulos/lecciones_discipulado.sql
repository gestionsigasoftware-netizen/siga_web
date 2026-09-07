-- SIGA - Catalogo de lecciones y progreso individual medible para
-- Discipulado, calcado del mismo patron ya usado en REFAM y ESFOB
-- (ver lecciones_ruta_evangelistica.sql). El usuario probo el flujo en
-- vivo y pidio poder llevar registro de que lecciones se le imparten a
-- cada persona en Discipulado, ademas de graficos/insights/tasa de
-- exito -- este archivo agrega lo primero; el frontend (RutaFormacion.jsx,
-- Modulos.jsx) ya quedo generalizado para leer de aqui igual que de
-- esfob_lecciones/esfob_progreso_leccion.
--
-- A diferencia de ESFOB (un programa de duracion fija antes del
-- bautismo), Discipulado es continuo -- por eso NO se agrega un
-- "lecciones_total" fijo por proceso, solo un contador corriente de
-- lecciones completadas. El catalogo puede crecer con el tiempo sin
-- afectar procesos ya en curso.
--
-- Ejecutar despues de ruta_evangelistica.sql y lecciones_ruta_evangelistica.sql.
-- Repetible.

create table if not exists discipulado_lecciones (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  numero integer not null check (numero > 0),
  titulo text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, numero)
);

alter table discipulado_procesos add column if not exists leccion_actual_id uuid references discipulado_lecciones(id) on delete set null;
alter table discipulado_procesos add column if not exists lecciones_completadas integer not null default 0;

create table if not exists discipulado_progreso_leccion (
  id uuid primary key default gen_random_uuid(),
  discipulado_proceso_id uuid not null references discipulado_procesos(id) on delete cascade,
  leccion_id uuid not null references discipulado_lecciones(id) on delete cascade,
  completada boolean not null default true,
  fecha_completada date not null default current_date,
  responsable_persona_id uuid references personas(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (discipulado_proceso_id, leccion_id)
);

alter table discipulado_lecciones enable row level security;
drop policy if exists discipulado_lecciones_read on discipulado_lecciones;
drop policy if exists discipulado_lecciones_write on discipulado_lecciones;
create policy discipulado_lecciones_read on discipulado_lecciones for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy discipulado_lecciones_write on discipulado_lecciones for all to authenticated
using (congregacion_id in (select mis_congregaciones()))
with check (congregacion_id in (select mis_congregaciones()));

alter table discipulado_progreso_leccion enable row level security;
drop policy if exists discipulado_progreso_leccion_scope on discipulado_progreso_leccion;
create policy discipulado_progreso_leccion_scope on discipulado_progreso_leccion for all to authenticated
using (exists (
  select 1 from discipulado_procesos d
  where d.id = discipulado_progreso_leccion.discipulado_proceso_id
    and d.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from discipulado_procesos d
  where d.id = discipulado_progreso_leccion.discipulado_proceso_id
    and d.congregacion_id in (select mis_congregaciones())
));

create index if not exists discipulado_lecciones_congregacion_idx on discipulado_lecciones (congregacion_id, activo, numero);
create index if not exists discipulado_progreso_leccion_proceso_idx on discipulado_progreso_leccion (discipulado_proceso_id);
