-- SIGA - Musica, Educacion Artistica y Educacion Teologica: las 3 areas
-- educativas de FECP (Fundacion Educacion Cristiana Pentecostal, el
-- departamento nacional de educacion de la IPUC) que aun no tenian modulo
-- propio. Mismo patron ya probado en escuela_dominical_damas_dorcas.sql
-- (grupo -> sesion -> asistencia individual), porque institucionalmente
-- son la misma logica que Escuela Dominical: formacion estructurada con
-- progreso medible, no eventos sueltos.
-- Ejecutar despues de schema.sql, accesos.sql, seguridad_produccion.sql,
-- feligresia.sql, pastoral_distrital.sql. Es repetible.

-- =========================================================================
-- 1. MUSICA (MUSICA Y ALABANZA)
-- =========================================================================

create table if not exists musica_grupos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'alabanza' check (tipo in ('coro', 'orquesta', 'alabanza', 'otro')),
  instructor_persona_id uuid references personas(id) on delete set null,
  sesion_actual integer not null default 1 check (sesion_actual > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists musica_integrantes (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  grupo_id uuid references musica_grupos(id) on delete set null,
  instrumento_voz text,
  fecha_ingreso date not null default current_date,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  unique (congregacion_id, persona_id, grupo_id)
);

create table if not exists musica_sesiones (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references musica_grupos(id) on delete cascade,
  numero integer not null check (numero > 0),
  tema text not null,
  fecha date not null default current_date,
  asistentes integer not null default 0 check (asistentes >= 0),
  notas text,
  unique (grupo_id, numero)
);

create table if not exists musica_asistencia (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references musica_sesiones(id) on delete cascade,
  integrante_id uuid not null references musica_integrantes(id) on delete cascade,
  asistio boolean not null default true,
  unique (sesion_id, integrante_id)
);

-- =========================================================================
-- 2. EDUCACION ARTISTICA
-- =========================================================================

create table if not exists artistica_grupos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  disciplina text not null default 'danza' check (disciplina in ('danza', 'teatro', 'artes_visuales', 'otro')),
  instructor_persona_id uuid references personas(id) on delete set null,
  sesion_actual integer not null default 1 check (sesion_actual > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists artistica_integrantes (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  grupo_id uuid references artistica_grupos(id) on delete set null,
  fecha_ingreso date not null default current_date,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  unique (congregacion_id, persona_id, grupo_id)
);

create table if not exists artistica_sesiones (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references artistica_grupos(id) on delete cascade,
  numero integer not null check (numero > 0),
  tema text not null,
  fecha date not null default current_date,
  asistentes integer not null default 0 check (asistentes >= 0),
  notas text,
  unique (grupo_id, numero)
);

create table if not exists artistica_asistencia (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references artistica_sesiones(id) on delete cascade,
  integrante_id uuid not null references artistica_integrantes(id) on delete cascade,
  asistio boolean not null default true,
  unique (sesion_id, integrante_id)
);

-- =========================================================================
-- 3. EDUCACION TEOLOGICA (discipulado de membresia general, distinto de
--    formacion_pastoral que ya existe solo para pastores/licencias)
-- =========================================================================

create table if not exists teologica_grupos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  nivel text not null default 'curso'
    check (nivel in ('titulo', 'curso', 'diplomado', 'especializacion', 'maestria', 'doctorado', 'seminario_biblico', 'otro')),
  instructor_persona_id uuid references personas(id) on delete set null,
  sesion_actual integer not null default 1 check (sesion_actual > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists teologica_integrantes (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  grupo_id uuid references teologica_grupos(id) on delete set null,
  fecha_ingreso date not null default current_date,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  certificado boolean not null default false,
  fecha_certificado date,
  created_at timestamptz not null default now(),
  unique (congregacion_id, persona_id, grupo_id)
);

create table if not exists teologica_sesiones (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references teologica_grupos(id) on delete cascade,
  numero integer not null check (numero > 0),
  tema text not null,
  fecha date not null default current_date,
  asistentes integer not null default 0 check (asistentes >= 0),
  notas text,
  unique (grupo_id, numero)
);

create table if not exists teologica_asistencia (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references teologica_sesiones(id) on delete cascade,
  integrante_id uuid not null references teologica_integrantes(id) on delete cascade,
  asistio boolean not null default true,
  unique (sesion_id, integrante_id)
);

-- =========================================================================
-- 4. ROW LEVEL SECURITY (patron ya corregido esta sesion: lectura local
--    con tiene_permiso() + bypass distrital/nacional desde el diseno)
-- =========================================================================

alter table musica_grupos enable row level security;
alter table musica_integrantes enable row level security;
alter table musica_sesiones enable row level security;
alter table musica_asistencia enable row level security;
alter table artistica_grupos enable row level security;
alter table artistica_integrantes enable row level security;
alter table artistica_sesiones enable row level security;
alter table artistica_asistencia enable row level security;
alter table teologica_grupos enable row level security;
alter table teologica_integrantes enable row level security;
alter table teologica_sesiones enable row level security;
alter table teologica_asistencia enable row level security;

drop policy if exists musica_grupos_read on musica_grupos;
drop policy if exists musica_grupos_write on musica_grupos;
create policy musica_grupos_read on musica_grupos for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'musica.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy musica_grupos_write on musica_grupos for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'musica.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'musica.editar'));

drop policy if exists musica_integrantes_read on musica_integrantes;
drop policy if exists musica_integrantes_write on musica_integrantes;
create policy musica_integrantes_read on musica_integrantes for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'musica.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy musica_integrantes_write on musica_integrantes for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'musica.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'musica.editar'));

