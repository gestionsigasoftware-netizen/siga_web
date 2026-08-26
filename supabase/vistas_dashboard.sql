-- =============================================================================
-- Vistas de agregación para el Dashboard.
-- Ejecutar DESPUÉS de supabase/schema.sql, en el mismo proyecto Supabase.
--
-- Ambas vistas heredan el RLS de `registros_actividad` y `congregaciones`
-- (Postgres respeta RLS también dentro de vistas por defecto), así que cada
-- usuario ve automáticamente solo lo que le corresponde por su rol —
-- no hace falta filtrar por congregación_id manualmente en el frontend.
-- =============================================================================

-- Tendencia mensual de asistencia por categoría demográfica.
-- Lee el jsonb `desglose` de registros_actividad y lo despliega por categoría.
create or replace view vw_tendencia_categoria as
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

-- Alertas pastorales: compara el mes actual contra el anterior, por
-- categoría, y dispara una alerta cuando la caída supera el umbral.
-- Umbral fijo en 15% por ahora — ajustar a lo que definan como sensibilidad
-- real (podría moverse a una tabla de configuración por congregación).
create or replace view vw_alertas_pastorales as
with por_mes as (
  select
    ra.congregacion_id,
    cd.id as categoria_id,
    cd.nombre as categoria,
    date_trunc('month', ra.fecha) as mes,
    sum((ra.desglose->>cd.id::text)::int) as total
  from registros_actividad ra
  cross join categorias_demograficas cd
  where cd.congregacion_id = ra.congregacion_id
    and ra.desglose ? cd.id::text
  group by ra.congregacion_id, cd.id, cd.nombre, date_trunc('month', ra.fecha)
),
comparado as (
  select
    congregacion_id,
    categoria,
    mes,
    total,
    lag(total) over (partition by congregacion_id, categoria_id order by mes) as total_mes_anterior
  from por_mes
)
select
  gen_random_uuid() as id,
  congregacion_id,
  categoria || ' bajó ' || round(100.0 * (total_mes_anterior - total) / nullif(total_mes_anterior, 0)) || '%' as titulo,
  'Comparado con el mes anterior (' || total_mes_anterior || ' → ' || total || ')' as detalle,
  mes
from comparado
where total_mes_anterior is not null
  and total < total_mes_anterior
  and (total_mes_anterior - total)::numeric / nullif(total_mes_anterior, 0) >= 0.15
order by mes desc;
