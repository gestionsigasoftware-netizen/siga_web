-- Fix: reportes_soporte era visible/administrable por nacional Y
-- super_admin por igual. Es un dominio EXCLUSIVO de super_admin (el
-- equipo que mantiene SIGAP), igual que suscripciones.sql y
-- monitoreo_errores_frontend.sql -- nacional es un rol pastoral de la
-- IPUC (cliente), no el equipo que mantiene el software. Ver
-- docs/fixes/soporte-exclusivo-super-admin-2026-09-11.md.

drop policy if exists reportes_soporte_select on reportes_soporte;
create policy reportes_soporte_select on reportes_soporte
for select to authenticated
using (usuario_id = auth.uid() or es_super_admin());

drop policy if exists reportes_soporte_update_admin on reportes_soporte;
create policy reportes_soporte_update_admin on reportes_soporte
for update to authenticated
using (es_super_admin())
with check (es_super_admin());
