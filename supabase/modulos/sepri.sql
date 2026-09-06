-- SIGA - SEPRI (Seguridad y Prevencion del Riesgo) de la IPUC.
-- Ejecutar despues de schema.sql, accesos.sql, notificaciones.sql y
-- solicitudes_jerarquicas.sql.
--
-- Investigado en fuentes publicas de la IPUC (sitios distritales +
-- "Actualizacion Protocolo SEPRI") porque no hay documentacion interna
-- disponible aqui -- el hallazgo central es que SEPRI NO es un comite
-- con beneficiarios (como Damas Dorcas u Obra Social), es un flujo de
-- aprobacion: la documentacion de seguridad de un evento (sobre todo
-- fuera del templo, donde la iglesia deslinda responsabilidad si no se
-- sigue el protocolo) se debe presentar con un mes de anticipacion a la
-- Secretaria Distrital para su aprobacion. Se modela como dos piezas:
--
-- 1. sepri_solicitudes_evento: la solicitud de aprobacion en si (fecha
--    del evento, dentro/fuera del templo, poliza de seguros, estado).
--    Reutiliza el MISMO patron de flujo local->distrital con
--    notificaciones ya probado en solicitudes_jerarquicas.sql, pero con
--    campos propios en vez de un ticket generico -- para poder medir
--    cosas reales como "cuantas solicitudes llegaron con menos de 30
--    dias de anticipacion", que un texto libre no permite.
-- 2. sepri_delegados: delegado(s) de seguridad por congregacion con
--    vigencia de su certificacion, calcado exactamente del patron ya
--    usado en obra_carcelaria.sql (obra_carcelaria_delegados).

create table if not exists sepri_solicitudes_evento (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  distrito_id uuid not null references distritos(id) on delete cascade,
  nombre_evento text not null,
  fecha_evento date not null,
  ubicacion text not null default 'fuera_templo' check (ubicacion in ('dentro_templo', 'fuera_templo')),
  lugar text,
  asistentes_esperados integer,
  poliza_contratada boolean not null default false,
  responsable_persona_id uuid references personas(id) on delete set null,
  descripcion text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  notas_distrital text,
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  resuelto_en timestamptz
);

create index if not exists sepri_solicitudes_congregacion_idx on sepri_solicitudes_evento (congregacion_id, created_at desc);
create index if not exists sepri_solicitudes_distrito_idx on sepri_solicitudes_evento (distrito_id, estado);

create table if not exists sepri_delegados (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  certificacion_vigente boolean not null default false,
  fecha_vencimiento_certificacion date,
  activo boolean not null default true,
  observaciones text,
  created_at timestamptz not null default now()
);

create index if not exists sepri_delegados_congregacion_idx on sepri_delegados (congregacion_id, activo);

alter table sepri_solicitudes_evento enable row level security;
alter table sepri_delegados enable row level security;

-- Visible por quien la creo, por su propia congregacion, por el
-- distrital de ese distrito, o por nacional/super_admin -- mismo
-- criterio de solicitudes_jerarquicas.sql.
drop policy if exists sepri_solicitudes_select on sepri_solicitudes_evento;
create policy sepri_solicitudes_select on sepri_solicitudes_evento
for select to authenticated
using (
  creado_por = auth.uid()
  or congregacion_id in (select mis_congregaciones())
  or distrito_id in (select mis_distritos())
  or es_nacional() or es_super_admin()
);

-- Solo la propia congregacion puede solicitar sobre si misma, y solo
-- para su propio distrito (no se puede solicitar "en nombre de" otra
-- congregacion).
drop policy if exists sepri_solicitudes_insert on sepri_solicitudes_evento;
create policy sepri_solicitudes_insert on sepri_solicitudes_evento
for insert to authenticated
with check (
  creado_por = auth.uid()
  and congregacion_id in (select mis_congregaciones())
  and distrito_id = (select distrito_id from congregaciones where id = congregacion_id)
);

-- Quien la creo puede editarla mientras siga pendiente (corregir datos
-- antes de que el distrital decida); el distrital de ese distrito (o
-- nacional/super_admin) puede aprobar/rechazar en cualquier momento.
drop policy if exists sepri_solicitudes_update on sepri_solicitudes_evento;
create policy sepri_solicitudes_update on sepri_solicitudes_evento
for update to authenticated
using (
  (creado_por = auth.uid() and estado = 'pendiente')
  or distrito_id in (select mis_distritos())
  or es_nacional() or es_super_admin()
)
with check (true);

