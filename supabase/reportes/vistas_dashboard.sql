-- =============================================================================
-- Vistas de agregación para el Dashboard.
-- Ejecutar DESPUÉS de supabase/schema.sql y supabase/feligresia.sql,
-- en el mismo proyecto Supabase.
--
-- Ambas vistas heredan el RLS de `registros_actividad` y `congregaciones`
-- (Postgres respeta RLS también dentro de vistas por defecto), así que cada
-- usuario ve automáticamente solo lo que le corresponde por su rol —
-- no hace falta filtrar por congregación_id manualmente en el frontend.
-- =============================================================================

-- Tendencia mensual de asistencia por categoría demográfica.
-- Lee el jsonb `desglose` de registros_actividad y lo despliega por categoría.
create or replace view vw_tendencia_categoria with (security_invoker = true) as
select
  to_char(ra.fecha, 'Mon') as mes,
  date_trunc('month', ra.fecha) as mes_orden,
  ra.congregacion_id,
  sum((ra.desglose->>cd.id::text)::int) filter (where cd.nombre = 'Damas') as damas,
  sum((ra.desglose->>cd.id::text)::int) filter (where cd.nombre = 'Jóvenes') as jovenes,
  sum((ra.desglose->>cd.id::text)::int) filter (where cd.nombre = 'Niños') as ninos,
  sum((ra.desglose->>cd.id::text)::int) filter (where cd.nombre = 'Adolescentes') as adolescentes,
  sum((ra.desglose->>cd.id::text)::int) filter (where cd.nombre = 'Caballeros') as caballeros,
  sum((ra.desglose->>cd.id::text)::int) filter (where cd.nombre = 'Ancianos') as ancianos
from registros_actividad ra
cross join categorias_demograficas cd
where cd.congregacion_id = ra.congregacion_id
  and ra.desglose ? cd.id::text
group by to_char(ra.fecha, 'Mon'), date_trunc('month', ra.fecha), ra.congregacion_id
order by date_trunc('month', ra.fecha);

-- Alertas individuales derivadas de la ficha de feligresía.
-- Se limitan a personas activas para evitar ruido sobre traslados o fallecidos.
-- Se elimina la versión anterior porque CREATE OR REPLACE VIEW no permite
-- cambiar nombres ni reordenar columnas existentes.
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
  from personas p where p.estado_membresia = 'activo' and p.familia_id is null
  union all
  select gen_random_uuid(), p.congregacion_id || ':bautismo:' || p.id || ':' || to_char(current_date, 'YYYY-MM'), p.congregacion_id,
    'bautismo', 'media', p.id, p.familia_id, null::uuid,
    'Persona pendiente de bautismo', p.nombres || ' ' || p.apellidos || ' figura como no bautizada.', current_date::timestamp
  from personas p where p.estado_membresia = 'activo' and not p.bautizado
  union all
  select gen_random_uuid(), p.congregacion_id || ':asistencia_persona:' || p.id || ':' || to_char(current_date, 'YYYY-MM'), p.congregacion_id,
    'asistencia_persona', 'alta', p.id, p.familia_id, null::uuid,
    'Persona sin asistencia reciente', p.nombres || ' ' || p.apellidos || ' no registra asistencia en los últimos 90 días.', current_date::timestamp
  from personas p where p.estado_membresia = 'activo' and (p.fecha_ultima_asistencia is null or p.fecha_ultima_asistencia < current_date - 90)
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

alter view vw_tendencia_categoria set (security_invoker = true);
alter view vw_alertas_pastorales set (security_invoker = true);
