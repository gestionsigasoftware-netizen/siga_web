-- SIGA - Consolidado distrital de Mision Juvenil y Red de Familias.
-- Mismo patron ya usado para los otros 9 comites (Escuela Dominical,
-- Damas Dorcas, Obra Carcelaria, Musica, Artistica, Teologica,
-- Conquistadores, Obra Social). Ejecutar despues de mision_juvenil.sql y
-- red_familias.sql. Es repetible.
--
-- Problema que resuelve: Mision Juvenil y Red de Familias son comites
-- reales con su propio censo (igual que los otros 9), pero no tenian
-- ningun consolidado distrital — solo el pastor local podia ver sus
-- propios numeros.

drop function if exists resumen_mision_juvenil_distrital(uuid);
create function resumen_mision_juvenil_distrital(p_distrito_id uuid)
returns table (congregacion_id uuid, nombre text, ciudad text, estudiantes_activos bigint, bautizados bigint, instituciones_impactadas bigint, grupos_activos bigint, lecciones_ultimo_mes bigint)
language sql stable security invoker set search_path = public as $$
  select c.id, c.nombre, c.ciudad,
    coalesce((select count(*) from mision_estudiantes e where e.congregacion_id = c.id and e.estado <> 'inactivo'), 0),
    coalesce((select count(*) from mision_estudiantes e where e.congregacion_id = c.id and e.estado = 'bautizado'), 0),
    coalesce((select count(*) from mision_instituciones i where i.congregacion_id = c.id and i.activo), 0),
    coalesce((select count(*) from mision_grupos g where g.congregacion_id = c.id and g.activo), 0),
    coalesce((select count(*) from mision_lecciones l join mision_grupos g on g.id = l.grupo_id where g.congregacion_id = c.id and l.fecha >= (current_date - interval '30 days')), 0)
  from congregaciones c where c.distrito_id = p_distrito_id and c.id in (select mis_congregaciones()) order by c.nombre;
$$;
revoke all on function resumen_mision_juvenil_distrital(uuid) from public, anon;
grant execute on function resumen_mision_juvenil_distrital(uuid) to authenticated;

drop function if exists resumen_red_familias_distrital(uuid);
create function resumen_red_familias_distrital(p_distrito_id uuid)
returns table (congregacion_id uuid, nombre text, ciudad text, casos_activos bigint, casos_alta_prioridad bigint, casos_cerrados_3m bigint, visitas_pendientes bigint, actividades_ultimo_mes bigint)
language sql stable security invoker set search_path = public as $$
  select c.id, c.nombre, c.ciudad,
    coalesce((select count(*) from red_familias_casos rc where rc.congregacion_id = c.id and rc.estado in ('solicitado', 'activo', 'pausado')), 0),
    coalesce((select count(*) from red_familias_casos rc where rc.congregacion_id = c.id and rc.estado in ('solicitado', 'activo', 'pausado') and rc.prioridad = 'alta'), 0),
    coalesce((select count(*) from red_familias_casos rc where rc.congregacion_id = c.id and rc.estado = 'cerrado' and rc.updated_at >= (current_date - interval '3 months')), 0),
    coalesce((select count(*) from red_familias_visitas rv where rv.congregacion_id = c.id and rv.estado = 'programada'), 0),
    coalesce((select count(*) from red_familias_actividades ra where ra.congregacion_id = c.id and ra.fecha >= (current_date - interval '30 days')), 0)
  from congregaciones c where c.distrito_id = p_distrito_id and c.id in (select mis_congregaciones()) order by c.nombre;
$$;
revoke all on function resumen_red_familias_distrital(uuid) from public, anon;
grant execute on function resumen_red_familias_distrital(uuid) to authenticated;
