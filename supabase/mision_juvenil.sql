-- SIGA - Modulo Mision Juvenil.
-- Ejecutar despues de schema.sql, accesos.sql y feligresia.sql.
-- La aplicacion movil alimenta asistencia y actividades mediante registros_actividad.

 do $$
declare
  v_modulo_id uuid;
  v_congregacion record;
  v_metodo text;
begin
  for v_congregacion in select id from congregaciones loop
    select id into v_modulo_id from modulos where congregacion_id = v_congregacion.id and lower(nombre_modulo) = 'mision juvenil' limit 1;
    if v_modulo_id is null then
      insert into modulos (congregacion_id, nombre_modulo, alcance, requiere_zona)
      values (v_congregacion.id, 'Mision Juvenil', 'extramural', true)
      returning id into v_modulo_id;
    else
      update modulos set alcance = 'extramural', requiere_zona = true where id = v_modulo_id;
    end if;
    foreach v_metodo in array array['Charla de valores', 'REFAM Juvenil', 'Celula Juvenil', 'Discipulado Juvenil', 'Culto Juvenil'] loop
      insert into tipos_actividad (modulo_id, nombre, caracter)
      select v_modulo_id, v_metodo, 'Mision Juvenil'
      where not exists (select 1 from tipos_actividad where modulo_id = v_modulo_id and lower(nombre) = lower(v_metodo));
    end loop;
  end loop;
end $$;

create table if not exists mision_instituciones (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'publica' check (tipo in ('publica', 'privada')),
  nivel text not null default 'bachillerato' check (nivel in ('bachillerato', 'universidad', 'otro')),
  direccion text,
  contacto_nombre text,
  contacto_cargo text,
  contacto_telefono text,
  contacto_email text,
  fase integer not null default 1 check (fase between 1 and 3),
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists mision_estudiantes (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  institucion_id uuid references mision_instituciones(id) on delete set null,
  tutor_persona_id uuid references personas(id) on delete set null,
  nombres text not null,
  apellidos text not null,
  fecha_nacimiento date,
  grado_semestre text,
  telefono text,
  estado text not null default 'simpatizante' check (estado in ('simpatizante', 'refam', 'discipulado', 'bautizado', 'inactivo')),
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists mision_grupos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  institucion_id uuid references mision_instituciones(id) on delete set null,
  nombre text not null,
  direccion text,
  lider_persona_id uuid references personas(id) on delete set null,
  leccion_actual integer not null default 1 check (leccion_actual > 0),
  lecciones_total integer not null default 10 check (lecciones_total > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists mision_lecciones (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references mision_grupos(id) on delete cascade,
  numero integer not null check (numero > 0),
  tema text not null,
  fecha date not null default current_date,
  asistentes integer not null default 0 check (asistentes >= 0),
  notas text,
  unique (grupo_id, numero)
);

create table if not exists mision_asistencia_estudiante (
  id uuid primary key default gen_random_uuid(),
  leccion_id uuid not null references mision_lecciones(id) on delete cascade,
  estudiante_id uuid not null references mision_estudiantes(id) on delete cascade,
  asistio boolean not null default true,
  unique (leccion_id, estudiante_id)
);

create table if not exists mision_lideres (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  rol text not null default 'gestor',
  documento_url text,
  certificado_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, persona_id)
);

create index if not exists mision_instituciones_scope_idx on mision_instituciones (congregacion_id, fase, activo);
create index if not exists mision_estudiantes_scope_idx on mision_estudiantes (congregacion_id, institucion_id, estado);
create index if not exists mision_grupos_scope_idx on mision_grupos (congregacion_id, institucion_id, activo);
create index if not exists mision_lecciones_grupo_fecha_idx on mision_lecciones (grupo_id, fecha desc);

alter table mision_instituciones enable row level security;
alter table mision_estudiantes enable row level security;
alter table mision_grupos enable row level security;
alter table mision_lecciones enable row level security;
alter table mision_asistencia_estudiante enable row level security;
alter table mision_lideres enable row level security;

do $policies$
begin
  execute 'drop policy if exists mision_instituciones_scope on mision_instituciones';
  execute 'create policy mision_instituciones_scope on mision_instituciones for all to authenticated using (congregacion_id in (select mis_congregaciones())) with check (congregacion_id in (select mis_congregaciones()))';
  execute 'drop policy if exists mision_estudiantes_scope on mision_estudiantes';
  execute 'create policy mision_estudiantes_scope on mision_estudiantes for all to authenticated using (congregacion_id in (select mis_congregaciones())) with check (congregacion_id in (select mis_congregaciones()))';
  execute 'drop policy if exists mision_grupos_scope on mision_grupos';
  execute 'create policy mision_grupos_scope on mision_grupos for all to authenticated using (congregacion_id in (select mis_congregaciones())) with check (congregacion_id in (select mis_congregaciones()))';
  execute 'drop policy if exists mision_lideres_scope on mision_lideres';
  execute 'create policy mision_lideres_scope on mision_lideres for all to authenticated using (congregacion_id in (select mis_congregaciones())) with check (congregacion_id in (select mis_congregaciones()))';
  execute 'drop policy if exists mision_lecciones_scope on mision_lecciones';
  execute 'create policy mision_lecciones_scope on mision_lecciones for all to authenticated using (exists (select 1 from mision_grupos g where g.id = mision_lecciones.grupo_id and g.congregacion_id in (select mis_congregaciones()))) with check (exists (select 1 from mision_grupos g where g.id = mision_lecciones.grupo_id and g.congregacion_id in (select mis_congregaciones())))';
  execute 'drop policy if exists mision_asistencia_scope on mision_asistencia_estudiante';
  execute 'create policy mision_asistencia_scope on mision_asistencia_estudiante for all to authenticated using (exists (select 1 from mision_lecciones l join mision_grupos g on g.id = l.grupo_id where l.id = mision_asistencia_estudiante.leccion_id and g.congregacion_id in (select mis_congregaciones()))) with check (exists (select 1 from mision_lecciones l join mision_grupos g on g.id = l.grupo_id where l.id = mision_asistencia_estudiante.leccion_id and g.congregacion_id in (select mis_congregaciones())))';
end
$policies$;

insert into permisos_perfil (perfil_id, permiso)
select p.id, x.permiso from perfiles_acceso p
cross join (values ('pastor', 'mision_juvenil.consultar'), ('pastor', 'mision_juvenil.editar'), ('pastor', 'mision_juvenil.registrar'), ('estadisticas', 'mision_juvenil.consultar'), ('estadisticas', 'mision_juvenil.registrar'), ('consulta', 'mision_juvenil.consultar')) x(codigo, permiso)
where p.codigo = x.codigo on conflict do nothing;
