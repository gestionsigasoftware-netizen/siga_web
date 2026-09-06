-- SIGA - Fase BI nacional: consolidado por distrito para el Dashboard
-- Nacional (nacional/super_admin), analogo a resumen_distrital() pero
-- agregado por distrito en vez de por congregacion.
-- Ejecutar despues de bi_fase2_insights.sql. Es repetible.
--
-- Problema que resuelve: nacional/super_admin no tenian ninguna vista
-- propia — caian al mismo dashboard generico de congregacion local, sin
-- congregacion asignada, asi que salia practicamente vacio. No existia
-- ninguna funcion que agregara metricas por distrito a escala nacional
-- (solo resumen_distrital(p_distrito_id), que agrega por congregacion
-- dentro de UN distrito).

create or replace function resumen_nacional()
returns table (
  distrito_id uuid,
  numero integer,
  nombre text,
  congregaciones bigint,
  vacantes bigint,
  personas_activas bigint,
  bautizados bigint,
  sellados bigint,
  familias_asociadas bigint,
  personas_nuevas_3m bigint,
  asistencia_ultimo_mes bigint,
  asistencia_mes_anterior bigint,
  altas_3m bigint,
  bajas_3m bigint,
  bautismos_3m bigint,
  estudios_refam_3m bigint,
  funnel_uno_mas bigint,
  funnel_refam bigint,
  funnel_bautizados bigint,
  congregaciones_iglesia_local bigint,
  congregaciones_lugar_prediccion bigint,
  congregaciones_mision_nacional bigint
)
language sql stable security invoker set search_path = public as $$
  select
    d.id as distrito_id,
    d.numero,
    d.nombre,
    count(c.id) as congregaciones,
    count(c.id) filter (where c.pastor_nombre is null) as vacantes,
    coalesce(sum(r.personas_activas), 0),
    coalesce(sum(r.bautizados), 0),
    coalesce(sum(r.sellados), 0),
    coalesce(sum(r.familias_asociadas), 0),
    coalesce((
      select count(*) from personas p
      join congregaciones cc on cc.id = p.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and p.created_at >= now() - interval '3 months'
    ), 0) as personas_nuevas_3m,
    coalesce((
      select sum(a.total_asistentes) from registros_actividad a
      join congregaciones cc on cc.id = a.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and a.fecha >= (current_date - interval '30 days')
    ), 0) as asistencia_ultimo_mes,
    coalesce((
      select sum(a.total_asistentes) from registros_actividad a
      join congregaciones cc on cc.id = a.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and a.fecha >= (current_date - interval '60 days') and a.fecha < (current_date - interval '30 days')
    ), 0) as asistencia_mes_anterior,
    coalesce((
      select count(*) from movimientos_membresia m
      join congregaciones cc on cc.id = m.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and m.tipo like 'alta_%' and m.fecha >= (current_date - interval '3 months')
    ), 0) as altas_3m,
    coalesce((
      select count(*) from movimientos_membresia m
      join congregaciones cc on cc.id = m.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and m.tipo like 'baja_%' and m.fecha >= (current_date - interval '3 months')
    ), 0) as bajas_3m,
    coalesce((
      select count(*) from personas p
      join congregaciones cc on cc.id = p.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and p.bautizado and p.fecha_bautismo >= (current_date - interval '3 months')
    ), 0) as bautismos_3m,
    coalesce((
      select count(*) from refam_asistencia_participante ap
      join refam_reuniones rr on rr.id = ap.reunion_id
      join congregaciones cc on cc.id = rr.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and ap.asistio and rr.fecha >= (current_date - interval '3 months')
    ), 0) as estudios_refam_3m,
    coalesce((
      select count(*) from ruta_procesos rp
      join ruta_estaciones re on re.id = rp.estacion_id
      join congregaciones cc on cc.id = rp.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and re.codigo = 'uno_mas' and rp.estado = 'activo'
    ), 0) as funnel_uno_mas,
    coalesce((
      select count(*) from ruta_procesos rp
      join ruta_estaciones re on re.id = rp.estacion_id
      join congregaciones cc on cc.id = rp.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and re.codigo = 'refam' and rp.estado = 'activo'
    ), 0) as funnel_refam,
    coalesce((
      select count(*) from amigos am
      join congregaciones cc on cc.id = am.congregacion_id
      where cc.distrito_id = d.id and cc.id in (select mis_congregaciones()) and am.estado_espiritual = 'bautizado'
    ), 0) as funnel_bautizados,
    count(c.id) filter (where c.madurez = 'iglesia_local') as congregaciones_iglesia_local,
    count(c.id) filter (where c.madurez = 'lugar_prediccion') as congregaciones_lugar_prediccion,
    count(c.id) filter (where c.madurez = 'mision_nacional') as congregaciones_mision_nacional
  from distritos d
  left join congregaciones c on c.distrito_id = d.id and c.id in (select mis_congregaciones())
  left join vw_resumen_feligresia r on r.congregacion_id = c.id
  group by d.id, d.numero, d.nombre
  order by d.numero nulls last, d.nombre;
$$;

revoke all on function resumen_nacional() from public, anon;
grant execute on function resumen_nacional() to authenticated;
