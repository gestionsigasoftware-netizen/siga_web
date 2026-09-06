-- Resumen agregado para el Dashboard.
-- Ejecutar despues de schema.sql, accesos.sql y migracion_produccion.sql.
-- Devuelve una fila por fecha y respeta el alcance del usuario autenticado.

create or replace function resumen_dashboard(
  p_congregacion_id uuid,
  p_desde date
)
returns table (
  fecha date,
  total_asistentes bigint,
  desglose jsonb,
  registros bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filas as (
    select r.fecha, r.total_asistentes, r.desglose
    from registros_actividad r
    where r.fecha >= p_desde
      and (p_congregacion_id is null or r.congregacion_id = p_congregacion_id)
      and r.congregacion_id in (select mis_congregaciones())
  ),
  totales as (
    select f.fecha, sum(f.total_asistentes)::bigint as total_asistentes, count(*)::bigint as registros
    from filas f
    group by f.fecha
  ),
  categorias as (
    select f.fecha, jsonb_object_agg(fila.key, fila.total) as desglose
    from filas f
    cross join lateral (
      select e.key, sum(e.value::bigint)::bigint as total
      from jsonb_each_text(f.desglose) e
      group by e.key
    ) fila
    group by f.fecha
  )
  select t.fecha, t.total_asistentes, coalesce(c.desglose, '{}'::jsonb), t.registros
  from totales t
  left join categorias c using (fecha)
  order by t.fecha desc;
$$;

revoke all on function resumen_dashboard(uuid, date) from public, anon;
grant execute on function resumen_dashboard(uuid, date) to authenticated;
