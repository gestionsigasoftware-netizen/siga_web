-- SIGA - Fase 3 del BI de la IPUC: Escuela Dominical (Mision Infantil) y
-- Damas Dorcas, con ficha individual por nino/beneficiaria, replicando el
-- patron ya probado de Mision Juvenil (mision_juvenil.sql). CRUD local,
-- consolidado distrital aparte (resumen_escuela_dominical_distrital /
-- resumen_damas_distrital), igual que Gestion pastoral.
-- Ejecutar despues de mision_juvenil.sql, seguridad_produccion.sql y
-- gestion_pastoral_distrital_v2.sql. Es repetible.
--
-- Correccion 2026-09-01: las politicas de lectura originales solo
-- concedian acceso via tiene_permiso(), que NO reconoce a distrital ni a
-- nacional/super_admin automaticamente (solo mira asignaciones_acceso y
-- el pastor local implicito). Esto hacia que resumen_escuela_dominical_distrital()
-- y resumen_damas_distrital() devolvieran 0 en todas las columnas para
-- cualquier congregacion donde el distrital no fuera tambien pastor local
-- (el hueco no se detecto antes porque las cuentas de prueba usadas tenian
-- un solo distrito con una sola congregacion, donde la misma persona era
-- pastor local Y coordinador distrital a la vez). Se agrego el mismo
-- bypass ya usado en obra_carcelaria.sql y en amigos_select (schema.sql).

-- =========================================================================
-- 1. ESCUELA DOMINICAL (MISION INFANTIL)
-- =========================================================================

create table if not exists escuela_dominical_clases (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  etapa text,
  metodologia text,
  maestro_lider_persona_id uuid references personas(id) on delete set null,
  leccion_actual integer not null default 1 check (leccion_actual > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists escuela_dominical_ninos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  clase_id uuid references escuela_dominical_clases(id) on delete set null,
  nombres text not null,
  apellidos text not null,
  fecha_nacimiento date,
  acudiente_nombre text,
  acudiente_telefono text,
  persona_id uuid references personas(id) on delete set null,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now()
);

create table if not exists escuela_dominical_lecciones (
  id uuid primary key default gen_random_uuid(),
  clase_id uuid not null references escuela_dominical_clases(id) on delete cascade,
  numero integer not null check (numero > 0),
  tema text not null,
  fecha date not null default current_date,
  asistentes integer not null default 0 check (asistentes >= 0),
  notas text,
  unique (clase_id, numero)
);

create table if not exists escuela_dominical_asistencia (
  id uuid primary key default gen_random_uuid(),
  leccion_id uuid not null references escuela_dominical_lecciones(id) on delete cascade,
  nino_id uuid not null references escuela_dominical_ninos(id) on delete cascade,
  asistio boolean not null default true,
  unique (leccion_id, nino_id)
);

create table if not exists escuela_dominical_maestros (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  rol text not null default 'maestro',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, persona_id)
);

alter table escuela_dominical_clases enable row level security;
alter table escuela_dominical_ninos enable row level security;
alter table escuela_dominical_lecciones enable row level security;
alter table escuela_dominical_asistencia enable row level security;
alter table escuela_dominical_maestros enable row level security;

drop policy if exists escuela_dominical_clases_read on escuela_dominical_clases;
drop policy if exists escuela_dominical_clases_write on escuela_dominical_clases;
create policy escuela_dominical_clases_read on escuela_dominical_clases for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'escuela_dominical.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy escuela_dominical_clases_write on escuela_dominical_clases for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'escuela_dominical.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'escuela_dominical.editar'));

drop policy if exists escuela_dominical_ninos_read on escuela_dominical_ninos;
drop policy if exists escuela_dominical_ninos_write on escuela_dominical_ninos;
create policy escuela_dominical_ninos_read on escuela_dominical_ninos for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'escuela_dominical.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy escuela_dominical_ninos_write on escuela_dominical_ninos for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'escuela_dominical.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'escuela_dominical.editar'));

drop policy if exists escuela_dominical_maestros_read on escuela_dominical_maestros;
drop policy if exists escuela_dominical_maestros_write on escuela_dominical_maestros;
create policy escuela_dominical_maestros_read on escuela_dominical_maestros for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'escuela_dominical.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy escuela_dominical_maestros_write on escuela_dominical_maestros for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'escuela_dominical.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'escuela_dominical.editar'));

