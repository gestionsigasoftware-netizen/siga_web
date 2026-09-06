-- SIGA - Obra Carcelaria: modulo completo del comite de evangelismo
-- penitenciario de la IPUC (asistencia interna en el centro de reclusion,
-- asistencia externa a la familia, seguimiento post-penitenciario).
-- Sigue dos patrones ya probados en el proyecto:
--   - Catalogo/asignacion por distrito, como pastores/asignaciones_pastorales
--     en pastoral_distrital.sql (centros_reclusion, obra_carcelaria_reinsercion).
--   - Ficha individual local + consolidado distrital, como
--     escuela_dominical_damas_dorcas.sql (delegados, internos, cultos).
-- Ejecutar despues de schema.sql, accesos.sql, seguridad_produccion.sql,
-- pastoral_distrital.sql, red_familias.sql y
-- escuela_dominical_damas_dorcas.sql. Es repetible.

-- =========================================================================
-- 1. CENTROS DE RECLUSION (catalogo por distrito)
-- =========================================================================

create table if not exists centros_reclusion (
  id uuid primary key default gen_random_uuid(),
  distrito_id uuid not null references distritos(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'municipal'
    check (tipo in ('maxima_seguridad', 'mediana_seguridad', 'municipal', 'correccional_menores', 'otro')),
  ciudad text,
  direccion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table centros_reclusion enable row level security;

-- Lectura: el coordinador distrital que lo administra, cualquier congregacion
-- de ese mismo distrito (para poder elegir el centro al registrar un culto),
-- o nacional/super_admin.
drop policy if exists centros_reclusion_read on centros_reclusion;
create policy centros_reclusion_read on centros_reclusion for select to authenticated
using (
  es_lider_distrital(distrito_id)
  or es_super_admin() or es_nacional()
  or distrito_id in (select c.distrito_id from congregaciones c where c.id in (select mis_congregaciones()))
);

-- Escritura: el catalogo de centros (y sus permisos INPEC) se coordina a
-- nivel distrital/nacional, tal como pidio el usuario.
drop policy if exists centros_reclusion_write on centros_reclusion;
create policy centros_reclusion_write on centros_reclusion for all to authenticated
using (es_lider_distrital(distrito_id) or es_super_admin() or es_nacional())
with check (es_lider_distrital(distrito_id) or es_super_admin() or es_nacional());

create index if not exists centros_reclusion_distrito_idx on centros_reclusion (distrito_id, activo);

-- =========================================================================
-- 2. DELEGADOS LOCALES (grupo de apoyo, habilitacion/auditoria INPEC)
-- =========================================================================

create table if not exists obra_carcelaria_delegados (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  centro_id uuid references centros_reclusion(id) on delete set null,
  permiso_inpec_vigente boolean not null default false,
  permiso_inpec_vencimiento date,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (congregacion_id, persona_id, centro_id)
);

-- =========================================================================
-- 3. INTERNOS (ficha individual - asistencia interna)
-- =========================================================================

create table if not exists obra_carcelaria_internos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  centro_id uuid references centros_reclusion(id) on delete set null,
  nombres text not null,
  apellidos text not null,
  patio text,
  fecha_ingreso_ministerio date not null default current_date,
  estado text not null default 'activo' check (estado in ('activo', 'liberado', 'trasladado', 'inactivo')),
  bautizado boolean not null default false,
  fecha_bautismo date,
  sellado boolean not null default false,
  fecha_sellado date,
  fecha_liberacion date,
  observaciones text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- 4. CULTOS Y REFAM CARCELARIA (asistencia interna)
-- =========================================================================

create table if not exists obra_carcelaria_cultos (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  centro_id uuid references centros_reclusion(id) on delete set null,
  fecha date not null default current_date,
  patio text,
  asistentes_total integer not null default 0 check (asistentes_total >= 0),
  estudios_biblicos_entregados integer not null default 0 check (estudios_biblicos_entregados >= 0),
  responsable_persona_id uuid references personas(id) on delete set null,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists obra_carcelaria_asistencia (
  id uuid primary key default gen_random_uuid(),
  culto_id uuid not null references obra_carcelaria_cultos(id) on delete cascade,
  interno_id uuid not null references obra_carcelaria_internos(id) on delete cascade,
  asistio boolean not null default true,
  unique (culto_id, interno_id)
);

-- =========================================================================
-- 5. SEGUIMIENTO FAMILIAR (asistencia externa)
-- =========================================================================
-- Tabla propia en vez de reutilizar red_familias_casos: esa tabla exige
-- familia_id not null (una familia ya censada en la congregacion), pero el
-- nucleo familiar de un interno frecuentemente no esta censado en ninguna
-- congregacion todavia. familia_id queda opcional para cuando SI lo esta.

create table if not exists obra_carcelaria_seguimiento_familiar (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  interno_id uuid not null references obra_carcelaria_internos(id) on delete cascade,
  familia_id uuid references familias(id) on delete set null,
  contacto_nombre text not null,
  parentesco text,
  telefono text,
  fecha_visita date not null default current_date,
  tipo_apoyo text not null default 'visita' check (tipo_apoyo in ('visita', 'consejeria', 'espiritual', 'material', 'otro')),
  responsable_persona_id uuid references personas(id) on delete set null,
  notas text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- 6. REINSERCION POST-PENITENCIARIA (cruza congregaciones)
-- =========================================================================
-- La congregacion destino puede estar en cualquier distrito (se asigna a la
-- iglesia mas cercana a la residencia del liberado, no necesariamente al
-- mismo distrito donde estaba el centro de reclusion). Solo el coordinador
-- distrital de origen puede crear la asignacion; el pastor destino puede
-- actualizar el estado para reportar si el liberado se integro.

create table if not exists obra_carcelaria_reinsercion (
  id uuid primary key default gen_random_uuid(),
  interno_id uuid not null references obra_carcelaria_internos(id) on delete cascade,
  distrito_id uuid not null references distritos(id) on delete cascade,
  congregacion_origen_id uuid not null references congregaciones(id) on delete cascade,
  congregacion_destino_id uuid not null references congregaciones(id) on delete cascade,
  fecha_asignacion date not null default current_date,
  estado text not null default 'asignado' check (estado in ('asignado', 'contactado', 'activo', 'inactivo', 'reincidencia')),
  notas text,
  created_at timestamptz not null default now()
);

create or replace function asignar_reinsercion(
  p_interno_id uuid,
  p_congregacion_destino uuid,
  p_notas text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_congregacion_origen uuid;
  v_distrito_id uuid;
  v_reinsercion_id uuid;
begin
  select congregacion_id into v_congregacion_origen from obra_carcelaria_internos where id = p_interno_id;
  if v_congregacion_origen is null then
    raise exception 'El interno no existe';
  end if;
  select distrito_id into v_distrito_id from congregaciones where id = v_congregacion_origen;
  if v_distrito_id is null or not es_lider_distrital(v_distrito_id) then
    raise exception 'No tienes permisos para asignar la reinsercion de este interno';
  end if;
  if not exists (select 1 from congregaciones where id = p_congregacion_destino and estado = 'activa') then
    raise exception 'La congregacion destino no existe o no esta activa';
  end if;
  if exists (
    select 1 from obra_carcelaria_reinsercion
    where interno_id = p_interno_id and estado not in ('inactivo', 'reincidencia')
  ) then
    raise exception 'Este interno ya tiene una reinsercion en curso';
  end if;
  update obra_carcelaria_internos set estado = 'trasladado' where id = p_interno_id;
  insert into obra_carcelaria_reinsercion (interno_id, distrito_id, congregacion_origen_id, congregacion_destino_id, notas)
    values (p_interno_id, v_distrito_id, v_congregacion_origen, p_congregacion_destino, p_notas)
    returning id into v_reinsercion_id;
  return v_reinsercion_id;
end;
$$;

revoke all on function asignar_reinsercion(uuid, uuid, text) from public, anon;
grant execute on function asignar_reinsercion(uuid, uuid, text) to authenticated;

-- =========================================================================
-- 7. ROW LEVEL SECURITY - tablas locales (delegados, internos, cultos,
--    asistencia, seguimiento familiar)
-- =========================================================================
-- Lectura: el propio alcance local con permiso (igual que Escuela
-- Dominical/Damas Dorcas) O cualquier distrital/nacional/super_admin con
-- alcance jerarquico sobre esa congregacion, sin depender de un grant
-- manual de tiene_permiso() (ese hueco existe hoy en Escuela
-- Dominical/Damas Dorcas y aqui se evita desde el diseno).

alter table obra_carcelaria_delegados enable row level security;
alter table obra_carcelaria_internos enable row level security;
alter table obra_carcelaria_cultos enable row level security;
alter table obra_carcelaria_asistencia enable row level security;
alter table obra_carcelaria_seguimiento_familiar enable row level security;
alter table obra_carcelaria_reinsercion enable row level security;

drop policy if exists obra_carcelaria_delegados_read on obra_carcelaria_delegados;
drop policy if exists obra_carcelaria_delegados_write on obra_carcelaria_delegados;
create policy obra_carcelaria_delegados_read on obra_carcelaria_delegados for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy obra_carcelaria_delegados_write on obra_carcelaria_delegados for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.editar'));

drop policy if exists obra_carcelaria_internos_read on obra_carcelaria_internos;
drop policy if exists obra_carcelaria_internos_write on obra_carcelaria_internos;
create policy obra_carcelaria_internos_read on obra_carcelaria_internos for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy obra_carcelaria_internos_write on obra_carcelaria_internos for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.editar'));

drop policy if exists obra_carcelaria_cultos_read on obra_carcelaria_cultos;
drop policy if exists obra_carcelaria_cultos_write on obra_carcelaria_cultos;
create policy obra_carcelaria_cultos_read on obra_carcelaria_cultos for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy obra_carcelaria_cultos_write on obra_carcelaria_cultos for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.editar'));

drop policy if exists obra_carcelaria_asistencia_read on obra_carcelaria_asistencia;
drop policy if exists obra_carcelaria_asistencia_write on obra_carcelaria_asistencia;
create policy obra_carcelaria_asistencia_read on obra_carcelaria_asistencia for select to authenticated
using (exists (
  select 1 from obra_carcelaria_cultos cu where cu.id = obra_carcelaria_asistencia.culto_id
  and (
    (cu.congregacion_id in (select mis_congregaciones()) and tiene_permiso(cu.congregacion_id, 'obra_carcelaria.consultar'))
    or es_super_admin() or es_nacional()
    or exists (select 1 from congregaciones c where c.id = cu.congregacion_id and c.distrito_id in (select mis_distritos()))
  )
));
create policy obra_carcelaria_asistencia_write on obra_carcelaria_asistencia for all to authenticated
using (exists (select 1 from obra_carcelaria_cultos cu where cu.id = obra_carcelaria_asistencia.culto_id
  and cu.congregacion_id in (select mis_congregaciones()) and tiene_permiso(cu.congregacion_id, 'obra_carcelaria.editar')))
with check (exists (select 1 from obra_carcelaria_cultos cu where cu.id = obra_carcelaria_asistencia.culto_id
  and cu.congregacion_id in (select mis_congregaciones()) and tiene_permiso(cu.congregacion_id, 'obra_carcelaria.editar')));

drop policy if exists obra_carcelaria_seguimiento_familiar_read on obra_carcelaria_seguimiento_familiar;
drop policy if exists obra_carcelaria_seguimiento_familiar_write on obra_carcelaria_seguimiento_familiar;
create policy obra_carcelaria_seguimiento_familiar_read on obra_carcelaria_seguimiento_familiar for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
create policy obra_carcelaria_seguimiento_familiar_write on obra_carcelaria_seguimiento_familiar for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'obra_carcelaria.editar'));

-- Reinsercion: lectura amplia a quien tenga alcance legitimo sobre origen,
-- destino o el distrito que gestiona el caso; insercion solo por el
-- coordinador distrital de origen (via asignar_reinsercion()); actualizacion
-- de estado tambien permitida al pastor de la congregacion destino, para
-- que pueda reportar si el liberado se integro (activo/inactivo/reincidencia).
drop policy if exists obra_carcelaria_reinsercion_read on obra_carcelaria_reinsercion;
create policy obra_carcelaria_reinsercion_read on obra_carcelaria_reinsercion for select to authenticated
using (
  es_lider_distrital(distrito_id)
  or es_super_admin() or es_nacional()
  or congregacion_origen_id in (select mis_congregaciones())
  or congregacion_destino_id in (select mis_congregaciones())
);

drop policy if exists obra_carcelaria_reinsercion_insert on obra_carcelaria_reinsercion;
create policy obra_carcelaria_reinsercion_insert on obra_carcelaria_reinsercion for insert to authenticated
with check (es_lider_distrital(distrito_id) or es_super_admin() or es_nacional());

drop policy if exists obra_carcelaria_reinsercion_update on obra_carcelaria_reinsercion;
create policy obra_carcelaria_reinsercion_update on obra_carcelaria_reinsercion for update to authenticated
using (
  es_lider_distrital(distrito_id)
  or congregacion_destino_id in (select mis_congregaciones())
  or es_super_admin() or es_nacional()
)
with check (
  es_lider_distrital(distrito_id)
  or congregacion_destino_id in (select mis_congregaciones())
  or es_super_admin() or es_nacional()
);

create index if not exists obra_carcelaria_internos_congregacion_idx on obra_carcelaria_internos (congregacion_id, estado);
create index if not exists obra_carcelaria_cultos_congregacion_idx on obra_carcelaria_cultos (congregacion_id, fecha desc);
create index if not exists obra_carcelaria_reinsercion_distrito_idx on obra_carcelaria_reinsercion (distrito_id, estado);

-- =========================================================================
-- 8. PERMISOS DE PERFIL Y ACCESO IMPLICITO DEL PASTOR LOCAL
-- =========================================================================

insert into permisos_perfil (perfil_id, permiso)
select p.id, x.permiso from perfiles_acceso p
cross join (values
  ('pastor', 'obra_carcelaria.consultar'), ('pastor', 'obra_carcelaria.editar'), ('pastor', 'obra_carcelaria.registrar'),
  ('estadisticas', 'obra_carcelaria.consultar'), ('estadisticas', 'obra_carcelaria.registrar'),
  ('consulta', 'obra_carcelaria.consultar')
) x(codigo, permiso)
where p.codigo = x.codigo on conflict do nothing;

-- create or replace function reemplaza el cuerpo completo: se repite aqui la
-- lista completa ya vigente (definida por ultima vez en
-- escuela_dominical_damas_dorcas.sql) mas los permisos nuevos de este modulo.
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
        'obra_carcelaria.registrar'
      )
  );
$$;

-- =========================================================================
-- 9. CONSOLIDADO DISTRITAL
-- =========================================================================

drop function if exists resumen_carcelaria_distrital(uuid);
create function resumen_carcelaria_distrital(p_distrito_id uuid)
returns table (
  congregacion_id uuid,
  nombre text,
  ciudad text,
  centros_atendidos bigint,
  internos_activos bigint,
  bautizados bigint,
  sellados bigint,
  delegados_habilitados bigint,
  cultos_ultimo_mes bigint,
  estudios_ultimo_mes bigint
)
language sql stable security invoker set search_path = public as $$
  select
    c.id as congregacion_id,
    c.nombre,
    c.ciudad,
    coalesce((select count(distinct centro_id) from obra_carcelaria_internos i where i.congregacion_id = c.id and i.centro_id is not null), 0),
    coalesce((select count(*) from obra_carcelaria_internos i where i.congregacion_id = c.id and i.estado = 'activo'), 0),
    coalesce((select count(*) from obra_carcelaria_internos i where i.congregacion_id = c.id and i.bautizado), 0),
    coalesce((select count(*) from obra_carcelaria_internos i where i.congregacion_id = c.id and i.sellado), 0),
    coalesce((select count(*) from obra_carcelaria_delegados d where d.congregacion_id = c.id and d.activo and d.permiso_inpec_vigente), 0),
    coalesce((select count(*) from obra_carcelaria_cultos cu where cu.congregacion_id = c.id and cu.fecha >= (current_date - interval '30 days')), 0),
    coalesce((select sum(cu.estudios_biblicos_entregados) from obra_carcelaria_cultos cu where cu.congregacion_id = c.id and cu.fecha >= (current_date - interval '30 days')), 0)
  from congregaciones c
  where c.distrito_id = p_distrito_id
    and c.id in (select mis_congregaciones())
  order by c.nombre;
$$;

revoke all on function resumen_carcelaria_distrital(uuid) from public, anon;
grant execute on function resumen_carcelaria_distrital(uuid) to authenticated;

-- Lista (no agregado) de reinserciones gestionadas por el distrito, para que
-- el coordinador vea el detalle de cada caso. La eficacia (% activos) se
-- calcula en el cliente a partir de esta lista, igual que el resto de
-- insights de la sesion (Damas Dorcas, Escuela Dominical).
drop function if exists resumen_reinsercion_distrital(uuid);
create function resumen_reinsercion_distrital(p_distrito_id uuid)
returns table (
  id uuid,
  interno_id uuid,
  interno_nombre text,
  congregacion_origen text,
  congregacion_destino text,
  fecha_asignacion date,
  estado text
)
language sql stable security invoker set search_path = public as $$
  select
    r.id,
    r.interno_id,
    i.nombres || ' ' || i.apellidos,
    co.nombre,
    cd.nombre,
    r.fecha_asignacion,
    r.estado
  from obra_carcelaria_reinsercion r
  join obra_carcelaria_internos i on i.id = r.interno_id
  join congregaciones co on co.id = r.congregacion_origen_id
  join congregaciones cd on cd.id = r.congregacion_destino_id
  where r.distrito_id = p_distrito_id
  order by r.fecha_asignacion desc;
$$;

revoke all on function resumen_reinsercion_distrital(uuid) from public, anon;
grant execute on function resumen_reinsercion_distrital(uuid) to authenticated;

-- Lista de internos liberados sin una reinsercion activa en curso, para
-- alimentar el formulario "Asignar reinsercion" en Pastoral Distrital.
drop function if exists internos_liberados_sin_asignar(uuid);
create function internos_liberados_sin_asignar(p_distrito_id uuid)
returns table (
  id uuid,
  nombres text,
  apellidos text,
  congregacion_origen text,
  fecha_liberacion date
)
language sql stable security invoker set search_path = public as $$
  select i.id, i.nombres, i.apellidos, c.nombre, i.fecha_liberacion
  from obra_carcelaria_internos i
  join congregaciones c on c.id = i.congregacion_id
  where c.distrito_id = p_distrito_id
    and i.estado = 'liberado'
    and not exists (
      select 1 from obra_carcelaria_reinsercion r
      where r.interno_id = i.id and r.estado not in ('inactivo', 'reincidencia')
    )
  order by i.fecha_liberacion nulls last;
$$;

revoke all on function internos_liberados_sin_asignar(uuid) from public, anon;
grant execute on function internos_liberados_sin_asignar(uuid) to authenticated;
