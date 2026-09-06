-- SIGA - Soporte tecnico hacia el equipo que mantiene SIGAP (no es un
-- PQRS interno entre niveles de la iglesia -- eso es
-- solicitudes_jerarquicas.sql, un archivo aparte). Cualquier usuario
-- logueado puede reportar un problema; solo nacional/super_admin (el
-- equipo que mantiene el software) puede verlos todos y marcarlos
-- resueltos.

create table if not exists reportes_soporte (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  correo_usuario text not null,
  asunto text not null,
  descripcion text not null,
  pagina text,
  nivel text,
  congregacion_nombre text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'resuelto')),
  respuesta_interna text,
  created_at timestamptz not null default now(),
  resuelto_en timestamptz
);

create index if not exists reportes_soporte_estado_idx on reportes_soporte (estado, created_at desc);

alter table reportes_soporte enable row level security;

drop policy if exists reportes_soporte_insert_own on reportes_soporte;
create policy reportes_soporte_insert_own on reportes_soporte
for insert to authenticated
with check (usuario_id = auth.uid());

drop policy if exists reportes_soporte_select on reportes_soporte;
create policy reportes_soporte_select on reportes_soporte
for select to authenticated
using (usuario_id = auth.uid() or es_nacional() or es_super_admin());

drop policy if exists reportes_soporte_update_admin on reportes_soporte;
create policy reportes_soporte_update_admin on reportes_soporte
for update to authenticated
using (es_nacional() or es_super_admin())
with check (es_nacional() or es_super_admin());
