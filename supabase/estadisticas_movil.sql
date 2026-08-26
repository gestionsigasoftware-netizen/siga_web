-- Resumen agregado para usuarios con acceso movil.
-- Ejecutar despues de schema.sql, accesos.sql y migracion_produccion.sql.

create or replace function resumen_asistencia_movil(
  p_congregacion_id uuid,
  p_desde date
)
returns table (
  fecha date,
  total_asistentes bigint,
  registros bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select r.fecha,
    coalesce(sum(r.total_asistentes), 0)::bigint,
    count(*)::bigint
  from registros_actividad r
  where r.congregacion_id = p_congregacion_id
    and r.fecha >= p_desde
    and exists (
      select 1
      from personas p
      join asignaciones_cargo ac on ac.persona_id = p.id
      join cargos c on c.id = ac.cargo_id
      join modulos m on m.id = c.modulo_id
      where p.auth_user_id = auth.uid()
        and ac.fecha_fin is null
        and m.congregacion_id = p_congregacion_id
        and m.activo = true
    )
  group by r.fecha
  order by r.fecha desc;
$$;

revoke all on function resumen_asistencia_movil(uuid, date) from public, anon;
grant execute on function resumen_asistencia_movil(uuid, date) to authenticated;