drop policy if exists sepri_delegados_read on sepri_delegados;
create policy sepri_delegados_read on sepri_delegados for select to authenticated
using (
  (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'sepri.consultar'))
  or es_super_admin() or es_nacional()
  or exists (select 1 from congregaciones c where c.id = congregacion_id and c.distrito_id in (select mis_distritos()))
);
drop policy if exists sepri_delegados_write on sepri_delegados;
create policy sepri_delegados_write on sepri_delegados for all to authenticated
using (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'sepri.editar'))
with check (congregacion_id in (select mis_congregaciones()) and tiene_permiso(congregacion_id, 'sepri.editar'));

-- Notificaciones -- mismo mecanismo que solicitudes_jerarquicas.sql:
-- avisa al distrital cuando llega una solicitud nueva, y avisa de vuelta
-- a la congregacion cuando el distrital decide.
create or replace function notificar_sepri_solicitud_nueva()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  destinatario record;
begin
  for destinatario in select persona_id from roles_sistema where nivel = 'distrital' and distrito_id = new.distrito_id and fecha_fin is null
  loop
    perform crear_notificacion_usuario((select auth_user_id from personas where id = destinatario.persona_id), 'Nueva solicitud SEPRI', format('%s solicita aprobacion para "%s" (%s)', (select nombre from congregaciones where id = new.congregacion_id), new.nombre_evento, to_char(new.fecha_evento, 'DD/MM/YYYY')), 'info', '/sepri');
  end loop;
  return new;
end;
$$;

drop trigger if exists sepri_solicitud_notificacion on sepri_solicitudes_evento;
create trigger sepri_solicitud_notificacion
after insert on sepri_solicitudes_evento
for each row execute function notificar_sepri_solicitud_nueva();

create or replace function notificar_sepri_solicitud_resuelta()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  destinatario record;
begin
  if old.estado = 'pendiente' and new.estado <> 'pendiente' then
    new.resuelto_en := now();
    for destinatario in select persona_id from roles_sistema where nivel = 'local' and congregacion_id = new.congregacion_id and fecha_fin is null
    loop
      perform crear_notificacion_usuario((select auth_user_id from personas where id = destinatario.persona_id), 'Solicitud SEPRI resuelta', format('"%s" fue %s', new.nombre_evento, case new.estado when 'aprobado' then 'aprobada' else 'rechazada' end), case new.estado when 'aprobado' then 'success' else 'warning' end, '/sepri');
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists sepri_solicitud_resuelta_notificacion on sepri_solicitudes_evento;
create trigger sepri_solicitud_resuelta_notificacion
before update on sepri_solicitudes_evento
for each row execute function notificar_sepri_solicitud_resuelta();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sepri_solicitudes_evento'
  ) then
    alter publication supabase_realtime add table sepri_solicitudes_evento;
  end if;
end $$;

-- =========================================================================
-- Permisos -- agrega sepri.* a la lista acumulada de permisos que ya
-- tiene un pastor local automaticamente. IMPORTANTE para quien agregue
-- el siguiente modulo: este "create or replace" reemplaza la funcion
-- completa, asi que su lista debe incluir TODO lo acumulado hasta ahora
-- (tomado de conquistadores_obra_social.sql, la version mas completa al
-- momento de escribir esto) mas lo nuevo -- nunca solo lo nuevo.
-- =========================================================================
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
        'obra_social.consultar', 'obra_social.editar', 'obra_social.registrar',
        'sepri.consultar', 'sepri.editar', 'sepri.registrar'
      )
  );
$$;

-- =========================================================================
-- Consolidado distrital: solicitudes pendientes y cumplimiento del plazo
-- de 30 dias, por congregacion del distrito.
-- =========================================================================
drop function if exists resumen_sepri_distrital(uuid);
create function resumen_sepri_distrital(p_distrito_id uuid)
returns table (
  congregacion_id uuid,
  congregacion_nombre text,
  solicitudes_pendientes bigint,
  solicitudes_aprobadas_12m bigint,
  solicitudes_a_tiempo_12m bigint,
  delegados_activos bigint
)
language sql stable security invoker as $$
  select
    c.id,
    c.nombre,
    coalesce((select count(*) from sepri_solicitudes_evento s where s.congregacion_id = c.id and s.estado = 'pendiente'), 0),
    coalesce((select count(*) from sepri_solicitudes_evento s where s.congregacion_id = c.id and s.estado = 'aprobado' and s.created_at >= now() - interval '12 months'), 0),
    coalesce((select count(*) from sepri_solicitudes_evento s where s.congregacion_id = c.id and s.created_at >= now() - interval '12 months' and (s.fecha_evento - s.created_at::date) >= 30), 0),
    coalesce((select count(*) from sepri_delegados d where d.congregacion_id = c.id and d.activo), 0)
  from congregaciones c
  where c.distrito_id = p_distrito_id
    and c.id in (select mis_congregaciones())
  order by c.nombre;
$$;

revoke all on function resumen_sepri_distrital(uuid) from public, anon;
grant execute on function resumen_sepri_distrital(uuid) to authenticated;
