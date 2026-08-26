-- =============================================================================
-- SIGA — Esquema SaaS multi-tenant para la IPUC nacional
-- Jormelia Soft
--
-- Principios de diseño acordados:
--   1. Multi-tenant: cada fila operativa pertenece a una congregación (tenant)
--   2. Jerarquía de roles: super_admin > nacional > distrital > local
--   3. Motor de captura GENÉRICO: Templo, Evangelismo, Misión Juvenil y
--      Apartados son todos instancias de un mismo modelo (módulo + tipo de
--      actividad + registro de asistencia), no tablas separadas
--   4. Catálogos configurables por congregación (tipos de culto, métodos,
--      categorías demográficas, módulos mismos)
--   5. Pipeline de "Amigos" con ruta de seguimiento configurable por
--      congregación, privacidad restringida a líder de zona + pastor + admin
--   6. RLS granular: el alcance de cada rol se resuelve consultando la
--      jerarquía real (asignaciones activas), igual que se decidió en el
--      diseño anterior — no JWT claims estáticos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ESTRUCTURA ORGANIZACIONAL (tenants y jerarquía)
-- -----------------------------------------------------------------------------

create table distritos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz default now()
);

create table congregaciones (
  id uuid primary key default gen_random_uuid(),
  distrito_id uuid not null references distritos(id),
  nombre text not null,
  pastor_nombre text not null,
  -- Estado explícito de aprobación — controlado por el rol Distrital.
  estado text not null default 'pendiente_aprobacion'
    check (estado in ('pendiente_aprobacion', 'activa', 'suspendida')),
  es_demo boolean not null default false,
  aprobada_por uuid references auth.users(id),
  aprobada_en timestamptz,
  created_at timestamptz default now()
);

-- Personas (miembros, ujieres, líderes...) — el dato base de toda persona
-- dentro de una congregación. Puede o no tener cuenta de acceso.
create table personas (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id),
  auth_user_id uuid references auth.users(id) unique,
  nombres text not null,
  apellidos text not null,
  telefono text,
  fecha_nacimiento date,
  created_at timestamptz default now()
);

-- Jerarquía de roles del sistema. Una persona puede tener varios roles
-- (ej. alguien Distrital que también es Local de su propia congregación).
-- fecha_fin = null → asignación activa (mismo patrón usado en todo el sistema).
create table roles_sistema (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id),
  nivel text not null check (nivel in ('super_admin', 'nacional', 'distrital', 'local')),
  distrito_id uuid references distritos(id),      -- obligatorio si nivel = 'distrital'
  congregacion_id uuid references congregaciones(id), -- obligatorio si nivel = 'local'
  fecha_inicio date not null default current_date,
  fecha_fin date,
  asignado_por uuid references auth.users(id),
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 2. MOTOR GENÉRICO DE MÓDULOS — Templo, Evangelismo, Misión Juvenil, Apartados
--    son todos filas de `modulos`, no tablas separadas.
-- -----------------------------------------------------------------------------

create table modulos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id),
  nombre_modulo text not null,               -- "Ujieres", "Evangelismo", "Misión Juvenil", "Comité de Rescate"...
  alcance text not null check (alcance in ('interno', 'extramural')),
  requiere_zona boolean not null default false, -- true = pide sector/barrio (Evangelismo)
  activo boolean not null default true,
  created_at timestamptz default now()
);

-- Catálogo de tipos de actividad por módulo — configurable por congregación.
-- Ej: para "Ujieres" → "Culto Martes", "Escuela Dominical"...
--     para "Evangelismo" → "REFAM", "Discipulado", "Visita"...
create table tipos_actividad (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references modulos(id) on delete cascade,
  nombre text not null,       -- identificador base, ej. "Culto Martes"
  caracter text,               -- editable, ej. "Enseñanza" — separado del nombre a propósito
  activo boolean not null default true
);

-- Categorías demográficas — base sugerida, editable/ampliable por congregación.
create table categorias_demograficas (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id),
  nombre text not null,        -- "Niños", "Adolescentes", "Jóvenes", "Caballeros", "Damas", "Ancianos", "Amigos"
  orden int default 0
);

-- Zonas/sectores para módulos extramurales (Evangelismo, Misión Juvenil).
create table zonas (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id),
  modulo_id uuid references modulos(id),
  nombre text not null          -- "Barrio San Juan", "Vereda La Loma", "Universidad Central"
);

-- Cargos dentro de un módulo, y quién lo ocupa (mismo patrón que ya se validó
-- en el diseño anterior: el permiso vive en el cargo, no en la persona).
create table cargos (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references modulos(id) on delete cascade,
  nombre_cargo text not null
);

