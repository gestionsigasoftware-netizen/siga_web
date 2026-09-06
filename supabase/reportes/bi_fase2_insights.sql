-- SIGA - Fase 2 del BI de la IPUC: insights de decisión sobre los datos de
-- la Fase 1 y lo que ya existía (sin módulos nuevos). Amplía
-- resumen_distrital() con lo necesario para brecha de llenura, eficacia de
-- REFAM, embudo de conversión de la Ruta, movimiento de membresía y madurez
-- de la obra. Ejecutar despues de hitos_espirituales.sql y
-- gestion_pastoral_distrital_v2.sql. Es repetible.

-- CREATE OR REPLACE FUNCTION no permite cambiar la lista de columnas de
-- retorno de una funcion returns table(...); hay que borrarla primero.
drop function if exists resumen_distrital(uuid);

create function resumen_distrital(p_distrito_id uuid)
returns table (
  congregacion_id uuid,
  nombre text,
  ciudad text,
  estado text,
  madurez text,
  pastor_nombre text,
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
  funnel_bautizados bigint
)
language sql stable security invoker set search_path = public as $$
  select
    c.id as congregacion_id,
    c.nombre,
    c.ciudad,
    c.estado,
    c.madurez,
    c.pastor_nombre,
    coalesce(r.personas_activas, 0),
    coalesce(r.bautizados, 0),
    coalesce(r.sellados, 0),
    coalesce(r.familias_asociadas, 0),
    coalesce((
      select count(*) from personas p
      where p.congregacion_id = c.id and p.created_at >= now() - interval '3 months'
    ), 0) as personas_nuevas_3m,
    coalesce((
      select sum(a.total_asistentes) from registros_actividad a
      where a.congregacion_id = c.id and a.fecha >= (current_date - interval '30 days')
    ), 0) as asistencia_ultimo_mes,
    coalesce((
      select sum(a.total_asistentes) from registros_actividad a
      where a.congregacion_id = c.id and a.fecha >= (current_date - interval '60 days') and a.fecha < (current_date - interval '30 days')
    ), 0) as asistencia_mes_anterior,
    coalesce((
      select count(*) from movimientos_membresia m
      where m.congregacion_id = c.id and m.tipo like 'alta_%' and m.fecha >= (current_date - interval '3 months')
    ), 0) as altas_3m,
    coalesce((
      select count(*) from movimientos_membresia m
      where m.congregacion_id = c.id and m.tipo like 'baja_%' and m.fecha >= (current_date - interval '3 months')
    ), 0) as bajas_3m,
    coalesce((
      select count(*) from personas p
      where p.congregacion_id = c.id and p.bautizado and p.fecha_bautismo >= (current_date - interval '3 months')
    ), 0) as bautismos_3m,
    coalesce((
      select count(*) from refam_asistencia_participante ap
      join refam_reuniones rr on rr.id = ap.reunion_id
      where rr.congregacion_id = c.id and ap.asistio and rr.fecha >= (current_date - interval '3 months')
    ), 0) as estudios_refam_3m,
    coalesce((
      select count(*) from ruta_procesos rp
      join ruta_estaciones re on re.id = rp.estacion_id
      where rp.congregacion_id = c.id and re.codigo = 'uno_mas' and rp.estado = 'activo'
    ), 0) as funnel_uno_mas,
    coalesce((
      select count(*) from ruta_procesos rp
      join ruta_estaciones re on re.id = rp.estacion_id
      where rp.congregacion_id = c.id and re.codigo = 'refam' and rp.estado = 'activo'
    ), 0) as funnel_refam,
    coalesce((
      select count(*) from amigos am
      where am.congregacion_id = c.id and am.estado_espiritual = 'bautizado'
    ), 0) as funnel_bautizados
  from congregaciones c
  left join vw_resumen_feligresia r on r.congregacion_id = c.id
  where c.distrito_id = p_distrito_id
    and c.id in (select mis_congregaciones())
  order by c.nombre;
$$;

revoke all on function resumen_distrital(uuid) from public, anon;
grant execute on function resumen_distrital(uuid) to authenticated;
