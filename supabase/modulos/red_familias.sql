-- SIGA - Red de Familias / DEFAM.
-- Ejecutar despues de schema.sql, accesos.sql y feligresia.sql.
-- No duplica personas ni familias; registra intervenciones sobre el censo local.

create table if not exists red_familias_casos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  familia_id uuid not null references familias(id) on delete cascade,
  persona_id uuid references personas(id) on delete set null,
  tipo_necesidad text not null default 'acompanamiento_solicitado'
    check (tipo_necesidad in ('acompanamiento_solicitado', 'visita_pendiente', 'orientacion', 'integracion', 'reactivacion', 'necesidad_identificada')),
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta')),
  estado text not null default 'solicitado' check (estado in ('solicitado', 'activo', 'pausado', 'cerrado')),
  responsable_id uuid references personas(id) on delete set null,
  fecha_apertura date not null default current_date,
  proxima_fecha date,
  resultado text,
  notas_confidenciales text,
  creado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists red_familias_visitas (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  familia_id uuid not null references familias(id) on delete cascade,
  caso_id uuid references red_familias_casos(id) on delete set null,
  fecha_programada date not null,
  fecha_realizada date,
  responsable_id uuid references personas(id) on delete set null,
  motivo text not null,
  acuerdos text,
  estado text not null default 'programada' check (estado in ('programada', 'realizada', 'cancelada')),
  notas_confidenciales text,
  creado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists red_familias_actividades (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'taller' check (tipo in ('taller', 'escuela', 'campana', 'conferencia', 'visita_grupal')),
  fecha date not null,
  responsable_id uuid references personas(id) on delete set null,
  objetivo text,
  asistentes integer not null default 0 check (asistentes >= 0),
  familias_alcanzadas integer not null default 0 check (familias_alcanzadas >= 0),
  resultado text,
  created_at timestamptz not null default now()
);

create index if not exists red_familias_casos_scope_idx on red_familias_casos (congregacion_id, estado, prioridad, proxima_fecha);
create index if not exists red_familias_visitas_scope_idx on red_familias_visitas (congregacion_id, estado, fecha_programada);
create index if not exists red_familias_actividades_scope_idx on red_familias_actividades (congregacion_id, fecha desc);

alter table red_familias_casos enable row level security;
alter table red_familias_visitas enable row level security;
alter table red_familias_actividades enable row level security;

drop policy if exists red_familias_casos_read on red_familias_casos;
create policy red_familias_casos_read on red_familias_casos for select to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'red_familias.consultar'));
drop policy if exists red_familias_casos_write on red_familias_casos;
create policy red_familias_casos_write on red_familias_casos for all to authenticated
using (puede_administrar_feligresia(congregacion_id) or tiene_permiso(congregacion_id, 'red_familias.editar'))
with check ((puede_administrar_feligresia(congregacion_id) or tiene_permiso(congregacion_id, 'red_familias.editar')) and exists (select 1 from familias f where f.id = red_familias_casos.familia_id and f.congregacion_id = red_familias_casos.congregacion_id));

drop policy if exists red_familias_visitas_read on red_familias_visitas;
create policy red_familias_visitas_read on red_familias_visitas for select to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'red_familias.consultar'));
drop policy if exists red_familias_visitas_write on red_familias_visitas;
create policy red_familias_visitas_write on red_familias_visitas for all to authenticated
using (puede_administrar_feligresia(congregacion_id) or tiene_permiso(congregacion_id, 'red_familias.editar'))
with check ((puede_administrar_feligresia(congregacion_id) or tiene_permiso(congregacion_id, 'red_familias.editar')) and exists (select 1 from familias f where f.id = red_familias_visitas.familia_id and f.congregacion_id = red_familias_visitas.congregacion_id));

drop policy if exists red_familias_actividades_read on red_familias_actividades;
create policy red_familias_actividades_read on red_familias_actividades for select to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'red_familias.consultar'));
drop policy if exists red_familias_actividades_write on red_familias_actividades;
create policy red_familias_actividades_write on red_familias_actividades for all to authenticated
using (puede_administrar_feligresia(congregacion_id) or tiene_permiso(congregacion_id, 'red_familias.editar'))
with check (puede_administrar_feligresia(congregacion_id) or tiene_permiso(congregacion_id, 'red_familias.editar'));

create or replace function actualizar_red_familias_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists red_familias_casos_updated_at on red_familias_casos;
create trigger red_familias_casos_updated_at before update on red_familias_casos
for each row execute function actualizar_red_familias_updated_at();
