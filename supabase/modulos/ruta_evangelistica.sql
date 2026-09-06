-- SIGA - Procesos operativos de la Ruta Evangelistica.
-- Ejecutar despues de schema.sql, accesos.sql, feligresia.sql y evangelismo.sql.
-- No reemplaza amigos, personas ni registros_actividad.

create table if not exists ruta_estaciones (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  codigo text not null check (codigo in ('metodos', 'uno_mas', 'bis', 'refam', 'esfob', 'discipulado')),
  nombre text not null,
  descripcion text not null,
  orden integer not null check (orden between 1 and 6),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, codigo),
  unique (congregacion_id, orden)
);

insert into ruta_estaciones (congregacion_id, codigo, nombre, descripcion, orden)
select c.id, e.codigo, e.nombre, e.descripcion, e.orden
from congregaciones c
cross join (values
  ('metodos', 'Metodos', 'Caracterizacion y diagnostico del territorio.', 1),
  ('uno_mas', 'Uno Más', 'Sensibilizacion y tarea de todos.', 2),
  ('bis', 'BIS', 'Bienvenida, integracion y seguimiento.', 3),
  ('refam', 'REFAM', 'Evangelismo en los hogares mediante lecciones.', 4),
  ('esfob', 'ESFOB / EFOB', 'Formacion bautismal y preparacion doctrinal.', 5),
  ('discipulado', 'Discipulado', 'Maduracion espiritual y preparacion para servir.', 6)
) as e(codigo, nombre, descripcion, orden)
where not exists (
  select 1 from ruta_estaciones r
  where r.congregacion_id = c.id and r.codigo = e.codigo
);

-- Corrige congregaciones que ya tenian la fila sembrada antes de que se
-- agregara el acento (sin esto, el insert de arriba no la toca porque
-- el "where not exists" ya la ve como existente).
update ruta_estaciones set nombre = 'Uno Más' where codigo = 'uno_mas' and nombre = 'Uno Mas';

create table if not exists ruta_procesos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  estacion_id uuid not null references ruta_estaciones(id),
  amigo_id uuid references amigos(id) on delete cascade,
  persona_id uuid references personas(id) on delete cascade,
  responsable_persona_id uuid references personas(id) on delete set null,
  fecha_inicio date not null default current_date,
  fecha_cierre date,
  estado text not null default 'activo' check (estado in ('activo', 'completado', 'pausado', 'cancelado')),
  resultado text,
  estacion_siguiente_id uuid references ruta_estaciones(id) on delete set null,
  notas text,
  creado_por uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (fecha_cierre is null or fecha_cierre >= fecha_inicio),
  check ((amigo_id is null) <> (persona_id is null))
);

create or replace function validar_ruta_proceso()
returns trigger language plpgsql as $$
begin
  if new.amigo_id is not null and not exists (
    select 1 from amigos a where a.id = new.amigo_id and a.congregacion_id = new.congregacion_id
  ) then
    raise exception 'El amigo debe pertenecer a la misma congregación del proceso';
  end if;
  if new.persona_id is not null and not exists (
    select 1 from personas p where p.id = new.persona_id and p.congregacion_id = new.congregacion_id
  ) then
    raise exception 'La persona debe pertenecer a la misma congregación del proceso';
  end if;
  if not exists (
    select 1 from ruta_estaciones e where e.id = new.estacion_id and e.congregacion_id = new.congregacion_id
  ) then
    raise exception 'La estación debe pertenecer a la misma congregación del proceso';
  end if;
  if new.estacion_siguiente_id is not null and not exists (
    select 1 from ruta_estaciones e where e.id = new.estacion_siguiente_id and e.congregacion_id = new.congregacion_id
  ) then
    raise exception 'La estación siguiente debe pertenecer a la misma congregación del proceso';
  end if;
  return new;
end;
$$;

drop trigger if exists ruta_procesos_integridad on ruta_procesos;
create trigger ruta_procesos_integridad
before insert or update on ruta_procesos
for each row execute function validar_ruta_proceso();

create table if not exists ruta_diagnosticos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  proceso_id uuid not null references ruta_procesos(id) on delete cascade,
  zona_id uuid references zonas(id) on delete set null,
  responsable_persona_id uuid references personas(id) on delete set null,
  periodo_inicio date,
  periodo_fin date,
  poblacion_estimada integer check (poblacion_estimada is null or poblacion_estimada >= 0),
  necesidades jsonb not null default '[]'::jsonb,
  recursos jsonb not null default '[]'::jsonb,
  estrategia text,
  comite_responsable text,
  resultado text,
  created_at timestamptz not null default now()
);

