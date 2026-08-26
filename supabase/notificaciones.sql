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
