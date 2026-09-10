-- SIGA - Informe Trimestral (Bautizados, Sellados, Reconciliados,
-- Entregados). Reemplaza el reporte manual por WhatsApp/correo: todo se
-- calcula en vivo bajo demanda, sin tabla de "informes enviados" ni boton
-- de enviar -- mismo patron que resumen_distrital/resumen_nacional/las
-- funciones resumen_X_distrital (ninguna de ellas congela nada tampoco).
-- El rol distrital ya puede leer todas las congregaciones de su distrito
-- (RLS via mis_congregaciones()) y el nacional ya puede leer todo -- el
-- "traslado" del informe ocurre estructuralmente por el rol, no por una
-- accion manual de "enviar".
--
-- Ejecutar despues de feligresia.sql, hitos_espirituales.sql,
-- ruta_evangelistica.sql y evangelismo.sql. Es repetible.
--
-- Decisiones de negocio (documentadas aqui, no implicitas):
-- 1. Bautizados/Sellados filtran estado_membresia = 'activo' -- mismo
--    criterio que vw_resumen_feligresia (el tile "Bautizados" que ya ve
--    el pastor local a diario). Un trasladado/fallecido/apartado ya no
--    cuenta para SU congregacion; si fue recibido en otra, esa otra lo
--    cuenta cuando lo reciba. Se filtra igual "nuevos" que "anterior"
--    para que anterior + nuevos = actual siempre cuadre exactamente.
-- 2. Reconciliados NO es un total acumulado -- es un evento puntual
--    (movimientos_membresia.tipo = 'reactivacion'), se compara trimestre
--    actual vs anterior, no "cuantos habia".
-- 3. Entregados se calcula solo sobre amigos (fecha_primer_contacto,
--    convertido, fecha_bautismo) -- NO se cruza con ruta_procesos para
--    nuevos/graduados/total, porque excluiria amigos recien contactados
--    que aun no tienen fila en ruta_procesos. ruta_procesos solo se usa
--    para el desglose operativo "hoy mismo por estacion" (aparte, no
--    historico del trimestre).
-- 4. Riesgo aceptado, no mitigado aqui: si alguien corrige retroactivamente
--    un dato de un trimestre ya cerrado, el numero ya mostrado a
--    distrital/nacional cambia despues silenciosamente -- no es un riesgo
--    nuevo, ya le pasa a todo el BI existente del repo.

