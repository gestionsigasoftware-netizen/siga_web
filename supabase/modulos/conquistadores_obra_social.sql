-- SIGA - Conquistadores Pentecostales (jovenes adultos 18-40) y Obra
-- Social (asistencia socioeconomica a hermanos de la congregacion).
-- Conquistadores sigue el patron beneficiarios->actividades->asistencia
-- ya probado en Damas Dorcas.
--
-- Obra Social se conecta con Red de Familias (aclarado por el usuario):
-- el censo de familias en necesidad que usa Obra Social ES el mismo
-- `familias` que ya administra Feligresia/Red de Familias, no un censo
-- propio de personas sueltas. obra_social_casos.familia_id referencia
-- ese mismo censo, y red_familias_caso_id (opcional) permite enlazar el
-- caso de Obra Social con el caso puntual de Red de Familias que
-- identifico la necesidad, cuando existe uno.
-- Ejecutar despues de schema.sql, accesos.sql, seguridad_produccion.sql,
-- feligresia.sql, red_familias.sql. Es repetible.

-- =========================================================================
-- 1. CONQUISTADORES PENTECOSTALES
-- =========================================================================

create table if not exists conquistadores_miembros (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  rol text not null default 'miembro' check (rol in ('miembro', 'lider')),
  fecha_ingreso date not null default current_date,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  unique (congregacion_id, persona_id)
);

create table if not exists conquistadores_actividades (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('campamento', 'taller', 'social', 'reunion', 'otro')),
  descripcion text,
  responsable_persona_id uuid references personas(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists conquistadores_asistencia (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references conquistadores_actividades(id) on delete cascade,
  miembro_id uuid not null references conquistadores_miembros(id) on delete cascade,
  asistio boolean not null default true,
  unique (actividad_id, miembro_id)
);

alter table conquistadores_miembros enable row level security;
alter table conquistadores_actividades enable row level security;
alter table conquistadores_asistencia enable row level security;

drop policy if exists conquistadores_miembros_read on conquistadores_miembros;
drop policy if exists conquistadores_miembros_write on conquistadores_miembros;
create policy conquistadores_miembros_read on conquistadores_miembros for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'conquistadores.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy conquistadores_miembros_write on conquistadores_miembros for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'conquistadores.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'conquistadores.editar'));

drop policy if exists conquistadores_actividades_read on conquistadores_actividades;
drop policy if exists conquistadores_actividades_write on conquistadores_actividades;
create policy conquistadores_actividades_read on conquistadores_actividades for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'conquistadores.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy conquistadores_actividades_write on conquistadores_actividades for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'conquistadores.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'conquistadores.editar'));

