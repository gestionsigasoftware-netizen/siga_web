-- SIGA - Desglose de la Ruta Evangelistica por estacion, a nivel
-- distrital. Ejecutar despues de ruta_evangelistica.sql. Repetible.
-- Mismo patron que resumen_carcelaria_distrital / resumen_musica_distrital
-- (bi_fase2_insights.sql, escuela_dominical_damas_dorcas.sql).

drop function if exists resumen_ruta_evangelistica_distrital(uuid);

create function resumen_ruta_evangelistica_distrital(p_distrito_id uuid)
returns table (
  congregacion_id uuid,
  nombre text,
  ciudad text,
  uno_mas bigint,
  bis bigint,
  refam bigint,
  esfob bigint,
  discipulado bigint,
  bautismos_3m bigint
)
language sql stable security invoker set search_path = public as $$
  select
    c.id as congregacion_id,
    c.nombre,
    c.ciudad,
    coalesce((select count(*) from ruta_procesos rp join ruta_estaciones re on re.id = rp.estacion_id where rp.congregacion_id = c.id and re.codigo = 'uno_mas' and rp.estado = 'activo'), 0),
    coalesce((select count(*) from ruta_procesos rp join ruta_estaciones re on re.id = rp.estacion_id where rp.congregacion_id = c.id and re.codigo = 'bis' and rp.estado = 'activo'), 0),
    coalesce((select count(*) from ruta_procesos rp join ruta_estaciones re on re.id = rp.estacion_id where rp.congregacion_id = c.id and re.codigo = 'refam' and rp.estado = 'activo'), 0),
    coalesce((select count(*) from ruta_procesos rp join ruta_estaciones re on re.id = rp.estacion_id where rp.congregacion_id = c.id and re.codigo = 'esfob' and rp.estado = 'activo'), 0),
    coalesce((select count(*) from ruta_procesos rp join ruta_estaciones re on re.id = rp.estacion_id where rp.congregacion_id = c.id and re.codigo = 'discipulado' and rp.estado = 'activo'), 0),
    coalesce((select count(*) from amigos am where am.congregacion_id = c.id and am.fecha_bautismo >= (current_date - interval '3 months')), 0)
  from congregaciones c
  where c.distrito_id = p_distrito_id
    and c.id in (select mis_congregaciones())
  order by c.nombre;
$$;

revoke all on function resumen_ruta_evangelistica_distrital(uuid) from public, anon;
grant execute on function resumen_ruta_evangelistica_distrital(uuid) to authenticated;