drop function if exists resumen_informe_trimestral_congregacion(uuid, date, date, date, date);
create function resumen_informe_trimestral_congregacion(
  p_congregacion_id uuid,
  p_desde date,
  p_hasta date,
  p_desde_anterior date,
  p_hasta_anterior date
)
returns table (
  congregacion_id uuid,
  bautizados_total_anterior bigint,
  bautizados_nuevos bigint,
  bautizados_total_actual bigint,
  sellados_total_anterior bigint,
  sellados_nuevos bigint,
  sellados_total_actual bigint,
  reconciliados_actual bigint,
  reconciliados_anterior bigint,
  entregados_nuevos bigint,
  entregados_graduados bigint,
  entregados_total_anterior bigint,
  entregados_total_actual bigint,
  ruta_uno_mas bigint,
  ruta_bis bigint,
  ruta_refam bigint,
  ruta_esfob bigint
)
language sql stable security invoker set search_path = public as $$
  with bautizados as (
    select
      count(*) filter (where fecha_bautismo < p_desde) as anterior,
      count(*) filter (where fecha_bautismo between p_desde and p_hasta) as nuevos
    from personas
    where congregacion_id = p_congregacion_id and estado_membresia = 'activo' and bautizado
  ),
  sellados as (
    select
      count(*) filter (where fecha_sellado < p_desde) as anterior,
      count(*) filter (where fecha_sellado between p_desde and p_hasta) as nuevos
    from personas
    where congregacion_id = p_congregacion_id and estado_membresia = 'activo' and sellado_espiritu_santo
  ),
  reconciliados as (
    select
      count(*) filter (where fecha between p_desde and p_hasta) as actual,
      count(*) filter (where fecha between p_desde_anterior and p_hasta_anterior) as anterior
    from movimientos_membresia
    where congregacion_id = p_congregacion_id and tipo = 'reactivacion'
  ),
  entregados as (
    select
      count(*) filter (where fecha_primer_contacto between p_desde and p_hasta) as nuevos,
      count(*) filter (where convertido and fecha_bautismo between p_desde and p_hasta) as graduados,
      count(*) filter (where fecha_primer_contacto <= p_hasta_anterior and (not convertido or fecha_bautismo > p_hasta_anterior)) as total_anterior,
      count(*) filter (where fecha_primer_contacto <= p_hasta and (not convertido or fecha_bautismo > p_hasta)) as total_actual
    from amigos
    where congregacion_id = p_congregacion_id
  ),
  ruta as (
    select
      count(*) filter (where re.codigo = 'uno_mas') as uno_mas,
      count(*) filter (where re.codigo = 'bis') as bis,
      count(*) filter (where re.codigo = 'refam') as refam,
      count(*) filter (where re.codigo = 'esfob') as esfob
    from ruta_procesos rp
    join ruta_estaciones re on re.id = rp.estacion_id
    where rp.congregacion_id = p_congregacion_id and rp.estado = 'activo' and rp.amigo_id is not null
  )
  select
    p_congregacion_id,
    coalesce(b.anterior, 0), coalesce(b.nuevos, 0), coalesce(b.anterior, 0) + coalesce(b.nuevos, 0),
    coalesce(s.anterior, 0), coalesce(s.nuevos, 0), coalesce(s.anterior, 0) + coalesce(s.nuevos, 0),
    coalesce(r.actual, 0), coalesce(r.anterior, 0),
    coalesce(e.nuevos, 0), coalesce(e.graduados, 0), coalesce(e.total_anterior, 0), coalesce(e.total_actual, 0),
    coalesce(rt.uno_mas, 0), coalesce(rt.bis, 0), coalesce(rt.refam, 0), coalesce(rt.esfob, 0)
  from bautizados b, sellados s, reconciliados r, entregados e, ruta rt;
$$;

revoke all on function resumen_informe_trimestral_congregacion(uuid, date, date, date, date) from public, anon;
grant execute on function resumen_informe_trimestral_congregacion(uuid, date, date, date, date) to authenticated;

-- Nota de seguridad: esta funcion base NO filtra explicitamente
-- "congregacion_id in (select mis_congregaciones())" -- confia en la RLS
-- ya existente de personas/amigos/movimientos_membresia/ruta_procesos
-- (todas ya scoped por mis_congregaciones() o equivalente). Verificado
-- manualmente: ver docs/fixes/informe-trimestral-2026-09-10.md.

drop function if exists resumen_informe_trimestral_distrital(uuid, date, date, date, date);
create function resumen_informe_trimestral_distrital(
  p_distrito_id uuid,
  p_desde date,
  p_hasta date,
  p_desde_anterior date,
  p_hasta_anterior date
)
returns table (
  congregacion_id uuid,
  nombre text,
  ciudad text,
  bautizados_total_anterior bigint,
  bautizados_nuevos bigint,
  bautizados_total_actual bigint,
  sellados_total_anterior bigint,
  sellados_nuevos bigint,
  sellados_total_actual bigint,
  reconciliados_actual bigint,
  reconciliados_anterior bigint,
  entregados_nuevos bigint,
  entregados_graduados bigint,
  entregados_total_anterior bigint,
  entregados_total_actual bigint,
  ruta_uno_mas bigint,
  ruta_bis bigint,
  ruta_refam bigint,
  ruta_esfob bigint
)
language sql stable security invoker set search_path = public as $$
  select
    c.id, c.nombre, c.ciudad,
    t.bautizados_total_anterior, t.bautizados_nuevos, t.bautizados_total_actual,
    t.sellados_total_anterior, t.sellados_nuevos, t.sellados_total_actual,
    t.reconciliados_actual, t.reconciliados_anterior,
    t.entregados_nuevos, t.entregados_graduados, t.entregados_total_anterior, t.entregados_total_actual,
    t.ruta_uno_mas, t.ruta_bis, t.ruta_refam, t.ruta_esfob
  from congregaciones c
  cross join lateral resumen_informe_trimestral_congregacion(c.id, p_desde, p_hasta, p_desde_anterior, p_hasta_anterior) t
  where c.distrito_id = p_distrito_id
    and c.id in (select mis_congregaciones())
  order by c.nombre;
