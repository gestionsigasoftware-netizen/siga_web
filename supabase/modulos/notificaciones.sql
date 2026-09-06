-- SIGA - Notificaciones en tiempo real.
-- Ejecutar después de schema.sql y migracion_produccion.sql.

create table if not exists notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  mensaje text not null,
  tipo text not null default 'info' check (tipo in ('info', 'success', 'warning', 'danger')),
  enlace text,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notificaciones_usuario_fecha_idx
  on notificaciones (usuario_id, created_at desc);

create or replace function crear_notificacion_usuario(
  p_usuario_id uuid,
  p_titulo text,
  p_mensaje text,
  p_tipo text default 'info',
  p_enlace text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_usuario_id is null then
    return;
  end if;

  insert into notificaciones (usuario_id, titulo, mensaje, tipo, enlace)
  values (p_usuario_id, p_titulo, p_mensaje, p_tipo, p_enlace);
end;
$$;

revoke execute on function crear_notificacion_usuario(uuid, text, text, text, text) from public, authenticated;

create or replace function notificar_cambio_congregacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  estado_label text;
  tipo_aviso text;
  persona record;
begin
  if old.estado is not distinct from new.estado then
    return new;
  end if;

  estado_label := case new.estado
    when 'activa' then 'aprobada'
    when 'suspendida' then 'suspendida'
    else 'actualizada'
  end;
  tipo_aviso := case when new.estado = 'activa' then 'success' when new.estado = 'suspendida' then 'danger' else 'warning' end;

  for persona in
    select auth_user_id
    from personas
    where congregacion_id = new.id and auth_user_id is not null
  loop
    perform crear_notificacion_usuario(
      persona.auth_user_id,
      'Estado de congregación actualizado',
      format('La congregación %s fue %s.', new.nombre, estado_label),
      tipo_aviso,
      '/app'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists congregaciones_notificacion_estado on congregaciones;
create trigger congregaciones_notificacion_estado
after update of estado on congregaciones
for each row execute function notificar_cambio_congregacion();

create or replace function notificar_asignacion_acceso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario_destino uuid;
  nombre_perfil text;
  nombre_congregacion text;
begin
  if new.fecha_fin is not null then
    return new;
  end if;

  select p.auth_user_id, pa.nombre, c.nombre
  into usuario_destino, nombre_perfil, nombre_congregacion
  from personas p
  join perfiles_acceso pa on pa.id = new.perfil_id
  join congregaciones c on c.id = new.congregacion_id
  where p.id = new.persona_id;

  perform crear_notificacion_usuario(
    usuario_destino,
    'Nuevo perfil de acceso',
    format('Se te asignó el perfil %s en %s.', nombre_perfil, nombre_congregacion),
    'success',
    '/perfil'
  );
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.asignaciones_acceso') is not null then
    drop trigger if exists asignaciones_acceso_notificacion on asignaciones_acceso;
    create trigger asignaciones_acceso_notificacion
    after insert on asignaciones_acceso
    for each row execute function notificar_asignacion_acceso();
  end if;
end;
$$;

alter table notificaciones enable row level security;

drop policy if exists notificaciones_select_own on notificaciones;
create policy notificaciones_select_own on notificaciones
for select to authenticated using (usuario_id = auth.uid());

drop policy if exists notificaciones_update_own on notificaciones;
create policy notificaciones_update_own on notificaciones
for update to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table notificaciones;
  end if;
end $$;
