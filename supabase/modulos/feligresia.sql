-- SIGA - Administracion de feligresia local.
-- Ejecutar despues de schema.sql y migracion_produccion.sql.
-- No depende de la PWA: es el censo administrativo de la congregacion.

alter table personas add column if not exists estado_membresia text not null default 'activo'
  check (estado_membresia in ('activo', 'apartado', 'trasladado', 'inactivo', 'fallecido'));
alter table personas add column if not exists bautizado boolean not null default false;
alter table personas add column if not exists fecha_bautismo date;
alter table personas add column if not exists fecha_ingreso date;
alter table personas add column if not exists fecha_ultima_asistencia date;
alter table personas add column if not exists observaciones_pastorales text;
alter table personas add column if not exists estado_civil text not null default 'soltero'
  check (estado_civil in ('soltero', 'casado', 'union_libre', 'divorciado', 'viudo'));

alter table amigos add column if not exists estado_espiritual text not null default 'en_ruta';
alter table amigos drop constraint if exists amigos_estado_espiritual_check;
alter table amigos add constraint amigos_estado_espiritual_check check (estado_espiritual in ('en_ruta', 'bautizado'));
alter table amigos add column if not exists persona_id uuid references personas(id) on delete set null;
alter table amigos add column if not exists fecha_nacimiento date;
alter table amigos add column if not exists estado_civil text not null default 'soltero';
alter table amigos drop constraint if exists amigos_estado_civil_check;
alter table amigos add constraint amigos_estado_civil_check check (estado_civil in ('soltero', 'casado', 'union_libre', 'divorciado', 'viudo'));
create unique index if not exists amigos_persona_id_unico on amigos (persona_id) where persona_id is not null;

create table if not exists familias (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre_familia text not null,
  direccion text,
  telefono text,
  created_at timestamptz not null default now()
);

create table if not exists familia_miembros (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  parentesco text not null default 'otro',
  es_referente boolean not null default false,
  created_at timestamptz not null default now(),
  unique (familia_id, persona_id),
  check (parentesco in ('referente', 'conyuge', 'padre', 'madre', 'hijo', 'hija', 'abuelo', 'abuela', 'nieto', 'nieta', 'hermano', 'hermana', 'nuera', 'yerno', 'otro'))
);

create table if not exists relaciones_familiares (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  relacionada_id uuid not null references personas(id) on delete cascade,
  tipo text not null,
  created_at timestamptz not null default now(),
  unique (persona_id, relacionada_id),
  check (persona_id <> relacionada_id),
  check (tipo in ('conyuge', 'padre', 'madre', 'hijo', 'hija', 'hermano', 'hermana'))
);

insert into familia_miembros (familia_id, persona_id, parentesco, es_referente)
select p.familia_id, p.id, coalesce(nullif(p.parentesco_familiar, ''), 'otro'), coalesce(p.parentesco_familiar = 'cabeza', false)
from personas p
where p.familia_id is not null
on conflict (familia_id, persona_id) do nothing;

create or replace function validar_relacion_familiar()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from personas p where p.id = new.persona_id and p.congregacion_id = (select congregacion_id from personas where id = new.relacionada_id)) then
    raise exception 'Las personas deben pertenecer a la misma congregación';
  end if;
  return new;
end;
$$;

drop trigger if exists relaciones_familiares_integridad on relaciones_familiares;
create trigger relaciones_familiares_integridad before insert or update on relaciones_familiares
for each row execute function validar_relacion_familiar();

alter table personas add column if not exists familia_id uuid references familias(id) on delete set null;
alter table personas add column if not exists parentesco_familiar text;
alter table roles_sistema add column if not exists rol_local text;
do $$ begin
  alter table roles_sistema add constraint roles_sistema_rol_local_check check (rol_local in ('pastor', 'secretario', 'lider_comite', 'solo_lectura'));
exception when duplicate_object then null;
end $$;