create table asignaciones_cargo (
  id uuid primary key default gen_random_uuid(),
  cargo_id uuid not null references cargos(id) on delete cascade,
  persona_id uuid not null references personas(id),
  zona_id uuid references zonas(id),
  fecha_inicio date not null default current_date,
  fecha_fin date,
  autorizado_por uuid references personas(id)
);

-- Rotación segura de cargo — cierra la anterior, abre la nueva, conserva historial.
create or replace function rotar_asignacion_cargo(
  p_cargo_id uuid, p_persona_id uuid, p_zona_id uuid default null,
  p_fecha_inicio date default current_date
) returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  update asignaciones_cargo set fecha_fin = p_fecha_inicio - interval '1 day'
    where cargo_id = p_cargo_id and fecha_fin is null;
  insert into asignaciones_cargo (cargo_id, persona_id, zona_id, fecha_inicio)
  values (p_cargo_id, p_persona_id, p_zona_id, p_fecha_inicio) returning id into v_id;
  return v_id;
end; $$;

-- El registro de actividad/asistencia — UNA sola tabla para los 4 módulos.
create table registros_actividad (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id),
  modulo_id uuid not null references modulos(id),
  tipo_actividad_id uuid references tipos_actividad(id),
  zona_id uuid references zonas(id),
  capturado_por uuid not null default auth.uid() references auth.users(id),
  responsable_persona_id uuid references personas(id), -- responsable elegido de la lista (ujier de turno)
  fecha date not null default current_date,
  novedades text,
  desglose jsonb not null default '{}'::jsonb, -- { "categoria_id": total, ... }
  total_asistentes int not null default 0,
  created_at timestamptz default now()
);

create or replace function calcular_total_asistentes()
returns trigger language plpgsql as $$
begin
  new.total_asistentes = coalesce((
    select sum(value::int) from jsonb_each_text(new.desglose)
  ), 0);
  return new;
end; $$;

create trigger registros_actividad_total_trigger
before insert or update of desglose on registros_actividad
for each row execute function calcular_total_asistentes();

-- -----------------------------------------------------------------------------
-- 3. PIPELINE DE "AMIGOS" (no convertidos / en ruta de seguimiento)
-- -----------------------------------------------------------------------------

-- Ruta de etapas configurable por congregación (base sugerida: Contactado →
-- Visitado → Asistido → En seguimiento → Convertido).
create table etapas_seguimiento (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id),
  nombre text not null,
  orden int not null
);

create table amigos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id),
  nombres text not null,
  telefono text,
  direccion text,
  sector text,
  invitado_por text,
  fecha_primer_contacto date default current_date,
  zona_id uuid references zonas(id),          -- zona/líder responsable de su seguimiento
  etapa_id uuid references etapas_seguimiento(id),
  convertido boolean not null default false,
  -- Cuando se convierte, el ujier del templo debe poder contarlo directo en
  -- su categoría real (ej. Caballero) en vez de "Amigo" — este campo permite
  -- ese mapeo sin duplicar a la persona en el sistema.
  categoria_asignada_id uuid references categorias_demograficas(id),
  created_at timestamptz default now()
);

create table amigos_notas (
  id uuid primary key default gen_random_uuid(),
  amigo_id uuid not null references amigos(id) on delete cascade,
  nota text not null,
  creado_por uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

alter table congregaciones enable row level security;
alter table personas enable row level security;
alter table roles_sistema enable row level security;
alter table modulos enable row level security;
alter table registros_actividad enable row level security;
alter table amigos enable row level security;
alter table amigos_notas enable row level security;
alter table zonas enable row level security;
alter table asignaciones_cargo enable row level security;

-- Helper: nivel de rol más alto que tiene la persona actual, y su alcance.
create or replace function mi_persona_id() returns uuid language sql stable security definer as $$
  select id from personas where auth_user_id = auth.uid();
$$;

create policy "roles_sistema_select_own" on roles_sistema for select using (
  persona_id = mi_persona_id()
);

create or replace function es_super_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from roles_sistema where persona_id = mi_persona_id() and nivel = 'super_admin' and fecha_fin is null);
$$;

create or replace function es_nacional() returns boolean language sql stable security definer as $$
  select exists (select 1 from roles_sistema where persona_id = mi_persona_id() and nivel = 'nacional' and fecha_fin is null);
$$;

create or replace function mis_distritos() returns setof uuid language sql stable security definer as $$
  select distrito_id from roles_sistema where persona_id = mi_persona_id() and nivel = 'distrital' and fecha_fin is null;
$$;

