-- SIGA - Preferencias de usuario y configuración por congregación.
-- Ejecutar después de schema.sql y migracion_produccion.sql.

create table if not exists preferencias_usuario (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  recibir_notificaciones boolean not null default true,
  recibir_alertas boolean not null default true,
  formato_fecha text not null default 'DD/MM/AAAA' check (formato_fecha in ('DD/MM/AAAA', 'MM/DD/AAAA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists configuracion_congregacion (
  congregacion_id uuid primary key references congregaciones(id) on delete cascade,
  umbral_alerta numeric(5,2) not null default 15 check (umbral_alerta between 1 and 100),
  modulo_predeterminado uuid references modulos(id) on delete set null,
  exigir_responsable boolean not null default true,
  exigir_novedades boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table preferencias_usuario enable row level security;
alter table configuracion_congregacion enable row level security;

drop policy if exists preferencias_usuario_own on preferencias_usuario;
create policy preferencias_usuario_own on preferencias_usuario
for all to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

drop policy if exists configuracion_congregacion_read on configuracion_congregacion;
create policy configuracion_congregacion_read on configuracion_congregacion
for select to authenticated
using (congregacion_id in (select mis_congregaciones()));

drop policy if exists configuracion_congregacion_write on configuracion_congregacion;
create policy configuracion_congregacion_write on configuracion_congregacion
for insert to authenticated
with check (
  congregacion_id in (
    select r.congregacion_id from roles_sistema r
    where r.persona_id = mi_persona_id()
      and r.nivel = 'local'
      and coalesce(r.rol_local, 'pastor') = 'pastor'
      and r.fecha_fin is null
  )
);

drop policy if exists configuracion_congregacion_update on configuracion_congregacion;
create policy configuracion_congregacion_update on configuracion_congregacion
for update to authenticated
using (
  congregacion_id in (
    select r.congregacion_id from roles_sistema r
    where r.persona_id = mi_persona_id()
      and r.nivel = 'local'
      and coalesce(r.rol_local, 'pastor') = 'pastor'
      and r.fecha_fin is null
  )
)
with check (
  congregacion_id in (
    select r.congregacion_id from roles_sistema r
    where r.persona_id = mi_persona_id()
      and r.nivel = 'local'
      and coalesce(r.rol_local, 'pastor') = 'pastor'
      and r.fecha_fin is null
  )
);

drop policy if exists congregaciones_update_local_pastor on congregaciones;
create policy congregaciones_update_local_pastor on congregaciones
for update to authenticated
using (exists (
  select 1 from roles_sistema r
  where r.persona_id = mi_persona_id()
    and r.nivel = 'local'
    and r.congregacion_id = congregaciones.id
    and r.fecha_fin is null
    and coalesce(r.rol_local, 'pastor') = 'pastor'
))
with check (id in (select mis_congregaciones()));


create or replace function actualizar_preferencias_usuario()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists preferencias_usuario_updated_at on preferencias_usuario;
create trigger preferencias_usuario_updated_at
before update on preferencias_usuario
for each row execute function actualizar_preferencias_usuario();

-- Los catálogos de la congregación solo los administra el pastor local.
drop policy if exists modulos_read on modulos;
create policy modulos_read on modulos for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
drop policy if exists modulos_scope on modulos;
create policy modulos_scope on modulos
for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and exists (
  select 1 from roles_sistema r where r.persona_id = mi_persona_id()
    and r.congregacion_id = modulos.congregacion_id
    and r.nivel = 'local' and r.fecha_fin is null
    and coalesce(r.rol_local, 'pastor') = 'pastor'
))
with check (congregacion_id in (select mis_congregaciones()) and exists (
  select 1 from roles_sistema r where r.persona_id = mi_persona_id()
    and r.congregacion_id = modulos.congregacion_id
    and r.nivel = 'local' and r.fecha_fin is null
    and coalesce(r.rol_local, 'pastor') = 'pastor'
));

drop policy if exists categorias_demograficas_scope on categorias_demograficas;
drop policy if exists categorias_demograficas_read on categorias_demograficas;
create policy categorias_demograficas_read on categorias_demograficas for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy categorias_demograficas_scope on categorias_demograficas
for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and exists (
  select 1 from roles_sistema r where r.persona_id = mi_persona_id()
    and r.congregacion_id = categorias_demograficas.congregacion_id
    and r.nivel = 'local' and r.fecha_fin is null
    and coalesce(r.rol_local, 'pastor') = 'pastor'
))
with check (congregacion_id in (select mis_congregaciones()) and exists (
  select 1 from roles_sistema r where r.persona_id = mi_persona_id()
    and r.congregacion_id = categorias_demograficas.congregacion_id
    and r.nivel = 'local' and r.fecha_fin is null
    and coalesce(r.rol_local, 'pastor') = 'pastor'
));

drop policy if exists etapas_seguimiento_scope on etapas_seguimiento;
drop policy if exists etapas_seguimiento_read on etapas_seguimiento;
create policy etapas_seguimiento_read on etapas_seguimiento for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy etapas_seguimiento_scope on etapas_seguimiento
for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and exists (
  select 1 from roles_sistema r where r.persona_id = mi_persona_id()
    and r.congregacion_id = etapas_seguimiento.congregacion_id
    and r.nivel = 'local' and r.fecha_fin is null
    and coalesce(r.rol_local, 'pastor') = 'pastor'
))
with check (congregacion_id in (select mis_congregaciones()) and exists (
  select 1 from roles_sistema r where r.persona_id = mi_persona_id()
    and r.congregacion_id = etapas_seguimiento.congregacion_id
    and r.nivel = 'local' and r.fecha_fin is null
    and coalesce(r.rol_local, 'pastor') = 'pastor'
));
