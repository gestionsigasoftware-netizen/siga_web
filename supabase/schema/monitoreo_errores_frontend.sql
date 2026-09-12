-- SIGA - Monitoreo de errores del frontend.
--
-- Ultimo punto pendiente del checklist de produccion del 2026-09-10
-- (monitoreo/alertas/logs). Cualquier error de JavaScript real que le
-- pase a un usuario (rendering roto, promesa rechazada sin manejar,
-- etc.) queda registrado aqui automaticamente, sin depender de que el
-- usuario reporte el problema por WhatsApp.
--
-- Este es un dominio EXCLUSIVO de super_admin, igual que
-- `suscripciones.sql` -- nacional es un rol pastoral de la IPUC
-- (cliente), super_admin es quien administra el negocio/la salud
-- tecnica de SIGAP. Nacional no debe ver ni intervenir en esto.
--
-- El insert queda abierto a `anon` ademas de `authenticated` a
-- proposito: un error puede ocurrir en la landing publica o en Login
-- ANTES de que exista una sesion. Es un log de diagnostico de solo
-- escritura para quien lo genera -- no expone ni modifica datos de
-- nadie mas.

create table if not exists errores_frontend (
  id uuid primary key default gen_random_uuid(),
  mensaje text not null,
  stack text,
  contexto text not null default 'desconocido',
  url text,
  user_agent text,
  usuario_id uuid references auth.users(id) on delete set null,
  congregacion_id uuid references congregaciones(id) on delete set null,
  revisado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists errores_frontend_created_at_idx on errores_frontend (created_at desc);
create index if not exists errores_frontend_revisado_idx on errores_frontend (revisado) where not revisado;

alter table errores_frontend enable row level security;

drop policy if exists errores_frontend_insert on errores_frontend;
create policy errores_frontend_insert on errores_frontend
for insert to anon, authenticated
with check (true);

drop policy if exists errores_frontend_select on errores_frontend;
create policy errores_frontend_select on errores_frontend
for select to authenticated
using (es_super_admin());

drop policy if exists errores_frontend_update on errores_frontend;
create policy errores_frontend_update on errores_frontend
for update to authenticated
using (es_super_admin())
with check (es_super_admin());

drop policy if exists errores_frontend_delete on errores_frontend;
create policy errores_frontend_delete on errores_frontend
for delete to authenticated
using (es_super_admin());