create or replace function mis_congregaciones() returns setof uuid language sql stable security definer as $$
  select congregacion_id from roles_sistema where persona_id = mi_persona_id() and nivel = 'local' and fecha_fin is null
  union
  select c.id from congregaciones c where c.distrito_id in (select mis_distritos())
  union
  select id from congregaciones where es_super_admin() or es_nacional();
$$;

-- congregaciones: local ve/edita la suya; distrital ve/aprueba las de su distrito; nacional/super_admin ven todo.
create policy "congregaciones_select" on congregaciones for select using (id in (select mis_congregaciones()));
create policy "congregaciones_update_distrital" on congregaciones for update using (
  distrito_id in (select mis_distritos()) or es_super_admin() or es_nacional()
);
create policy "congregaciones_insert_self_register" on congregaciones for insert to authenticated with check (true);

-- Todo lo operativo se filtra por congregación dentro del alcance del usuario.
create policy "modulos_scope" on modulos for all using (congregacion_id in (select mis_congregaciones()));
create policy "registros_scope" on registros_actividad for all using (congregacion_id in (select mis_congregaciones()));
create policy "zonas_scope" on zonas for all using (congregacion_id in (select mis_congregaciones()));

-- amigos: privacidad estricta — solo el líder de esa zona específica, pastor
-- y admin local (roles 'local' de esa congregación), o niveles superiores.
create or replace function tengo_acceso_zona(p_zona_id uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from asignaciones_cargo ac
    where ac.zona_id = p_zona_id and ac.persona_id = mi_persona_id() and ac.fecha_fin is null
  );
$$;

create policy "amigos_select" on amigos for select using (
  tengo_acceso_zona(zona_id)
  or congregacion_id in (select congregacion_id from roles_sistema where persona_id = mi_persona_id() and nivel = 'local' and fecha_fin is null)
  or es_super_admin() or es_nacional()
  or congregacion_id in (select c.id from congregaciones c where c.distrito_id in (select mis_distritos()))
);
create policy "amigos_write" on amigos for all using (
  tengo_acceso_zona(zona_id)
  or congregacion_id in (select congregacion_id from roles_sistema where persona_id = mi_persona_id() and nivel = 'local' and fecha_fin is null)
);

-- -----------------------------------------------------------------------------
-- 5. SEED de datos demo (modo demo — flag es_demo)
-- -----------------------------------------------------------------------------

create or replace function crear_congregacion_demo(p_nombre text default 'Congregación Demo')
returns uuid language plpgsql security definer as $$
declare
  v_distrito_id uuid;
  v_congregacion_id uuid;
  v_modulo_ujieres uuid;
begin
  select id into v_distrito_id from distritos limit 1;
  if v_distrito_id is null then
    insert into distritos (nombre) values ('Distrito Demo') returning id into v_distrito_id;
  end if;

  insert into congregaciones (distrito_id, nombre, pastor_nombre, estado, es_demo)
  values (v_distrito_id, p_nombre, 'Pastor Demo', 'activa', true)
  returning id into v_congregacion_id;

  insert into modulos (congregacion_id, nombre_modulo, alcance) values
    (v_congregacion_id, 'Ujieres', 'interno') returning id into v_modulo_ujieres;

  insert into categorias_demograficas (congregacion_id, nombre, orden) values
    (v_congregacion_id, 'Niños', 1), (v_congregacion_id, 'Adolescentes', 2),
    (v_congregacion_id, 'Jóvenes', 3), (v_congregacion_id, 'Caballeros', 4),
    (v_congregacion_id, 'Damas', 5), (v_congregacion_id, 'Ancianos', 6),
    (v_congregacion_id, 'Amigos', 7);

  insert into tipos_actividad (modulo_id, nombre, caracter) values
    (v_modulo_ujieres, 'Culto Martes', 'Enseñanza'),
    (v_modulo_ujieres, 'Culto Jueves', 'Oración'),
    (v_modulo_ujieres, 'Culto Sábado', 'Jóvenes'),
    (v_modulo_ujieres, 'Escuela Dominical', null),
    (v_modulo_ujieres, 'Culto Domingo Noche', 'Evangelístico');

  insert into etapas_seguimiento (congregacion_id, nombre, orden) values
    (v_congregacion_id, 'Contactado', 1), (v_congregacion_id, 'Visitado', 2),
    (v_congregacion_id, 'Asistió', 3), (v_congregacion_id, 'En seguimiento', 4),
    (v_congregacion_id, 'Convertido', 5);

  return v_congregacion_id;
end; $$;

-- =============================================================================
-- Fin del esquema base.
-- =============================================================================