drop policy if exists musica_sesiones_read on musica_sesiones;
drop policy if exists musica_sesiones_write on musica_sesiones;
create policy musica_sesiones_read on musica_sesiones for select to authenticated
using (exists (
  select 1 from musica_grupos g where g.id = musica_sesiones.grupo_id
  and (
    (g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'musica.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = g.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy musica_sesiones_write on musica_sesiones for all to authenticated
using (exists (select 1 from musica_grupos g where g.id = musica_sesiones.grupo_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'musica.editar')))
with check (exists (select 1 from musica_grupos g where g.id = musica_sesiones.grupo_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'musica.editar')));

drop policy if exists musica_asistencia_read on musica_asistencia;
drop policy if exists musica_asistencia_write on musica_asistencia;
create policy musica_asistencia_read on musica_asistencia for select to authenticated
using (exists (
  select 1 from musica_sesiones s join musica_grupos g on g.id = s.grupo_id
  where s.id = musica_asistencia.sesion_id
  and (
    (g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'musica.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = g.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy musica_asistencia_write on musica_asistencia for all to authenticated
using (exists (select 1 from musica_sesiones s join musica_grupos g on g.id = s.grupo_id
  where s.id = musica_asistencia.sesion_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'musica.editar')))
with check (exists (select 1 from musica_sesiones s join musica_grupos g on g.id = s.grupo_id
  where s.id = musica_asistencia.sesion_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'musica.editar')));

drop policy if exists artistica_grupos_read on artistica_grupos;
drop policy if exists artistica_grupos_write on artistica_grupos;
create policy artistica_grupos_read on artistica_grupos for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'artistica.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy artistica_grupos_write on artistica_grupos for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'artistica.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'artistica.editar'));

drop policy if exists artistica_integrantes_read on artistica_integrantes;
drop policy if exists artistica_integrantes_write on artistica_integrantes;
create policy artistica_integrantes_read on artistica_integrantes for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'artistica.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy artistica_integrantes_write on artistica_integrantes for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'artistica.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'artistica.editar'));

