-- SIGA - Quitar a nacional el acceso al módulo de Aprobaciones (2026-09-22).
--
-- El usuario detectó que Aprobaciones.jsx usaba el mismo módulo para
-- distrital y nacional (y super_admin), y ambos podían aprobar, suspender
-- o anular cualquier congregación pendiente. Esto no era el diseño
-- pretendido: aprobar una congregación nueva es decisión del distrital
-- dueño del proceso, no de nacional. Nacional sigue viendo todas las
-- congregaciones del país (dashboards, reportes, "Visión país") porque
-- mis_congregaciones()/congregaciones_select no cambian aquí -- solo
-- pierde la capacidad de decidir su estado.
--
-- Cambia dos cosas del lado de la base de datos (el frontend ya se
-- corrigió aparte en Aprobaciones.jsx y Sidebar.jsx):
-- 1. La política de UPDATE de `congregaciones` ya no incluye es_nacional().
-- 2. anular_congregacion() ya no incluye es_nacional() en su chequeo.
-- super_admin conserva ambos accesos (operador de la plataforma / soporte).
--
-- Ejecutar después de schema.sql y anular_congregacion.sql. Es repetible.

drop policy if exists "congregaciones_update_distrital" on congregaciones;
create policy "congregaciones_update_distrital" on congregaciones for update using (
  distrito_id in (select mis_distritos()) or es_super_admin()
);

create or replace function anular_congregacion(p_congregacion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_congregacion congregaciones%rowtype;
  v_personas_count integer;
begin
  select * into v_congregacion from congregaciones where id = p_congregacion_id;
  if v_congregacion.id is null then
    raise exception 'Congregación no encontrada';
  end if;

  if not (
    v_congregacion.distrito_id in (select mis_distritos())
    or es_super_admin()
  ) then
    raise exception 'No tienes permisos sobre esta congregación';
  end if;

  if v_congregacion.estado <> 'pendiente_aprobacion' then
    raise exception 'Solo se puede anular una congregación que todavía no ha sido aprobada (estado actual: %). Si ya está activa o suspendida y de verdad fue un error, contacta soporte.', v_congregacion.estado;
  end if;

  select count(*) into v_personas_count from personas where congregacion_id = p_congregacion_id;
  if v_personas_count > 1 then
    raise exception 'Esta congregación ya tiene % personas registradas -- no se puede anular automáticamente, contacta soporte.', v_personas_count;
  end if;

  delete from asignaciones_pastorales where congregacion_id = p_congregacion_id;
  delete from roles_sistema where congregacion_id = p_congregacion_id;
  delete from pastores where id = v_congregacion.pastor_id;
  delete from personas where congregacion_id = p_congregacion_id;
  delete from congregaciones where id = p_congregacion_id;
end;
$$;

revoke all on function anular_congregacion(uuid) from public, anon;
grant execute on function anular_congregacion(uuid) to authenticated;
