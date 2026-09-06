-- SIGA - Censo de cargos jerarquicos de la junta distrital (Supervisor,
-- Secretario, Tesorero, Presbitero A, Presbitero B, Veedor), para que
-- nacional pueda medir quien ejerce funciones de liderazgo a nivel
-- distrital en todo el pais, ademas de los pastores locales.
-- Ejecutar despues de schema.sql, accesos.sql y pastoral_distrital.sql.
-- Es repetible.
--
-- Aclaracion importante (decision ya tomada esta sesion, ver
-- docs/investigacion-metodologia-ipuc-2026-09-01.md): esto NO reemplaza
-- ni cambia el modelo de ACCESO al software (roles_sistema sigue
-- teniendo un solo nivel 'distrital'). Esta tabla es un CENSO/registro
-- organizacional de quien ocupa cada cargo real de la junta distrital,
-- independiente de quien tiene acceso a SIGAP — un Veedor puede estar
-- censado aqui sin necesariamente tener una cuenta en el sistema.

create table if not exists cargos_distritales (
  id uuid primary key default gen_random_uuid(),
  distrito_id uuid not null references distritos(id) on delete cascade,
  persona_id uuid references personas(id) on delete set null,
  nombres text not null,
  apellidos text not null,
  cargo text not null check (cargo in ('supervisor', 'secretario', 'tesorero', 'presbitero_a', 'presbitero_b', 'veedor', 'otro')),
  fecha_inicio date not null default current_date,
  fecha_fin date,
  observaciones text,
  created_at timestamptz not null default now(),
  check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index if not exists cargos_distritales_distrito_idx on cargos_distritales (distrito_id, cargo, fecha_fin);

-- Solo puede haber una persona vigente por cargo en cada distrito (salvo
-- 'otro', que es de proposito libre y puede repetirse).
create unique index if not exists cargos_distritales_activo_unico on cargos_distritales (distrito_id, cargo) where fecha_fin is null and cargo <> 'otro';

alter table cargos_distritales enable row level security;

drop policy if exists cargos_distritales_read on cargos_distritales;
create policy cargos_distritales_read on cargos_distritales for select to authenticated
using (
  distrito_id in (select mis_distritos()) or es_super_admin() or es_nacional()
);

drop policy if exists cargos_distritales_write on cargos_distritales;
create policy cargos_distritales_write on cargos_distritales for all to authenticated
using (es_lider_distrital(distrito_id) or es_super_admin() or es_nacional())
with check (es_lider_distrital(distrito_id) or es_super_admin() or es_nacional());

revoke all on cargos_distritales from public, anon;
grant select, insert, update, delete on cargos_distritales to authenticated;

-- Consolidado nacional: pastores por nivel de licencia y cargos
-- distritales vigentes, por distrito. Analogo a resumen_nacional() pero
-- para la directiva, no para el censo de feligreses.
create or replace function resumen_pastoral_nacional()
returns table (
  distrito_id uuid,
  numero integer,
  nombre text,
  pastores_obrero bigint,
  pastores_local bigint,
  pastores_general bigint,
  pastores_ordenacion bigint,
  congregaciones_vacantes bigint,
  cargos_ocupados bigint,
  cargos_vacantes bigint
)
language sql stable security invoker set search_path = public as $$
  select
    d.id as distrito_id,
    d.numero,
    d.nombre,
    count(p.id) filter (where p.licencia = 'obrero') as pastores_obrero,
    count(p.id) filter (where p.licencia = 'local') as pastores_local,
    count(p.id) filter (where p.licencia = 'general') as pastores_general,
    count(p.id) filter (where p.licencia = 'ordenacion') as pastores_ordenacion,
    (select count(*) from congregaciones c where c.distrito_id = d.id and c.pastor_id is null) as congregaciones_vacantes,
    (select count(*) from cargos_distritales cd where cd.distrito_id = d.id and cd.fecha_fin is null) as cargos_ocupados,
    6 - (select count(*) from cargos_distritales cd where cd.distrito_id = d.id and cd.fecha_fin is null and cd.cargo <> 'otro') as cargos_vacantes
  from distritos d
  left join pastores p on p.distrito_id = d.id and p.id in (
    select ap.pastor_id from asignaciones_pastorales ap where ap.fecha_fin is null
  )
  where d.id in (select mis_distritos()) or es_super_admin() or es_nacional()
  group by d.id, d.numero, d.nombre
  order by d.numero nulls last, d.nombre;
$$;

revoke all on function resumen_pastoral_nacional() from public, anon;
grant execute on function resumen_pastoral_nacional() to authenticated;