drop policy if exists conquistadores_asistencia_read on conquistadores_asistencia;
drop policy if exists conquistadores_asistencia_write on conquistadores_asistencia;
create policy conquistadores_asistencia_read on conquistadores_asistencia for select to authenticated
using (exists (
  select 1 from conquistadores_actividades ac where ac.id = conquistadores_asistencia.actividad_id
  and (
    (ac.congregacion_id in (select mis_congregaciones()) and tiene_permiso(ac.congregacion_id, 'conquistadores.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = ac.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy conquistadores_asistencia_write on conquistadores_asistencia for all to authenticated
using (exists (select 1 from conquistadores_actividades ac where ac.id = conquistadores_asistencia.actividad_id
  and ac.congregacion_id in (select mis_congregaciones()) and tiene_permiso(ac.congregacion_id, 'conquistadores.editar')))
with check (exists (select 1 from conquistadores_actividades ac where ac.id = conquistadores_asistencia.actividad_id
  and ac.congregacion_id in (select mis_congregaciones()) and tiene_permiso(ac.congregacion_id, 'conquistadores.editar')));

-- =========================================================================
-- 2. OBRA SOCIAL
-- =========================================================================

create table if not exists obra_social_casos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  familia_id uuid not null references familias(id) on delete cascade,
  red_familias_caso_id uuid references red_familias_casos(id) on delete set null,
  tipo_necesidad text not null default 'economica' check (tipo_necesidad in ('economica', 'alimentaria', 'salud', 'vivienda', 'otra')),
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta')),
  estado text not null default 'identificada' check (estado in ('identificada', 'en_apoyo', 'resuelta', 'cerrada')),
  responsable_persona_id uuid references personas(id) on delete set null,
  fecha_apertura date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists obra_social_ayudas (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references obra_social_casos(id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null default 'material' check (tipo in ('material', 'economica', 'acompanamiento', 'otra')),
  descripcion text,
  responsable_persona_id uuid references personas(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table obra_social_casos enable row level security;
alter table obra_social_ayudas enable row level security;

drop policy if exists obra_social_casos_read on obra_social_casos;
drop policy if exists obra_social_casos_write on obra_social_casos;
create policy obra_social_casos_read on obra_social_casos for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_social.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy obra_social_casos_write on obra_social_casos for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_social.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_social.editar'));

drop policy if exists obra_social_ayudas_read on obra_social_ayudas;
drop policy if exists obra_social_ayudas_write on obra_social_ayudas;
create policy obra_social_ayudas_read on obra_social_ayudas for select to authenticated
using (exists (
  select 1 from obra_social_casos ca where ca.id = obra_social_ayudas.caso_id
  and (
    (ca.congregacion_id in (select mis_congregaciones()) and tiene_permiso(ca.congregacion_id, 'obra_social.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = ca.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy obra_social_ayudas_write on obra_social_ayudas for all to authenticated
using (exists (select 1 from obra_social_casos ca where ca.id = obra_social_ayudas.caso_id
  and ca.congregacion_id in (select mis_congregaciones()) and tiene_permiso(ca.congregacion_id, 'obra_social.editar')))
with check (exists (select 1 from obra_social_casos ca where ca.id = obra_social_ayudas.caso_id
  and ca.congregacion_id in (select mis_congregaciones()) and tiene_permiso(ca.congregacion_id, 'obra_social.editar')));

-- =========================================================================
-- 3. PERMISOS DE PERFIL Y ACCESO IMPLICITO DEL PASTOR LOCAL
-- =========================================================================

insert into permisos_perfil (perfil_id, permiso)
select p.id, x.permiso from perfiles_acceso p
cross join (values
  ('pastor', 'conquistadores.consultar'), ('pastor', 'conquistadores.editar'), ('pastor', 'conquistadores.registrar'),
  ('estadisticas', 'conquistadores.consultar'), ('estadisticas', 'conquistadores.registrar'),
  ('consulta', 'conquistadores.consultar'),
  ('pastor', 'obra_social.consultar'), ('pastor', 'obra_social.editar'), ('pastor', 'obra_social.registrar'),
  ('estadisticas', 'obra_social.consultar'), ('estadisticas', 'obra_social.registrar'),
  ('consulta', 'obra_social.consultar')
) x(codigo, permiso)
where p.codigo = x.codigo on conflict do nothing;

create or replace function tiene_permiso(p_congregacion_id uuid, p_permiso text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from asignaciones_acceso a
    join permisos_perfil pp on pp.perfil_id = a.perfil_id
    where a.persona_id = mi_persona_id()
      and a.congregacion_id = p_congregacion_id
      and a.fecha_fin is null
      and pp.permiso = p_permiso
  ) or exists (
    select 1 from roles_sistema r
    where r.persona_id = mi_persona_id()
      and r.nivel = 'local'
      and r.congregacion_id = p_congregacion_id
      and r.fecha_fin is null
      and coalesce(r.rol_local, 'pastor') = 'pastor'
      and p_permiso in (
        'feligresia.consultar', 'feligresia.editar',
        'red_familias.consultar', 'red_familias.editar',
        'estadisticas.consultar', 'estadisticas.registrar',
        'reportes.consultar', 'usuarios.administrar',
        'configuracion.administrar', 'auditoria.consultar',
        'evangelismo.consultar', 'evangelismo.editar',
        'evangelismo.registrar', 'mision_juvenil.consultar',
        'mision_juvenil.editar', 'mision_juvenil.registrar',
        'ruta_evangelistica.consultar', 'ruta_evangelistica.editar',
        'ruta_evangelistica.registrar',
        'escuela_dominical.consultar', 'escuela_dominical.editar',
        'escuela_dominical.registrar',
        'damas_dorcas.consultar', 'damas_dorcas.editar',
        'damas_dorcas.registrar',
        'obra_carcelaria.consultar', 'obra_carcelaria.editar',
        'obra_carcelaria.registrar',
        'musica.consultar', 'musica.editar', 'musica.registrar',
        'artistica.consultar', 'artistica.editar', 'artistica.registrar',
        'teologica.consultar', 'teologica.editar', 'teologica.registrar',
        'conquistadores.consultar', 'conquistadores.editar', 'conquistadores.registrar',
        'obra_social.consultar', 'obra_social.editar', 'obra_social.registrar'
      )
  );
$$;

-- =========================================================================
-- 4. CONSOLIDADO DISTRITAL
-- =========================================================================

drop function if exists resumen_conquistadores_distrital(uuid);
create function resumen_conquistadores_distrital(p_distrito_id uuid)
returns table (congregacion_id uuid, nombre text, ciudad text, miembros_activos bigint, lideres_activos bigint, actividades_ultimo_mes bigint)
language sql stable security invoker set search_path = public as $$
  select c.id, c.nombre, c.ciudad,
    coalesce((select count(*) from conquistadores_miembros m where m.congregacion_id = c.id and m.estado = 'activo'), 0),
    coalesce((select count(*) from conquistadores_miembros m where m.congregacion_id = c.id and m.estado = 'activo' and m.rol = 'lider'), 0),
    coalesce((select count(*) from conquistadores_actividades a where a.congregacion_id = c.id and a.fecha >= (current_date - interval '30 days')), 0)
  from congregaciones c where c.distrito_id = p_distrito_id and c.id in (select mis_congregaciones()) order by c.nombre;
$$;
revoke all on function resumen_conquistadores_distrital(uuid) from public, anon;
grant execute on function resumen_conquistadores_distrital(uuid) to authenticated;

drop function if exists resumen_obra_social_distrital(uuid);
create function resumen_obra_social_distrital(p_distrito_id uuid)
returns table (congregacion_id uuid, nombre text, ciudad text, casos_abiertos bigint, casos_resueltos bigint, ayudas_ultimo_mes bigint)
language sql stable security invoker set search_path = public as $$
  select c.id, c.nombre, c.ciudad,
    coalesce((select count(*) from obra_social_casos ca where ca.congregacion_id = c.id and ca.estado in ('identificada', 'en_apoyo')), 0),
    coalesce((select count(*) from obra_social_casos ca where ca.congregacion_id = c.id and ca.estado in ('resuelta', 'cerrada')), 0),
    coalesce((select count(*) from obra_social_ayudas ay join obra_social_casos ca on ca.id = ay.caso_id where ca.congregacion_id = c.id and ay.fecha >= (current_date - interval '30 days')), 0)
  from congregaciones c where c.distrito_id = p_distrito_id and c.id in (select mis_congregaciones()) order by c.nombre;
$$;
revoke all on function resumen_obra_social_distrital(uuid) from public, anon;
grant execute on function resumen_obra_social_distrital(uuid) to authenticated;