create or replace function validar_familia_de_persona()
returns trigger language plpgsql as $$
begin
  if new.familia_id is not null and not exists (
    select 1 from familias f
    where f.id = new.familia_id
      and f.congregacion_id = new.congregacion_id
  ) then
    raise exception 'La familia debe pertenecer a la misma congregación que la persona';
  end if;
  return new;
end;
$$;

drop trigger if exists personas_familia_misma_congregacion on personas;
create trigger personas_familia_misma_congregacion
before insert or update of familia_id, congregacion_id on personas
for each row execute function validar_familia_de_persona();

create table if not exists comites (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  codigo text,
  tipo_id uuid,
  descripcion text,
  proposito text,
  activo boolean not null default true,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  responsable_id uuid references personas(id) on delete set null,
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists tipos_comite (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  codigo text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, codigo)
);

create table if not exists cargos_comite (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nombre text not null,
  codigo text not null,
  descripcion text,
  obligatorio boolean not null default false,
  unico_por_comite boolean not null default false,
  admite_suplente boolean not null default false,
  orden smallint not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, codigo)
);

alter table comites add column if not exists codigo text;
alter table comites add column if not exists tipo_id uuid;
alter table comites drop constraint if exists comites_tipo_id_fkey;
alter table comites add constraint comites_tipo_id_fkey foreign key (tipo_id) references tipos_comite(id) on delete set null;
alter table comites add column if not exists proposito text;
alter table comites add column if not exists fecha_inicio date not null default current_date;
alter table comites add column if not exists fecha_fin date;
alter table comites add column if not exists responsable_id uuid references personas(id) on delete set null;
alter table comites add column if not exists observaciones text;

create unique index if not exists comites_codigo_unico on comites (congregacion_id, lower(trim(codigo))) where codigo is not null and trim(codigo) <> '';

create table if not exists membresias_comite (
  id uuid primary key default gen_random_uuid(),
  comite_id uuid not null references comites(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  cargo text,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  created_at timestamptz not null default now(),
  unique (comite_id, persona_id, fecha_inicio)
);

alter table membresias_comite add column if not exists cargo_id uuid references cargos_comite(id) on delete set null;
alter table membresias_comite add column if not exists estado text not null default 'vigente';
alter table membresias_comite add column if not exists motivo_retiro text;
alter table membresias_comite add column if not exists reemplaza_membresia_id uuid references membresias_comite(id) on delete set null;
alter table membresias_comite add column if not exists usuario_cambio_id uuid references auth.users(id) on delete set null;
alter table membresias_comite add column if not exists observaciones text;
alter table membresias_comite drop constraint if exists membresias_comite_estado_check;
alter table membresias_comite add constraint membresias_comite_estado_check check (estado in ('vigente', 'historico'));
create unique index if not exists membresias_comite_persona_activa_unica on membresias_comite (comite_id, persona_id) where fecha_fin is null and estado = 'vigente';

create table if not exists historial_cargos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  nombre_cargo text not null,
  area text,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists seguimientos_pastorales (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  tipo_alerta text,
  accion text not null,
  notas text,
  fecha date not null default current_date,
  proxima_fecha date,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'completado', 'cancelado')),
  usuario_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table seguimientos_pastorales add column if not exists proxima_fecha date;
alter table seguimientos_pastorales add column if not exists estado text not null default 'pendiente';
do $$ begin
  alter table seguimientos_pastorales add constraint seguimientos_pastorales_estado_check check (estado in ('pendiente', 'completado', 'cancelado'));
exception when duplicate_object then null;
end $$;

create or replace function validar_seguimiento_pastoral()
returns trigger language plpgsql as $$
begin
  if new.proxima_fecha is not null and new.proxima_fecha < new.fecha then
    raise exception 'La próxima fecha no puede ser anterior a la fecha del seguimiento';
  end if;
  if new.estado = 'pendiente' and new.proxima_fecha is null then
    raise exception 'Un seguimiento pendiente debe tener próxima fecha';
  end if;
  return new;
