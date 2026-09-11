-- =============================================================================
-- Fix: las 3 alertas de "ficha" (familia / bautismo / asistencia_persona) en
-- vw_alertas_pastorales se disparaban para CUALQUIER persona activa sin el
-- dato, sin importar si acababa de ingresar -- una persona registrada hoy
-- mismo (ej. el pastor que crea crear_congregacion_con_pastor()) salía
-- marcada con 3 alertas de una vez, igual que alguien realmente descuidado
-- desde hace meses. Mismo patrón "ausencia de dato != riesgo real" ya
-- corregido antes en Conquistadores.jsx/DamasDorcas.jsx (sin seguimiento
-- reciente comparado contra fecha_ingreso) -- aquí se aplica el mismo
-- criterio, ahora en la vista SQL de la que depende el Dashboard.
--
-- Periodos de gracia (desde fecha_ingreso, o created_at si no hay
-- fecha_ingreso registrada):
--   - familia:            30 días -- dato rápido de completar.
--   - bautismo:           90 días -- coincide con el mismo horizonte que
--                          ya usa "asistencia_persona" en esta vista.
--   - asistencia_persona: exige además 90 días desde el ingreso -- antes
--                          se exigían 90 días SIN asistencia pero sin
--                          verificar que la persona ya llevara esos 90
--                          días en la congregación.
--
-- Ejecutar en el SQL Editor de Supabase. Reemplaza por completo la
-- definición anterior de supabase/reportes/vistas_dashboard.sql (no la
-- edita en el archivo histórico, según la convención del proyecto).
-- =============================================================================

drop view if exists vw_alertas_pastorales;
create view vw_alertas_pastorales with (security_invoker = true) as
with alertas_asistencia as (
  select
    gen_random_uuid() as id,
    congregacion_id || ':asistencia:' || categoria_id || ':' || to_char(mes, 'YYYY-MM') as clave,
    congregacion_id,
    'asistencia'::text as tipo,
    'media'::text as prioridad,
    null::uuid as persona_id,
    null::uuid as familia_id,
    null::uuid as comite_id,
    categoria || ' bajó ' || round(100.0 * (total_mes_anterior - total) / nullif(total_mes_anterior, 0)) || '%' as titulo,
    'Comparado con el mes anterior (' || total_mes_anterior || ' → ' || total || ')' as detalle,
    mes
  from (
    select *, lag(total) over (partition by congregacion_id, categoria_id order by mes) as total_mes_anterior
    from (
      select ra.congregacion_id, cd.id as categoria_id, cd.nombre as categoria,
        date_trunc('month', ra.fecha) as mes,
        sum((ra.desglose->>cd.id::text)::int) as total
      from registros_actividad ra
      cross join categorias_demograficas cd
      where cd.congregacion_id = ra.congregacion_id and ra.desglose ? cd.id::text
      group by ra.congregacion_id, cd.id, cd.nombre, date_trunc('month', ra.fecha)
    ) mensual
  ) comparado
  where total_mes_anterior is not null and total < total_mes_anterior
    and mes < date_trunc('month', current_date)
    and (total_mes_anterior - total)::numeric / nullif(total_mes_anterior, 0) >= coalesce((select cc.umbral_alerta / 100 from configuracion_congregacion cc where cc.congregacion_id = comparado.congregacion_id), 0.15)
), alertas_ficha as (
  select gen_random_uuid() as id, p.congregacion_id || ':familia:' || p.id || ':' || to_char(current_date, 'YYYY-MM') as clave, p.congregacion_id,
    'familia'::text as tipo, 'alta'::text as prioridad, p.id as persona_id, p.familia_id, null::uuid as comite_id,
    'Persona sin familia registrada' as titulo, p.nombres || ' ' || p.apellidos || ' no tiene una familia asociada.' as detalle, current_date::timestamp as mes
  from personas p
  where p.estado_membresia = 'activo' and p.familia_id is null
    and coalesce(p.fecha_ingreso, p.created_at::date) <= current_date - 30
  union all
  select gen_random_uuid(), p.congregacion_id || ':bautismo:' || p.id || ':' || to_char(current_date, 'YYYY-MM'), p.congregacion_id,
    'bautismo', 'media', p.id, p.familia_id, null::uuid,
    'Persona pendiente de bautismo', p.nombres || ' ' || p.apellidos || ' figura como no bautizada.', current_date::timestamp
  from personas p
  where p.estado_membresia = 'activo' and not p.bautizado
    and coalesce(p.fecha_ingreso, p.created_at::date) <= current_date - 90
  union all
  select gen_random_uuid(), p.congregacion_id || ':asistencia_persona:' || p.id || ':' || to_char(current_date, 'YYYY-MM'), p.congregacion_id,
    'asistencia_persona', 'alta', p.id, p.familia_id, null::uuid,
    'Persona sin asistencia reciente', p.nombres || ' ' || p.apellidos || ' no registra asistencia en los últimos 90 días.', current_date::timestamp
  from personas p
  where p.estado_membresia = 'activo' and (p.fecha_ultima_asistencia is null or p.fecha_ultima_asistencia < current_date - 90)
    and coalesce(p.fecha_ingreso, p.created_at::date) <= current_date - 90
), alertas_comites as (
  select gen_random_uuid() as id,
    c.congregacion_id || ':comite:' || c.id as clave,
    c.congregacion_id,
    'comite'::text as tipo,
    'media'::text as prioridad,
    null::uuid as persona_id,
    null::uuid as familia_id,
    c.id as comite_id,
    'Comité sin integrantes' as titulo,
    c.nombre || ' no tiene integrantes asignados.' as detalle,
    current_date::timestamp as mes
  from comites c
  left join membresias_comite mc on mc.comite_id = c.id and mc.fecha_fin is null
  where c.activo and mc.id is null
)
select alertas.*
from (
  select * from alertas_asistencia
  union all
  select * from alertas_ficha
  union all
  select * from alertas_comites
) alertas
left join estados_alerta_pastoral estados on estados.congregacion_id = alertas.congregacion_id
  and (estados.clave = alertas.clave
    or estados.clave = substring(alertas.clave from position(':' in alertas.clave) + 1))
where estados.estado is distinct from 'atendida'
order by alertas.mes desc;

alter view vw_alertas_pastorales set (security_invoker = true);