drop policy if exists artistica_sesiones_read on artistica_sesiones;
drop policy if exists artistica_sesiones_write on artistica_sesiones;
create policy artistica_sesiones_read on artistica_sesiones for select to authenticated
using (exists (
  select 1 from artistica_grupos g where g.id = artistica_sesiones.grupo_id
  and (
    (g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'artistica.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = g.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy artistica_sesiones_write on artistica_sesiones for all to authenticated
using (exists (select 1 from artistica_grupos g where g.id = artistica_sesiones.grupo_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'artistica.editar')))
with check (exists (select 1 from artistica_grupos g where g.id = artistica_sesiones.grupo_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'artistica.editar')));

drop policy if exists artistica_asistencia_read on artistica_asistencia;
drop policy if exists artistica_asistencia_write on artistica_asistencia;
create policy artistica_asistencia_read on artistica_asistencia for select to authenticated
using (exists (
  select 1 from artistica_sesiones s join artistica_grupos g on g.id = s.grupo_id
  where s.id = artistica_asistencia.sesion_id
  and (
    (g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'artistica.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = g.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy artistica_asistencia_write on artistica_asistencia for all to authenticated
using (exists (select 1 from artistica_sesiones s join artistica_grupos g on g.id = s.grupo_id
  where s.id = artistica_asistencia.sesion_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'artistica.editar')))
with check (exists (select 1 from artistica_sesiones s join artistica_grupos g on g.id = s.grupo_id
  where s.id = artistica_asistencia.sesion_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'artistica.editar')));

drop policy if exists teologica_grupos_read on teologica_grupos;
drop policy if exists teologica_grupos_write on teologica_grupos;
create policy teologica_grupos_read on teologica_grupos for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'teologica.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy teologica_grupos_write on teologica_grupos for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'teologica.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'teologica.editar'));

drop policy if exists teologica_integrantes_read on teologica_integrantes;
drop policy if exists teologica_integrantes_write on teologica_integrantes;
create policy teologica_integrantes_read on teologica_integrantes for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'teologica.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy teologica_integrantes_write on teologica_integrantes for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'teologica.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'teologica.editar'));

