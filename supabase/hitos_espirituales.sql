-- SIGA - Fase 1 del BI de la IPUC: hitos espirituales, estudios REFAM
-- individuales, madurez de sede, movimientos de membresia y clasificacion
-- poblacional de zonas. Ver docs del rediseño BI para el contexto completo.
-- Ejecutar despues de feligresia.sql, ruta_evangelistica.sql y schema.sql.
-- Es repetible.

-- 1.1 Hitos espirituales: sellados con el Espiritu Santo (mismo patron que
--     bautizado/fecha_bautismo, que ya existe).
alter table personas add column if not exists sellado_espiritu_santo boolean not null default false;
alter table personas add column if not exists fecha_sellado date;

-- create or replace view no permite insertar una columna en medio de las
-- existentes (solo agregar al final) sin que Postgres lo interprete como un
-- rename; por eso "sellados" va despues de "apartados", no junto a "bautizados".
create or replace view vw_resumen_feligresia with (security_invoker = true) as
select
  congregacion_id,
  count(*) filter (where estado_membresia = 'activo') as personas_activas,
  count(*) filter (where estado_membresia = 'activo' and bautizado) as bautizados,
  count(*) filter (where estado_membresia = 'apartado') as apartados,
  count(distinct familia_id) filter (where familia_id is not null) as familias_asociadas,
  count(*) filter (where estado_membresia = 'activo' and sellado_espiritu_santo) as sellados
from personas
group by congregacion_id;
alter view vw_resumen_feligresia set (security_invoker = true);

-- 1.2 Estudios REFAM individuales: asistencia por participante y reunion,
--     mismo calco que mision_asistencia_estudiante.
create table if not exists refam_asistencia_participante (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references refam_reuniones(id) on delete cascade,
  participante_id uuid not null references refam_participantes(id) on delete cascade,
  asistio boolean not null default true,
  unique (reunion_id, participante_id)
);

alter table refam_asistencia_participante enable row level security;

drop policy if exists refam_asistencia_participante_scope on refam_asistencia_participante;
create policy refam_asistencia_participante_scope on refam_asistencia_participante for all to authenticated
using (exists (
  select 1 from refam_reuniones r
  where r.id = refam_asistencia_participante.reunion_id
    and r.congregacion_id in (select mis_congregaciones())
))
with check (exists (
  select 1 from refam_reuniones r
  where r.id = refam_asistencia_participante.reunion_id
    and r.congregacion_id in (select mis_congregaciones())
));

-- 1.3 Madurez de la sede (clasificacion oficial de la IPUC).
alter table congregaciones add column if not exists madurez text not null default 'lugar_prediccion'
  check (madurez in ('mision_nacional', 'lugar_prediccion', 'iglesia_local'));

-- 1.4 Movimientos de membresia: altas/bajas estructuradas y reportables,
--     complementa (no reemplaza) el log generico de auditoria_feligresia.
create table if not exists movimientos_membresia (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  tipo text not null check (tipo in ('alta_bautismo', 'alta_recibimiento', 'baja_traslado', 'baja_disciplina', 'baja_exclusion', 'reactivacion')),
  fecha date not null default current_date,
  congregacion_relacionada_id uuid references congregaciones(id) on delete set null,
  observaciones text,
  registrado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table movimientos_membresia enable row level security;

drop policy if exists movimientos_membresia_read on movimientos_membresia;
create policy movimientos_membresia_read on movimientos_membresia for select to authenticated
using (congregacion_id in (select mis_congregaciones()));

drop policy if exists movimientos_membresia_write on movimientos_membresia;
create policy movimientos_membresia_write on movimientos_membresia for insert to authenticated
with check (puede_administrar_feligresia(congregacion_id));

create index if not exists movimientos_membresia_congregacion_fecha_idx on movimientos_membresia (congregacion_id, fecha desc);

-- 1.5 Clasificacion poblacional de zonas de evangelismo.
alter table zonas add column if not exists tipo_poblacion text not null default 'general'
  check (tipo_poblacion in ('general', 'carcelaria', 'salud', 'indigena'));