end;
$$;

drop trigger if exists seguimientos_pastorales_integridad on seguimientos_pastorales;
create trigger seguimientos_pastorales_integridad before insert or update on seguimientos_pastorales
for each row execute function validar_seguimiento_pastoral();

create table if not exists estados_alerta_pastoral (
  clave text primary key,
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  estado text not null default 'atendida' check (estado in ('atendida', 'reabierta')),
  notas text,
  atendida_por uuid references auth.users(id) on delete set null,
  atendida_en timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists auditoria_feligresia (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  entidad text not null,
  entidad_id uuid,
  entidad_clave text,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,
  despues jsonb,
  usuario_id uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now()
);

create or replace function registrar_auditoria_feligresia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fila jsonb;
  fila_anterior jsonb;
  congregacion uuid;
  entidad_id uuid;
begin
  fila := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  fila_anterior := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  entidad_id := case when fila->>'id' is not null then (fila->>'id')::uuid else null end;
  congregacion := (fila->>'congregacion_id')::uuid;
  if tg_table_name = 'membresias_comite' and congregacion is null then
    select c.congregacion_id into congregacion from comites c where c.id = (fila->>'comite_id')::uuid;
  elsif tg_table_name = 'historial_cargos' and congregacion is null then
    select p.congregacion_id into congregacion from personas p where p.id = (fila->>'persona_id')::uuid;
  end if;
  if congregacion is not null then
    insert into auditoria_feligresia (congregacion_id, entidad, entidad_id, entidad_clave, accion, antes, despues)
    values (congregacion, tg_table_name, entidad_id, fila->>'clave', tg_op, fila_anterior, case when tg_op = 'DELETE' then null else fila end);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists personas_auditoria on personas;
create trigger personas_auditoria after insert or update or delete on personas for each row execute function registrar_auditoria_feligresia();
drop trigger if exists familias_auditoria on familias;
create trigger familias_auditoria after insert or update or delete on familias for each row execute function registrar_auditoria_feligresia();
drop trigger if exists comites_auditoria on comites;
create trigger comites_auditoria after insert or update or delete on comites for each row execute function registrar_auditoria_feligresia();
drop trigger if exists membresias_comite_auditoria on membresias_comite;
create trigger membresias_comite_auditoria after insert or update or delete on membresias_comite for each row execute function registrar_auditoria_feligresia();
drop trigger if exists historial_cargos_auditoria on historial_cargos;
create trigger historial_cargos_auditoria after insert or update or delete on historial_cargos for each row execute function registrar_auditoria_feligresia();
drop trigger if exists seguimientos_pastorales_auditoria on seguimientos_pastorales;
create trigger seguimientos_pastorales_auditoria after insert or update or delete on seguimientos_pastorales for each row execute function registrar_auditoria_feligresia();
drop trigger if exists estados_alerta_pastoral_auditoria on estados_alerta_pastoral;
create trigger estados_alerta_pastoral_auditoria after insert or update or delete on estados_alerta_pastoral for each row execute function registrar_auditoria_feligresia();
drop trigger if exists asignaciones_acceso_auditoria on asignaciones_acceso;
create trigger asignaciones_acceso_auditoria after insert or update or delete on asignaciones_acceso for each row execute function registrar_auditoria_feligresia();

create or replace function validar_nombre_familia_unico()
returns trigger language plpgsql as $$
declare
  existe boolean;
begin
  select exists (select 1 from familias f where f.congregacion_id = new.congregacion_id
    and lower(trim(f.nombre_familia)) = lower(trim(new.nombre_familia)) and f.id <> new.id) into existe;
  if existe then
    raise exception 'Ya existe otra familia con ese nombre en la congregación';
  end if;
  return new;
end;
$$;

drop trigger if exists familias_nombre_unico on familias;
create trigger familias_nombre_unico before insert or update of nombre_familia, congregacion_id on familias
for each row execute function validar_nombre_familia_unico();

create or replace function validar_nombre_comite_unico()
returns trigger language plpgsql as $$
declare
  existe boolean;
begin
  select exists (select 1 from comites c where c.congregacion_id = new.congregacion_id
    and lower(trim(c.nombre)) = lower(trim(new.nombre)) and c.id <> new.id) into existe;
  if existe then
    raise exception 'Ya existe otro comité con ese nombre en la congregación';
  end if;
  return new;
end;
$$;

drop trigger if exists comites_nombre_unico on comites;
create trigger comites_nombre_unico before insert or update of nombre, congregacion_id on comites
for each row execute function validar_nombre_comite_unico();

create or replace function validar_comite_integridad()
returns trigger language plpgsql as $$
begin
  if new.fecha_fin is not null and new.fecha_fin < new.fecha_inicio then
    raise exception 'La fecha final del comité no puede ser anterior a la fecha inicial';
  end if;
  if new.responsable_id is not null and not exists (
    select 1 from personas p where p.id = new.responsable_id and p.congregacion_id = new.congregacion_id
  ) then
    raise exception 'El responsable debe pertenecer a la congregación del comité';
  end if;
  if new.tipo_id is not null and not exists (
    select 1 from tipos_comite t where t.id = new.tipo_id and t.congregacion_id = new.congregacion_id
  ) then
    raise exception 'El tipo de comité debe pertenecer a la misma congregación';
  end if;
  return new;
end;
$$;

drop trigger if exists comites_integridad on comites;
create trigger comites_integridad before insert or update on comites
for each row execute function validar_comite_integridad();

create or replace function validar_membresia_comite()
returns trigger language plpgsql as $$
declare
  cargo_unico boolean;
begin
  if not exists (
    select 1 from comites c join personas p on p.congregacion_id = c.congregacion_id
    where c.id = new.comite_id and p.id = new.persona_id
  ) then
    raise exception 'El comité y la persona deben pertenecer a la misma congregación';
  end if;
  if new.fecha_fin is not null and new.fecha_fin < new.fecha_inicio then
    raise exception 'La fecha final no puede ser anterior a la fecha inicial';
  end if;
  if new.estado = 'vigente' and new.fecha_fin is not null then
    raise exception 'Una membresía vigente no puede tener fecha de retiro';
  end if;
  if new.estado = 'historico' and new.fecha_fin is null then
    raise exception 'Una membresía histórica debe tener fecha de retiro';
  end if;
  if new.cargo_id is not null and not exists (
    select 1 from cargos_comite cc join comites c on c.congregacion_id = cc.congregacion_id
    where cc.id = new.cargo_id and c.id = new.comite_id
  ) then
    raise exception 'El cargo debe pertenecer a la misma congregación del comité';
  end if;
  select cc.unico_por_comite into cargo_unico from cargos_comite cc where cc.id = new.cargo_id;
  if coalesce(cargo_unico, false) and new.estado = 'vigente' and new.fecha_fin is null and exists (
    select 1 from membresias_comite mc
    where mc.comite_id = new.comite_id and mc.cargo_id = new.cargo_id
      and mc.estado = 'vigente' and mc.fecha_fin is null and mc.id <> new.id
  ) then
    raise exception 'El cargo configurado como único ya está ocupado en este comité';
  end if;
  if new.reemplaza_membresia_id is not null and not exists (
    select 1 from membresias_comite mc
    where mc.id = new.reemplaza_membresia_id and mc.comite_id = new.comite_id
      and mc.id <> new.id and mc.fecha_fin is not null
  ) then
    raise exception 'El reemplazo debe referirse a una membresía histórica del mismo comité';
  end if;
  if new.fecha_fin is null and exists (
    select 1 from membresias_comite mc
    where mc.comite_id = new.comite_id and mc.persona_id = new.persona_id
      and mc.fecha_fin is null and mc.id <> new.id
  ) then
    raise exception 'La persona ya tiene una membresía activa en este comité';
  end if;
  return new;
end;
$$;

drop trigger if exists membresia_comite_integridad on membresias_comite;
create trigger membresia_comite_integridad before insert or update on membresias_comite
for each row execute function validar_membresia_comite();

create or replace function reemplazar_membresia_comite(
  p_membresia_id uuid,
  p_persona_id uuid,
  p_cargo_id uuid default null,
  p_cargo text default null,
  p_fecha_efectiva date default current_date,
  p_motivo text default null,
  p_observaciones text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  anterior membresias_comite;
  nueva_id uuid;
  usuario uuid := auth.uid();
begin
  select mc.* into anterior from membresias_comite mc where mc.id = p_membresia_id for update;
  if anterior.id is null then raise exception 'La responsabilidad a reemplazar no existe'; end if;
  if not puede_gestionar_comite(anterior.comite_id) then raise exception 'No tienes permiso para reemplazar esta responsabilidad'; end if;
  if anterior.fecha_fin is not null or anterior.estado <> 'vigente' then raise exception 'La responsabilidad ya no está vigente'; end if;
  if not exists (
    select 1 from personas p join comites c on c.congregacion_id = p.congregacion_id
    where p.id = p_persona_id and c.id = anterior.comite_id
  ) then raise exception 'La persona nueva debe pertenecer a la congregación del comité'; end if;
  update membresias_comite
    set fecha_fin = p_fecha_efectiva - 1, estado = 'historico', motivo_retiro = p_motivo,
        usuario_cambio_id = usuario, observaciones = p_observaciones
    where id = anterior.id;
  insert into membresias_comite (comite_id, persona_id, cargo_id, cargo, fecha_inicio, estado,
    reemplaza_membresia_id, usuario_cambio_id, observaciones)
  values (anterior.comite_id, p_persona_id, p_cargo_id, p_cargo, p_fecha_efectiva, 'vigente',
    anterior.id, usuario, p_observaciones)
  returning id into nueva_id;
  return nueva_id;
end;
$$;

revoke all on function reemplazar_membresia_comite(uuid, uuid, uuid, text, date, text, text) from public, anon;
grant execute on function reemplazar_membresia_comite(uuid, uuid, uuid, text, date, text, text) to authenticated;

alter table familias enable row level security;
alter table familia_miembros enable row level security;
alter table relaciones_familiares enable row level security;
alter table comites enable row level security;
alter table tipos_comite enable row level security;
alter table cargos_comite enable row level security;
alter table membresias_comite enable row level security;
alter table historial_cargos enable row level security;
alter table seguimientos_pastorales enable row level security;
alter table estados_alerta_pastoral enable row level security;
alter table auditoria_feligresia enable row level security;

create or replace function puede_administrar_feligresia(p_congregacion_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roles_sistema r
    where r.persona_id = mi_persona_id()
      and r.nivel = 'local'
      and r.congregacion_id = p_congregacion_id
      and r.fecha_fin is null
      and (coalesce(r.rol_local, 'pastor') = 'pastor' or tiene_permiso(p_congregacion_id, 'feligresia.editar'))
  );
$$;

create or replace function incorporar_amigo_bautizado(
  p_amigo_id uuid,
  p_nombres text,
  p_apellidos text,
  p_fecha_nacimiento date default null,
  p_estado_civil text default 'soltero',
  p_fecha_ingreso date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  amigo record;
  persona_existente uuid;
begin
  select * into amigo from amigos where id = p_amigo_id for update;
  if amigo.id is null then raise exception 'El amigo no existe'; end if;
  if not puede_administrar_feligresia(amigo.congregacion_id) then raise exception 'No tienes permiso para incorporar personas a la feligresía'; end if;
  if amigo.estado_espiritual <> 'bautizado' then raise exception 'Solo un amigo bautizado puede incorporarse a la feligresía'; end if;
  if amigo.persona_id is not null then return amigo.persona_id; end if;
  if nullif(trim(p_nombres), '') is null or nullif(trim(p_apellidos), '') is null then raise exception 'Nombres y apellidos son obligatorios para incorporar la persona'; end if;
  p_fecha_nacimiento := coalesce(p_fecha_nacimiento, amigo.fecha_nacimiento);
  p_estado_civil := coalesce(p_estado_civil, amigo.estado_civil, 'soltero');
  if p_fecha_nacimiento is null then raise exception 'La fecha de nacimiento es obligatoria para incorporar la persona'; end if;
  if p_estado_civil not in ('soltero', 'casado', 'union_libre', 'divorciado', 'viudo') then raise exception 'El estado civil no es válido'; end if;

  insert into personas (congregacion_id, nombres, apellidos, telefono, fecha_nacimiento, estado_membresia, bautizado, fecha_bautismo, fecha_ingreso, estado_civil)
  values (amigo.congregacion_id, trim(p_nombres), trim(p_apellidos), amigo.telefono, p_fecha_nacimiento, 'activo', true, current_date, p_fecha_ingreso, p_estado_civil)
  returning id into persona_existente;
  update amigos set persona_id = persona_existente, convertido = true where id = amigo.id;
  return persona_existente;
end;
$$;

revoke all on function incorporar_amigo_bautizado(uuid, text, text, date, text, date) from public, anon;
grant execute on function incorporar_amigo_bautizado(uuid, text, text, date, text, date) to authenticated;

drop policy if exists amigos_write on amigos;
create policy amigos_write on amigos for all to authenticated
using (
  puede_administrar_feligresia(congregacion_id)
  or tengo_acceso_zona(zona_id)
)
with check (
  puede_administrar_feligresia(congregacion_id)
  or tengo_acceso_zona(zona_id)
);

drop policy if exists amigos_notas_scope on amigos_notas;
create policy amigos_notas_scope on amigos_notas for all to authenticated
using (exists (
  select 1 from amigos a
  where a.id = amigos_notas.amigo_id
    and (puede_administrar_feligresia(a.congregacion_id) or tengo_acceso_zona(a.zona_id))
))
with check (exists (
  select 1 from amigos a
  where a.id = amigos_notas.amigo_id
    and (puede_administrar_feligresia(a.congregacion_id) or tengo_acceso_zona(a.zona_id))
));

create or replace function puede_gestionar_comite(p_comite_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from comites c
    join roles_sistema r on r.congregacion_id = c.congregacion_id
    where c.id = p_comite_id
      and r.persona_id = mi_persona_id()
      and r.nivel = 'local'
      and r.fecha_fin is null
      and coalesce(r.rol_local, 'pastor') = 'pastor'
  ) or exists (
    select 1 from membresias_comite mc
    join comites c on c.id = mc.comite_id
    join personas p on p.id = mc.persona_id
    join roles_sistema r on r.persona_id = p.id and r.congregacion_id = c.congregacion_id
    where mc.comite_id = p_comite_id
      and mc.fecha_fin is null
      and lower(coalesce(mc.cargo, '')) in ('presidente', 'presidenta')
      and r.persona_id = mi_persona_id()
      and r.nivel = 'local'
      and r.rol_local = 'lider_comite'
      and r.fecha_fin is null
  );
$$;

drop policy if exists personas_scope on personas;
drop policy if exists personas_feligresia_read on personas;
drop policy if exists personas_feligresia_write on personas;
create policy personas_feligresia_read on personas for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy personas_feligresia_write on personas for all to authenticated
using (puede_administrar_feligresia(congregacion_id))
with check (puede_administrar_feligresia(congregacion_id));

drop policy if exists familias_scope on familias;
drop policy if exists familias_read on familias;
drop policy if exists familias_write on familias;
create policy familias_read on familias for select to authenticated
using (congregacion_id in (select mis_congregaciones()))
;
create policy familias_write on familias for all to authenticated
using (puede_administrar_feligresia(congregacion_id))
with check (puede_administrar_feligresia(congregacion_id));

drop policy if exists familia_miembros_read on familia_miembros;
create policy familia_miembros_read on familia_miembros for select to authenticated
using (exists (select 1 from familias f where f.id = familia_miembros.familia_id and f.congregacion_id in (select mis_congregaciones())));
drop policy if exists familia_miembros_write on familia_miembros;
create policy familia_miembros_write on familia_miembros for all to authenticated
using (exists (select 1 from familias f where f.id = familia_miembros.familia_id and puede_administrar_feligresia(f.congregacion_id)))
with check (exists (select 1 from familias f join personas p on p.congregacion_id = f.congregacion_id where f.id = familia_miembros.familia_id and p.id = familia_miembros.persona_id and puede_administrar_feligresia(f.congregacion_id)));

drop policy if exists relaciones_familiares_read on relaciones_familiares;
create policy relaciones_familiares_read on relaciones_familiares for select to authenticated
using (exists (select 1 from personas p where p.id = relaciones_familiares.persona_id and p.congregacion_id in (select mis_congregaciones())));
drop policy if exists relaciones_familiares_write on relaciones_familiares;
create policy relaciones_familiares_write on relaciones_familiares for all to authenticated
using (exists (select 1 from personas p where p.id = relaciones_familiares.persona_id and puede_administrar_feligresia(p.congregacion_id)))
with check (exists (select 1 from personas p join personas r on r.congregacion_id = p.congregacion_id where p.id = relaciones_familiares.persona_id and r.id = relaciones_familiares.relacionada_id and puede_administrar_feligresia(p.congregacion_id)));

drop policy if exists comites_scope on comites;
drop policy if exists comites_read on comites;
drop policy if exists comites_write on comites;
create policy comites_read on comites for select to authenticated
using (congregacion_id in (select mis_congregaciones()))
;
create policy comites_write on comites for all to authenticated
using (puede_administrar_feligresia(congregacion_id))
with check (puede_administrar_feligresia(congregacion_id));

drop policy if exists tipos_comite_read on tipos_comite;
drop policy if exists tipos_comite_write on tipos_comite;
create policy tipos_comite_read on tipos_comite for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy tipos_comite_write on tipos_comite for all to authenticated
using (puede_administrar_feligresia(congregacion_id))
with check (puede_administrar_feligresia(congregacion_id));

drop policy if exists cargos_comite_read on cargos_comite;
drop policy if exists cargos_comite_write on cargos_comite;
create policy cargos_comite_read on cargos_comite for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy cargos_comite_write on cargos_comite for all to authenticated
using (puede_administrar_feligresia(congregacion_id))
with check (puede_administrar_feligresia(congregacion_id));

drop policy if exists membresias_comite_scope on membresias_comite;
drop policy if exists membresias_comite_read on membresias_comite;
drop policy if exists membresias_comite_write on membresias_comite;
create policy membresias_comite_read on membresias_comite for select to authenticated
using (exists (
  select 1 from comites c join personas p on p.congregacion_id = c.congregacion_id
  where c.id = membresias_comite.comite_id and p.id = membresias_comite.persona_id
    and c.congregacion_id in (select mis_congregaciones())
 ));
create policy membresias_comite_write on membresias_comite for all to authenticated
using (exists (
  select 1 from comites c join personas p on p.congregacion_id = c.congregacion_id
  where c.id = membresias_comite.comite_id and p.id = membresias_comite.persona_id
    and c.congregacion_id in (select mis_congregaciones())
    and puede_gestionar_comite(c.id)
))
with check (exists (
  select 1 from comites c join personas p on p.congregacion_id = c.congregacion_id
  where c.id = membresias_comite.comite_id and p.id = membresias_comite.persona_id
    and c.congregacion_id in (select mis_congregaciones())
    and puede_gestionar_comite(c.id)
));

drop policy if exists historial_cargos_scope on historial_cargos;
drop policy if exists historial_cargos_read on historial_cargos;
drop policy if exists historial_cargos_write on historial_cargos;
create policy historial_cargos_read on historial_cargos for select to authenticated
using (exists (select 1 from personas p where p.id = historial_cargos.persona_id and p.congregacion_id in (select mis_congregaciones())));
create policy historial_cargos_write on historial_cargos for all to authenticated
using (exists (select 1 from personas p where p.id = historial_cargos.persona_id and p.congregacion_id in (select mis_congregaciones()) and puede_administrar_feligresia(p.congregacion_id)))
with check (exists (select 1 from personas p where p.id = historial_cargos.persona_id and p.congregacion_id in (select mis_congregaciones()) and puede_administrar_feligresia(p.congregacion_id)));

drop policy if exists seguimientos_pastorales_scope on seguimientos_pastorales;
drop policy if exists seguimientos_pastorales_read on seguimientos_pastorales;
drop policy if exists seguimientos_pastorales_write on seguimientos_pastorales;
create policy seguimientos_pastorales_read on seguimientos_pastorales for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy seguimientos_pastorales_write on seguimientos_pastorales for all to authenticated
using (puede_administrar_feligresia(congregacion_id))
with check (
  puede_administrar_feligresia(congregacion_id)
  and exists (select 1 from personas p where p.id = seguimientos_pastorales.persona_id and p.congregacion_id = seguimientos_pastorales.congregacion_id)
);

drop policy if exists estados_alerta_pastoral_scope on estados_alerta_pastoral;
drop policy if exists estados_alerta_pastoral_read on estados_alerta_pastoral;
drop policy if exists estados_alerta_pastoral_write on estados_alerta_pastoral;
create policy estados_alerta_pastoral_read on estados_alerta_pastoral for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy estados_alerta_pastoral_write on estados_alerta_pastoral for all to authenticated
using (puede_administrar_feligresia(congregacion_id))
with check (puede_administrar_feligresia(congregacion_id));

drop policy if exists auditoria_feligresia_read on auditoria_feligresia;
create policy auditoria_feligresia_read on auditoria_feligresia for select to authenticated
using (congregacion_id in (select mis_congregaciones()));

create index if not exists personas_feligresia_estado_idx on personas (congregacion_id, estado_membresia, bautizado);
create index if not exists personas_familia_idx on personas (familia_id);
create index if not exists familia_miembros_familia_idx on familia_miembros (familia_id, parentesco);
create index if not exists familia_miembros_persona_idx on familia_miembros (persona_id);
create index if not exists relaciones_familiares_persona_idx on relaciones_familiares (persona_id);
create index if not exists seguimientos_pastorales_persona_fecha_idx on seguimientos_pastorales (persona_id, fecha desc);
create index if not exists seguimientos_pastorales_agenda_idx on seguimientos_pastorales (congregacion_id, estado, proxima_fecha);

create or replace view vw_resumen_feligresia with (security_invoker = true) as
select
  congregacion_id,
  count(*) filter (where estado_membresia = 'activo') as personas_activas,
  count(*) filter (where estado_membresia = 'activo' and bautizado) as bautizados,
  count(*) filter (where estado_membresia = 'apartado') as apartados,
  count(distinct familia_id) filter (where familia_id is not null) as familias_asociadas
from personas
group by congregacion_id;
alter view vw_resumen_feligresia set (security_invoker = true);
create index if not exists estados_alerta_pastoral_congregacion_estado_idx on estados_alerta_pastoral (congregacion_id, estado);
create index if not exists auditoria_feligresia_congregacion_fecha_idx on auditoria_feligresia (congregacion_id, creado_en desc);