drop policy if exists teologica_sesiones_read on teologica_sesiones;
drop policy if exists teologica_sesiones_write on teologica_sesiones;
create policy teologica_sesiones_read on teologica_sesiones for select to authenticated
using (exists (
  select 1 from teologica_grupos g where g.id = teologica_sesiones.grupo_id
  and (
    (g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'teologica.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = g.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy teologica_sesiones_write on teologica_sesiones for all to authenticated
using (exists (select 1 from teologica_grupos g where g.id = teologica_sesiones.grupo_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'teologica.editar')))
with check (exists (select 1 from teologica_grupos g where g.id = teologica_sesiones.grupo_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'teologica.editar')));

drop policy if exists teologica_asistencia_read on teologica_asistencia;
drop policy if exists teologica_asistencia_write on teologica_asistencia;
create policy teologica_asistencia_read on teologica_asistencia for select to authenticated
using (exists (
  select 1 from teologica_sesiones s join teologica_grupos g on g.id = s.grupo_id
  where s.id = teologica_asistencia.sesion_id
  and (
    (g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'teologica.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = g.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy teologica_asistencia_write on teologica_asistencia for all to authenticated
using (exists (select 1 from teologica_sesiones s join teologica_grupos g on g.id = s.grupo_id
  where s.id = teologica_asistencia.sesion_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'teologica.editar')))
with check (exists (select 1 from teologica_sesiones s join teologica_grupos g on g.id = s.grupo_id
  where s.id = teologica_asistencia.sesion_id
  and g.congregacion_id in (select mis_congregaciones()) and tiene_permiso(g.congregacion_id, 'teologica.editar')));

-- =========================================================================
-- 5. PERMISOS DE PERFIL Y ACCESO IMPLICITO DEL PASTOR LOCAL
-- =========================================================================

insert into permisos_perfil (perfil_id, permiso)
select p.id, x.permiso from perfiles_acceso p
cross join (values
  ('pastor', 'musica.consultar'), ('pastor', 'musica.editar'), ('pastor', 'musica.registrar'),
  ('estadisticas', 'musica.consultar'), ('estadisticas', 'musica.registrar'),
  ('consulta', 'musica.consultar'),
  ('pastor', 'artistica.consultar'), ('pastor', 'artistica.editar'), ('pastor', 'artistica.registrar'),
  ('estadisticas', 'artistica.consultar'), ('estadisticas', 'artistica.registrar'),
  ('consulta', 'artistica.consultar'),
  ('pastor', 'teologica.consultar'), ('pastor', 'teologica.editar'), ('pastor', 'teologica.registrar'),
  ('estadisticas', 'teologica.consultar'), ('estadisticas', 'teologica.registrar'),
  ('consulta', 'teologica.consultar')
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
-- 6. CONSOLIDADO DISTRITAL
-- =========================================================================

drop function if exists resumen_musica_distrital(uuid);
create function resumen_musica_distrital(p_distrito_id uuid)
returns table (congregacion_id uuid, nombre text, ciudad text, grupos_activos bigint, integrantes_activos bigint, sesiones_ultimo_mes bigint)
language sql stable security invoker set search_path = public as $$
  select c.id, c.nombre, c.ciudad,
    coalesce((select count(*) from musica_grupos g where g.congregacion_id = c.id and g.activo), 0),
    coalesce((select count(*) from musica_integrantes i where i.congregacion_id = c.id and i.estado = 'activo'), 0),
    coalesce((select count(*) from musica_sesiones s join musica_grupos g on g.id = s.grupo_id where g.congregacion_id = c.id and s.fecha >= (current_date - interval '30 days')), 0)
  from congregaciones c where c.distrito_id = p_distrito_id and c.id in (select mis_congregaciones()) order by c.nombre;
$$;
revoke all on function resumen_musica_distrital(uuid) from public, anon;
grant execute on function resumen_musica_distrital(uuid) to authenticated;

drop function if exists resumen_artistica_distrital(uuid);
create function resumen_artistica_distrital(p_distrito_id uuid)
returns table (congregacion_id uuid, nombre text, ciudad text, grupos_activos bigint, integrantes_activos bigint, sesiones_ultimo_mes bigint)
language sql stable security invoker set search_path = public as $$
  select c.id, c.nombre, c.ciudad,
    coalesce((select count(*) from artistica_grupos g where g.congregacion_id = c.id and g.activo), 0),
    coalesce((select count(*) from artistica_integrantes i where i.congregacion_id = c.id and i.estado = 'activo'), 0),
    coalesce((select count(*) from artistica_sesiones s join artistica_grupos g on g.id = s.grupo_id where g.congregacion_id = c.id and s.fecha >= (current_date - interval '30 days')), 0)
  from congregaciones c where c.distrito_id = p_distrito_id and c.id in (select mis_congregaciones()) order by c.nombre;
$$;
revoke all on function resumen_artistica_distrital(uuid) from public, anon;
grant execute on function resumen_artistica_distrital(uuid) to authenticated;

drop function if exists resumen_teologica_distrital(uuid);
create function resumen_teologica_distrital(p_distrito_id uuid)
returns table (congregacion_id uuid, nombre text, ciudad text, grupos_activos bigint, integrantes_activos bigint, certificados bigint, sesiones_ultimo_mes bigint)
language sql stable security invoker set search_path = public as $$
  select c.id, c.nombre, c.ciudad,
    coalesce((select count(*) from teologica_grupos g where g.congregacion_id = c.id and g.activo), 0),
    coalesce((select count(*) from teologica_integrantes i where i.congregacion_id = c.id and i.estado = 'activo'), 0),
    coalesce((select count(*) from teologica_integrantes i where i.congregacion_id = c.id and i.certificado), 0),
    coalesce((select count(*) from teologica_sesiones s join teologica_grupos g on g.id = s.grupo_id where g.congregacion_id = c.id and s.fecha >= (current_date - interval '30 days')), 0)
  from congregaciones c where c.distrito_id = p_distrito_id and c.id in (select mis_congregaciones()) order by c.nombre;
$$;
revoke all on function resumen_teologica_distrital(uuid) from public, anon;
grant execute on function resumen_teologica_distrital(uuid) to authenticated;
