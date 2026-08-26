-- SIGA - Perfiles de acceso y equipos de trabajo.
-- Ejecutar despues de schema.sql y antes de feligresia.sql.
-- Los niveles de roles definen alcance; estos perfiles definen permisos.

create table if not exists perfiles_acceso (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  sistema boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists permisos_perfil (
  perfil_id uuid not null references perfiles_acceso(id) on delete cascade,
  permiso text not null,
  primary key (perfil_id, permiso)
);

create table if not exists asignaciones_acceso (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  perfil_id uuid not null references perfiles_acceso(id) on delete restrict,
  asignado_por uuid references auth.users(id) on delete set null default auth.uid(),
  fecha_inicio date not null default current_date,
  fecha_fin date,
  created_at timestamptz not null default now(),
  unique (persona_id, congregacion_id, perfil_id, fecha_inicio)
);

insert into perfiles_acceso (codigo, nombre, descripcion)
values
  ('pastor', 'Acceso total', 'Administra la congregacion y sus equipos.'),
  ('estadisticas', 'Comite de Estadisticas', 'Registra y consulta estadisticas y reportes.'),
  ('consulta', 'Solo lectura', 'Consulta informacion sin modificarla.')
on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion;

insert into permisos_perfil (perfil_id, permiso)
select p.id, x.permiso
from perfiles_acceso p
cross join (values
  ('pastor', 'feligresia.consultar'), ('pastor', 'feligresia.editar'), ('pastor', 'estadisticas.consultar'), ('pastor', 'estadisticas.registrar'), ('pastor', 'reportes.consultar'), ('pastor', 'usuarios.administrar'), ('pastor', 'configuracion.administrar'), ('pastor', 'auditoria.consultar'),
  ('estadisticas', 'feligresia.consultar'), ('estadisticas', 'estadisticas.consultar'), ('estadisticas', 'estadisticas.registrar'), ('estadisticas', 'reportes.consultar'),
  ('consulta', 'feligresia.consultar'), ('consulta', 'estadisticas.consultar'), ('consulta', 'reportes.consultar')
) as x(codigo, permiso)
where p.codigo = x.codigo
on conflict do nothing;

alter table perfiles_acceso enable row level security;
alter table permisos_perfil enable row level security;
alter table asignaciones_acceso enable row level security;

drop policy if exists perfiles_acceso_read on perfiles_acceso;
create policy perfiles_acceso_read on perfiles_acceso for select to authenticated using (true);

drop policy if exists permisos_perfil_read on permisos_perfil;
create policy permisos_perfil_read on permisos_perfil for select to authenticated using (true);

drop policy if exists asignaciones_acceso_read on asignaciones_acceso;
create policy asignaciones_acceso_read on asignaciones_acceso for select to authenticated
using (congregacion_id in (select mis_congregaciones()));

drop policy if exists asignaciones_acceso_write on asignaciones_acceso;
create policy asignaciones_acceso_write on asignaciones_acceso for all to authenticated
using (exists (
  select 1 from roles_sistema r
  where r.persona_id = mi_persona_id()
    and r.nivel = 'local'
    and r.congregacion_id = asignaciones_acceso.congregacion_id
    and r.fecha_fin is null
    and coalesce(r.rol_local, 'pastor') = 'pastor'
))
with check (exists (
  select 1 from roles_sistema r
  where r.persona_id = mi_persona_id()
    and r.nivel = 'local'
    and r.congregacion_id = asignaciones_acceso.congregacion_id
    and r.fecha_fin is null
    and coalesce(r.rol_local, 'pastor') = 'pastor'
));

create or replace function tiene_permiso(p_congregacion_id uuid, p_permiso text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from asignaciones_acceso a
    join permisos_perfil pp on pp.perfil_id = a.perfil_id
    where a.persona_id = mi_persona_id()
      and a.congregacion_id = p_congregacion_id
      and a.fecha_fin is null
      and pp.permiso = p_permiso
  ) or exists (
    select 1 from roles_sistema r
    where r.persona_id = mi_persona_id()
      and r.nivel = 'local'
      and r.congregacion_id = p_congregacion_id
      and r.fecha_fin is null
      and coalesce(r.rol_local, 'pastor') = 'pastor'
      and p_permiso in ('feligresia.consultar', 'feligresia.editar', 'estadisticas.consultar', 'estadisticas.registrar', 'reportes.consultar', 'usuarios.administrar', 'configuracion.administrar', 'auditoria.consultar')
  );
$$;

create index if not exists asignaciones_acceso_congregacion_idx on asignaciones_acceso (congregacion_id, fecha_fin);
create index if not exists asignaciones_acceso_persona_idx on asignaciones_acceso (persona_id, fecha_fin);