drop policy if exists escuela_dominical_lecciones_read on escuela_dominical_lecciones;
drop policy if exists escuela_dominical_lecciones_write on escuela_dominical_lecciones;
create policy escuela_dominical_lecciones_read on escuela_dominical_lecciones for select to authenticated
using (exists (
  select 1 from escuela_dominical_clases cl where cl.id = escuela_dominical_lecciones.clase_id
  and (
    (cl.congregacion_id in (select mis_congregaciones()) and tiene_permiso(cl.congregacion_id, 'escuela_dominical.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = cl.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy escuela_dominical_lecciones_write on escuela_dominical_lecciones for all to authenticated
using (exists (select 1 from escuela_dominical_clases cl where cl.id = escuela_dominical_lecciones.clase_id
  and cl.congregacion_id in (select mis_congregaciones()) and tiene_permiso(cl.congregacion_id, 'escuela_dominical.editar')))
with check (exists (select 1 from escuela_dominical_clases cl where cl.id = escuela_dominical_lecciones.clase_id
  and cl.congregacion_id in (select mis_congregaciones()) and tiene_permiso(cl.congregacion_id, 'escuela_dominical.editar')));

drop policy if exists escuela_dominical_asistencia_read on escuela_dominical_asistencia;
drop policy if exists escuela_dominical_asistencia_write on escuela_dominical_asistencia;
create policy escuela_dominical_asistencia_read on escuela_dominical_asistencia for select to authenticated
using (exists (
  select 1 from escuela_dominical_lecciones l join escuela_dominical_clases cl on cl.id = l.clase_id
  where l.id = escuela_dominical_asistencia.leccion_id
    and (
      (cl.congregacion_id in (select mis_congregaciones()) and tiene_permiso(cl.congregacion_id, 'escuela_dominical.consultar'))
      or es_super_admin() or es_nacional()
      or exists (select 1 from congregaciones c where c.id = cl.congregacion_id and c.distrito_id in (select mis_distritos()))
    )
));
create policy escuela_dominical_asistencia_write on escuela_dominical_asistencia for all to authenticated
using (exists (select 1 from escuela_dominical_lecciones l join escuela_dominical_clases cl on cl.id = l.clase_id
  where l.id = escuela_dominical_asistencia.leccion_id
    and cl.congregacion_id in (select mis_congregaciones()) and tiene_permiso(cl.congregacion_id, 'escuela_dominical.editar')))
with check (exists (select 1 from escuela_dominical_lecciones l join escuela_dominical_clases cl on cl.id = l.clase_id
  where l.id = escuela_dominical_asistencia.leccion_id
    and cl.congregacion_id in (select mis_congregaciones()) and tiene_permiso(cl.congregacion_id, 'escuela_dominical.editar')));

-- =========================================================================
-- 2. MISION DAMAS (DORCAS)
-- =========================================================================

create table if not exists damas_dorcas_beneficiarias (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombres text not null,
  apellidos text not null,
  telefono text,
  direccion text,
  persona_id uuid references personas(id) on delete set null,
  responsable_persona_id uuid references personas(id) on delete set null,
  estado text not null default 'activa' check (estado in ('activa', 'inactiva')),
  created_at timestamptz not null default now()
);

create table if not exists damas_dorcas_actividades (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('visita', 'social', 'espiritual', 'otro')),
  descripcion text,
  responsable_persona_id uuid references personas(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists damas_dorcas_asistencia (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references damas_dorcas_actividades(id) on delete cascade,
  beneficiaria_id uuid not null references damas_dorcas_beneficiarias(id) on delete cascade,
  asistio boolean not null default true,
  unique (actividad_id, beneficiaria_id)
);

alter table damas_dorcas_beneficiarias enable row level security;
alter table damas_dorcas_actividades enable row level security;
alter table damas_dorcas_asistencia enable row level security;

drop policy if exists damas_dorcas_beneficiarias_read on damas_dorcas_beneficiarias;
drop policy if exists damas_dorcas_beneficiarias_write on damas_dorcas_beneficiarias;
create policy damas_dorcas_beneficiarias_read on damas_dorcas_beneficiarias for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'damas_dorcas.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy damas_dorcas_beneficiarias_write on damas_dorcas_beneficiarias for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'damas_dorcas.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'damas_dorcas.editar'));

drop policy if exists damas_dorcas_actividades_read on damas_dorcas_actividades;
drop policy if exists damas_dorcas_actividades_write on damas_dorcas_actividades;
create policy damas_dorcas_actividades_read on damas_dorcas_actividades for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'damas_dorcas.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy damas_dorcas_actividades_write on damas_dorcas_actividades for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'damas_dorcas.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'damas_dorcas.editar'));

drop policy if exists damas_dorcas_asistencia_read on damas_dorcas_asistencia;
drop policy if exists damas_dorcas_asistencia_write on damas_dorcas_asistencia;
create policy damas_dorcas_asistencia_read on damas_dorcas_asistencia for select to authenticated
using (exists (
  select 1 from damas_dorcas_actividades ac where ac.id = damas_dorcas_asistencia.actividad_id
  and (
    (ac.congregacion_id in (select mis_congregaciones()) and tiene_permiso(ac.congregacion_id, 'damas_dorcas.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = ac.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy damas_dorcas_asistencia_write on damas_dorcas_asistencia for all to authenticated
using (exists (select 1 from damas_dorcas_actividades ac where ac.id = damas_dorcas_asistencia.actividad_id
  and ac.congregacion_id in (select mis_congregaciones()) and tiene_permiso(ac.congregacion_id, 'damas_dorcas.editar')))
with check (exists (select 1 from damas_dorcas_actividades ac where ac.id = damas_dorcas_asistencia.actividad_id
  and ac.congregacion_id in (select mis_congregaciones()) and tiene_permiso(ac.congregacion_id, 'damas_dorcas.editar')));

-- =========================================================================
-- 3. PERMISOS DE PERFIL Y ACCESO IMPLICITO DEL PASTOR LOCAL
-- =========================================================================

insert into permisos_perfil (perfil_id, permiso)
select p.id, x.permiso from perfiles_acceso p
cross join (values
  ('pastor', 'escuela_dominical.consultar'), ('pastor', 'escuela_dominical.editar'), ('pastor', 'escuela_dominical.registrar'),
  ('estadisticas', 'escuela_dominical.consultar'), ('estadisticas', 'escuela_dominical.registrar'),
  ('consulta', 'escuela_dominical.consultar'),
  ('pastor', 'damas_dorcas.consultar'), ('pastor', 'damas_dorcas.editar'), ('pastor', 'damas_dorcas.registrar'),
  ('estadisticas', 'damas_dorcas.consultar'), ('estadisticas', 'damas_dorcas.registrar'),
  ('consulta', 'damas_dorcas.consultar')
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
        'damas_dorcas.registrar'
      )
  );
$$;

-- =========================================================================
-- 4. CONSOLIDADO DISTRITAL
-- =========================================================================

drop function if exists resumen_escuela_dominical_distrital(uuid);
create function resumen_escuela_dominical_distrital(p_distrito_id uuid)
returns table (
  congregacion_id uuid,
  nombre text,
  ciudad text,
  clases_activas bigint,
  ninos_activos bigint,
  maestros_activos bigint,
  lecciones_ultimo_mes bigint
)
language sql stable security invoker set search_path = public as $$
  select
    c.id as congregacion_id,
    c.nombre,
    c.ciudad,
    coalesce((select count(*) from escuela_dominical_clases cl where cl.congregacion_id = c.id and cl.activo), 0),
    coalesce((select count(*) from escuela_dominical_ninos n where n.congregacion_id = c.id and n.estado = 'activo'), 0),
    coalesce((select count(*) from escuela_dominical_maestros m where m.congregacion_id = c.id and m.activo), 0),
    coalesce((
      select count(*) from escuela_dominical_lecciones l
      join escuela_dominical_clases cl on cl.id = l.clase_id
      where cl.congregacion_id = c.id and l.fecha >= (current_date - interval '30 days')
    ), 0)
  from congregaciones c
  where c.distrito_id = p_distrito_id
    and c.id in (select mis_congregaciones())
  order by c.nombre;
$$;

revoke all on function resumen_escuela_dominical_distrital(uuid) from public, anon;
grant execute on function resumen_escuela_dominical_distrital(uuid) to authenticated;

drop function if exists resumen_damas_distrital(uuid);
create function resumen_damas_distrital(p_distrito_id uuid)
returns table (
  congregacion_id uuid,
  nombre text,
  ciudad text,
  beneficiarias_activas bigint,
  actividades_ultimo_mes bigint
)
language sql stable security invoker set search_path = public as $$
  select
    c.id as congregacion_id,
    c.nombre,
    c.ciudad,
    coalesce((select count(*) from damas_dorcas_beneficiarias b where b.congregacion_id = c.id and b.estado = 'activa'), 0),
    coalesce((select count(*) from damas_dorcas_actividades a where a.congregacion_id = c.id and a.fecha >= (current_date - interval '30 days')), 0)
  from congregaciones c
  where c.distrito_id = p_distrito_id
    and c.id in (select mis_congregaciones())
  order by c.nombre;
$$;

revoke all on function resumen_damas_distrital(uuid) from public, anon;
grant execute on function resumen_damas_distrital(uuid) to authenticated;