$$;

revoke all on function resumen_informe_trimestral_distrital(uuid, date, date, date, date) from public, anon;
grant execute on function resumen_informe_trimestral_distrital(uuid, date, date, date, date) to authenticated;

drop function if exists resumen_informe_trimestral_nacional(date, date, date, date);
create function resumen_informe_trimestral_nacional(
  p_desde date,
  p_hasta date,
  p_desde_anterior date,
  p_hasta_anterior date
)
returns table (
  distrito_id uuid,
  numero integer,
  nombre text,
  congregaciones bigint,
  bautizados_total_anterior bigint,
  bautizados_nuevos bigint,
  bautizados_total_actual bigint,
  sellados_total_anterior bigint,
  sellados_nuevos bigint,
  sellados_total_actual bigint,
  reconciliados_actual bigint,
  reconciliados_anterior bigint,
  entregados_nuevos bigint,
  entregados_graduados bigint,
  entregados_total_anterior bigint,
  entregados_total_actual bigint,
  ruta_uno_mas bigint,
  ruta_bis bigint,
  ruta_refam bigint,
  ruta_esfob bigint
)
language sql stable security invoker set search_path = public as $$
  select
    d.id, d.numero, d.nombre,
    count(c.id),
    coalesce(sum(t.bautizados_total_anterior), 0), coalesce(sum(t.bautizados_nuevos), 0), coalesce(sum(t.bautizados_total_actual), 0),
    coalesce(sum(t.sellados_total_anterior), 0), coalesce(sum(t.sellados_nuevos), 0), coalesce(sum(t.sellados_total_actual), 0),
    coalesce(sum(t.reconciliados_actual), 0), coalesce(sum(t.reconciliados_anterior), 0),
    coalesce(sum(t.entregados_nuevos), 0), coalesce(sum(t.entregados_graduados), 0),
    coalesce(sum(t.entregados_total_anterior), 0), coalesce(sum(t.entregados_total_actual), 0),
    coalesce(sum(t.ruta_uno_mas), 0), coalesce(sum(t.ruta_bis), 0), coalesce(sum(t.ruta_refam), 0), coalesce(sum(t.ruta_esfob), 0)
  from distritos d
  left join congregaciones c on c.distrito_id = d.id and c.id in (select mis_congregaciones())
  left join lateral resumen_informe_trimestral_congregacion(c.id, p_desde, p_hasta, p_desde_anterior, p_hasta_anterior) t on true
  where d.id in (select mis_distritos()) or es_super_admin() or es_nacional()
  group by d.id, d.numero, d.nombre
  order by d.numero nulls last, d.nombre;
$$;

revoke all on function resumen_informe_trimestral_nacional(date, date, date, date) from public, anon;
grant execute on function resumen_informe_trimestral_nacional(date, date, date, date) to authenticated;

-- Indices de apoyo (personas ya tiene (congregacion_id, estado_membresia,
-- bautizado); falta el equivalente para sellado, y amigos no tiene ningun
-- indice compuesto sobre las columnas que este informe filtra).
create index if not exists personas_sellado_idx on personas (congregacion_id, estado_membresia, sellado_espiritu_santo);
create index if not exists amigos_informe_trimestral_idx on amigos (congregacion_id, fecha_primer_contacto, convertido, fecha_bautismo);
