-- SIGA - Bitacora de notas individuales por leccion, para las 3
-- estaciones de la Ruta Evangelistica que manejan un catalogo de
-- lecciones: REFAM, ESFOB y Discipulado.
--
-- El usuario probo la ficha de Discipulado y noto que el campo
-- "notas" de *_procesos/*_participantes es un solo texto que se
-- sobreescribe -- no sirve para llevar un registro de quien ha
-- trabajado con la persona, ni para justificar por que sigue en la
-- misma leccion, ni para el caso de que el responsable cambie a mitad
-- de camino o de una congregacion que reparte una misma leccion entre
-- varios responsables. Se pidio verificar si REFAM y ESFOB tenian el
-- mismo hueco antes de replicarlo -- se confirmo que si: ninguna de
-- las 3 tablas de progreso (refam_progreso_leccion,
-- esfob_progreso_leccion, discipulado_progreso_leccion) tiene una
-- columna de notas, y los "notas"/"resultado"/"novedades" que ya
-- existen (esfob_procesos.notas, refam_reuniones.novedades) son de
-- una sola fila mutable o a nivel de grupo completo, no una bitacora
-- individual por persona y por leccion.
--
-- Cada nota queda ligada a la leccion que se estaba trabajando en ese
-- momento (normalmente la actual de la persona, pero al completarla la
-- nota se conserva ligada a esa leccion ya historica) -- asi se puede
-- leer tanto "que se ha anotado en la leccion en la que va ahora" como
-- el historial completo de acompañamiento de la persona.
--
-- Ejecutar despues de lecciones_ruta_evangelistica.sql. Repetible.

create table if not exists refam_notas_leccion (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references refam_participantes(id) on delete cascade,
  leccion_id uuid not null references refam_lecciones(id) on delete cascade,
  nota text not null,
  responsable_persona_id uuid references personas(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists esfob_notas_leccion (
  id uuid primary key default gen_random_uuid(),
  esfob_proceso_id uuid not null references esfob_procesos(id) on delete cascade,
  leccion_id uuid not null references esfob_lecciones(id) on delete cascade,
  nota text not null,
  responsable_persona_id uuid references personas(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists discipulado_notas_leccion (
  id uuid primary key default gen_random_uuid(),
  discipulado_proceso_id uuid not null references discipulado_procesos(id) on delete cascade,
  leccion_id uuid not null references discipulado_lecciones(id) on delete cascade,
  nota text not null,
  responsable_persona_id uuid references personas(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table refam_notas_leccion enable row level security;
drop policy if exists refam_notas_leccion_scope on refam_notas_leccion;
create policy refam_notas_leccion_scope on refam_notas_leccion for all to authenticated
using (exists (
  select 1 from refam_participantes p
  where p.id = refam_notas_leccion.participante_id
    and p.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from refam_participantes p
  where p.id = refam_notas_leccion.participante_id
    and p.congregacion_id in (select mis_congregaciones())
));

alter table esfob_notas_leccion enable row level security;
drop policy if exists esfob_notas_leccion_scope on esfob_notas_leccion;
create policy esfob_notas_leccion_scope on esfob_notas_leccion for all to authenticated
using (exists (
  select 1 from esfob_procesos e
  where e.id = esfob_notas_leccion.esfob_proceso_id
    and e.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from esfob_procesos e
  where e.id = esfob_notas_leccion.esfob_proceso_id
    and e.congregacion_id in (select mis_congregaciones())
));

alter table discipulado_notas_leccion enable row level security;
drop policy if exists discipulado_notas_leccion_scope on discipulado_notas_leccion;
create policy discipulado_notas_leccion_scope on discipulado_notas_leccion for all to authenticated
using (exists (
  select 1 from discipulado_procesos d
  where d.id = discipulado_notas_leccion.discipulado_proceso_id
    and d.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from discipulado_procesos d
  where d.id = discipulado_notas_leccion.discipulado_proceso_id
    and d.congregacion_id in (select mis_congregaciones())
));

create index if not exists refam_notas_leccion_participante_idx on refam_notas_leccion (participante_id, created_at desc);
create index if not exists esfob_notas_leccion_proceso_idx on esfob_notas_leccion (esfob_proceso_id, created_at desc);
create index if not exists discipulado_notas_leccion_proceso_idx on discipulado_notas_leccion (discipulado_proceso_id, created_at desc);