create table if not exists uno_mas_compromisos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  proceso_id uuid not null references ruta_procesos(id) on delete cascade,
  miembro_id uuid not null references personas(id) on delete restrict,
  amigo_id uuid references amigos(id) on delete cascade,
  fecha_compromiso date not null default current_date,
  fecha_primer_contacto date,
  fecha_ultimo_contacto date,
  estado text not null default 'activo' check (estado in ('activo', 'cumplido', 'pausado', 'cerrado')),
  resultado text,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists bis_atenciones (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  proceso_id uuid not null references ruta_procesos(id) on delete cascade,
  amigo_id uuid not null references amigos(id) on delete cascade,
  responsable_persona_id uuid references personas(id) on delete set null,
  fecha_visita date not null default current_date,
  primera_visita boolean not null default true,
  recibimiento text,
  necesidad_inmediata text,
  contacto_posterior date,
  resultado_contacto text,
  integrado boolean not null default false,
  derivado_a text,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists refam_grupos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  zona_id uuid references zonas(id) on delete set null,
  anfitrion_persona_id uuid references personas(id) on delete set null,
  lider_persona_id uuid references personas(id) on delete set null,
  direccion text,
  dia_reunion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists refam_participantes (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  grupo_id uuid not null references refam_grupos(id) on delete cascade,
  amigo_id uuid references amigos(id) on delete cascade,
  persona_id uuid references personas(id) on delete cascade,
  fecha_ingreso date not null default current_date,
  estado text not null default 'activo' check (estado in ('activo', 'completado', 'retirado')),
  created_at timestamptz not null default now(),
  check (amigo_id is not null or persona_id is not null)
);

create table if not exists refam_reuniones (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  grupo_id uuid not null references refam_grupos(id) on delete cascade,
  fecha date not null default current_date,
  numero_leccion integer not null check (numero_leccion > 0),
  tema text,
  asistentes integer not null default 0 check (asistentes >= 0),
  visitantes integer not null default 0 check (visitantes >= 0),
  resultado text,
  novedades text,
  created_at timestamptz not null default now()
);

create table if not exists esfob_procesos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  proceso_id uuid not null references ruta_procesos(id) on delete cascade,
  amigo_id uuid not null references amigos(id) on delete cascade,
  responsable_persona_id uuid references personas(id) on delete set null,
  programa text not null default 'ESFOB',
  lecciones_total integer not null default 1 check (lecciones_total > 0),
  lecciones_completadas integer not null default 0 check (lecciones_completadas between 0 and lecciones_total),
  fecha_inicio date not null default current_date,
  fecha_aprobacion date,
  fecha_bautismo_prevista date,
  estado text not null default 'en_formacion' check (estado in ('en_formacion', 'aprobado', 'no_aprobado', 'retirado')),
  resultado text,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists discipulado_procesos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  proceso_id uuid not null references ruta_procesos(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  mentor_persona_id uuid references personas(id) on delete set null,
  programa text not null default 'Discipulado Crecer',
  fecha_inicio date not null default current_date,
  fecha_cierre date,
  estado text not null default 'activo' check (estado in ('activo', 'completado', 'pausado', 'retirado')),
  objetivos jsonb not null default '[]'::jsonb,
  dones_identificados jsonb not null default '[]'::jsonb,
  servicio_actual text,
  resultado text,
  siguiente_accion text,
  notas text,
  created_at timestamptz not null default now(),
  check (fecha_cierre is null or fecha_cierre >= fecha_inicio)
);

create index if not exists ruta_procesos_scope_idx on ruta_procesos (congregacion_id, estacion_id, estado, fecha_inicio desc);
create index if not exists ruta_procesos_amigo_idx on ruta_procesos (amigo_id, fecha_inicio desc);
create unique index if not exists ruta_proceso_amigo_activo_unico
  on ruta_procesos (congregacion_id, amigo_id, estacion_id)
  where amigo_id is not null and estado in ('activo', 'pausado');
create unique index if not exists ruta_proceso_persona_activo_unico
  on ruta_procesos (congregacion_id, persona_id, estacion_id)
  where persona_id is not null and estado in ('activo', 'pausado');
create index if not exists ruta_diagnosticos_scope_idx on ruta_diagnosticos (congregacion_id, zona_id);
create index if not exists uno_mas_scope_idx on uno_mas_compromisos (congregacion_id, estado, fecha_compromiso desc);
create index if not exists bis_scope_idx on bis_atenciones (congregacion_id, amigo_id, fecha_visita desc);
create index if not exists refam_grupos_scope_idx on refam_grupos (congregacion_id, activo);
create index if not exists refam_reuniones_scope_idx on refam_reuniones (congregacion_id, fecha desc);
create index if not exists esfob_scope_idx on esfob_procesos (congregacion_id, estado, fecha_inicio desc);
create index if not exists discipulado_scope_idx on discipulado_procesos (congregacion_id, estado, fecha_inicio desc);

alter table ruta_estaciones enable row level security;
alter table ruta_procesos enable row level security;
alter table ruta_diagnosticos enable row level security;
alter table uno_mas_compromisos enable row level security;
alter table bis_atenciones enable row level security;
alter table refam_grupos enable row level security;
alter table refam_participantes enable row level security;
alter table refam_reuniones enable row level security;
alter table esfob_procesos enable row level security;
alter table discipulado_procesos enable row level security;

do $policies$
declare
  v_table text;
begin
  foreach v_table in array array['ruta_estaciones', 'ruta_procesos', 'ruta_diagnosticos', 'uno_mas_compromisos', 'bis_atenciones', 'refam_grupos', 'refam_participantes', 'refam_reuniones', 'esfob_procesos', 'discipulado_procesos'] loop
    execute format('drop policy if exists %I_read on %I', v_table, v_table);
    execute format('drop policy if exists %I_insert on %I', v_table, v_table);
    execute format('drop policy if exists %I_update on %I', v_table, v_table);
    execute format('drop policy if exists %I_delete on %I', v_table, v_table);
    execute format('create policy %I_read on %I for select to authenticated using (congregacion_id in (select mis_congregaciones()) and (tiene_permiso(congregacion_id, ''ruta_evangelistica.consultar'') or (coalesce((select r.rol_local from roles_sistema r where r.persona_id = mi_persona_id() and r.nivel = ''local'' and r.congregacion_id = (select p.congregacion_id from personas p where p.id = mi_persona_id()) and r.fecha_fin is null), ''pastor'') = ''pastor'')))', v_table, v_table);
    execute format('create policy %I_insert on %I for insert to authenticated with check (congregacion_id in (select mis_congregaciones()) and (tiene_permiso(congregacion_id, ''ruta_evangelistica.registrar'') or tiene_permiso(congregacion_id, ''ruta_evangelistica.editar'') or (coalesce((select r.rol_local from roles_sistema r where r.persona_id = mi_persona_id() and r.nivel = ''local'' and r.congregacion_id = (select p.congregacion_id from personas p where p.id = mi_persona_id()) and r.fecha_fin is null), ''pastor'') = ''pastor'')))', v_table, v_table);
    execute format('create policy %I_update on %I for update to authenticated using (congregacion_id in (select mis_congregaciones()) and (tiene_permiso(congregacion_id, ''ruta_evangelistica.editar'') or (coalesce((select r.rol_local from roles_sistema r where r.persona_id = mi_persona_id() and r.nivel = ''local'' and r.congregacion_id = (select p.congregacion_id from personas p where p.id = mi_persona_id()) and r.fecha_fin is null), ''pastor'') = ''pastor''))) with check (congregacion_id in (select mis_congregaciones()) and (tiene_permiso(congregacion_id, ''ruta_evangelistica.editar'') or (coalesce((select r.rol_local from roles_sistema r where r.persona_id = mi_persona_id() and r.nivel = ''local'' and r.congregacion_id = (select p.congregacion_id from personas p where p.id = mi_persona_id()) and r.fecha_fin is null), ''pastor'') = ''pastor'')))', v_table, v_table);
    execute format('create policy %I_delete on %I for delete to authenticated using (congregacion_id in (select mis_congregaciones()) and (tiene_permiso(congregacion_id, ''ruta_evangelistica.editar'') or (coalesce((select r.rol_local from roles_sistema r where r.persona_id = mi_persona_id() and r.nivel = ''local'' and r.congregacion_id = (select p.congregacion_id from personas p where p.id = mi_persona_id()) and r.fecha_fin is null), ''pastor'') = ''pastor'')))', v_table, v_table);
  end loop;
end
$policies$;

insert into permisos_perfil (perfil_id, permiso)
select p.id, x.permiso
from perfiles_acceso p
cross join (values
  ('pastor', 'ruta_evangelistica.consultar'), ('pastor', 'ruta_evangelistica.editar'), ('pastor', 'ruta_evangelistica.registrar'),
  ('estadisticas', 'ruta_evangelistica.consultar'), ('estadisticas', 'ruta_evangelistica.registrar'),
  ('consulta', 'ruta_evangelistica.consultar')
) as x(codigo, permiso)
where p.codigo = x.codigo
on conflict do nothing;
