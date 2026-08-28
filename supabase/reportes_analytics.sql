-- Resumen agregado para Reportes.
-- Ejecutar despues de schema.sql, migracion_produccion.sql y accesos.sql.
-- Los filtros del frontend se aplican sobre este conjunto reducido.

create or replace function resumen_reportes(
  p_congregacion_id uuid,
  p_desde date
)
returns table (
  fecha date,
  congregacion_id uuid,
  congregacion_nombre text,
  modulo_id uuid,
  modulo_nombre text,
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
    select r.fecha, r.congregacion_id, c.nombre as congregacion_nombre,
      r.modulo_id, m.nombre_modulo as modulo_nombre,
      r.total_asistentes, r.desglose
    from registros_actividad r
    join congregaciones c on c.id = r.congregacion_id
    join modulos m on m.id = r.modulo_id
    where r.fecha >= p_desde
      and (p_congregacion_id is null or r.congregacion_id = p_congregacion_id)
      and r.congregacion_id in (select mis_congregaciones())
  ),
  totales as (
    select f.fecha, f.congregacion_id, f.congregacion_nombre,
      f.modulo_id, f.modulo_nombre,
      sum(f.total_asistentes)::bigint as total_asistentes,
      count(*)::bigint as registros
    from filas f
    group by f.fecha, f.congregacion_id, f.congregacion_nombre,
      f.modulo_id, f.modulo_nombre
  ),
  categorias as (
    select f.fecha, f.congregacion_id, f.modulo_id,
      jsonb_object_agg(item.key, item.total) as desglose
    from filas f
    cross join lateral (
      select e.key, sum(e.value::bigint)::bigint as total
      from jsonb_each_text(f.desglose) e
      group by e.key
    ) item
    group by f.fecha, f.congregacion_id, f.modulo_id
  )
  select t.fecha, t.congregacion_id, t.congregacion_nombre,
    t.modulo_id, t.modulo_nombre, t.total_asistentes,
    coalesce(c.desglose, '{}'::jsonb), t.registros
  from totales t
  left join categorias c using (fecha, congregacion_id, modulo_id)
  order by t.fecha desc, t.modulo_nombre;
$$;

revoke all on function resumen_reportes(uuid, date) from public, anon;
grant execute on function resumen_reportes(uuid, date) to authenticated;
