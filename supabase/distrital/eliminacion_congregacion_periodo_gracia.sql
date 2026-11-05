-- SIGAP - Politica de eliminacion de congregaciones con periodo de
-- gracia (~30 dias), nunca instantanea.
--
-- Contexto: borrar una congregacion real a mano por SQL (como se hizo
-- con la congregacion de prueba "AGUA BONITA SUAREZ CAUCA") es
-- delicado -- 17 tablas preservadas con relacion RESTRICT hacia
-- `congregaciones`, sin backups configurados todavia. El usuario pidio
-- una politica formal: solicitar eliminacion, 30 dias de gracia con la
-- congregacion bloqueada pero sus datos intactos y la solicitud
-- cancelable, y solo al vencer el plazo se borra de verdad -- mismo
-- patron que "eliminar cuenta" en software serio.
--
-- Reutiliza el bloqueo por estado que ya existe (fix_bloqueo_congregacion_pendiente.sql
-- exige estado = 'activa' para el acceso operativo local) en vez de
-- agregar un 4to valor a `estado`, que habria tocado Dashboard.jsx,
-- capturar_snapshot_negocio(), MainLayout.jsx y GlobalSearch.jsx sin
-- necesidad real.
--
-- Ejecutar despues de schema.sql, accesos.sql, pastoral_distrital.sql
-- y notificaciones.sql.

-- -----------------------------------------------------------------------------
-- 1. Columnas nuevas en congregaciones
-- -----------------------------------------------------------------------------

alter table congregaciones add column if not exists eliminacion_solicitada_en timestamptz;
alter table congregaciones add column if not exists eliminacion_programada_para timestamptz;
alter table congregaciones add column if not exists eliminacion_solicitada_por uuid references auth.users(id);
alter table congregaciones add column if not exists eliminacion_motivo text;
alter table congregaciones add column if not exists estado_antes_eliminacion text;
alter table congregaciones add column if not exists eliminacion_recordatorio_enviado boolean not null default false;

-- -----------------------------------------------------------------------------
-- 2. Historial de auditoria -- sobrevive aunque la congregacion se
--    borre de verdad (por eso congregacion_id es un uuid plano, SIN
--    foreign key a congregaciones).
-- -----------------------------------------------------------------------------

create table if not exists congregaciones_eliminadas_historial (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null,
  congregacion_nombre text not null,
  distrito_numero integer,
  solicitada_en timestamptz not null default now(),
  solicitada_por uuid references auth.users(id) on delete set null,
  solicitada_por_nombre text,
  motivo text,
  programada_para timestamptz not null,
  cancelada_en timestamptz,
  cancelada_por uuid references auth.users(id) on delete set null,
  ejecutada_en timestamptz,
  cuentas_auth_huerfanas text,
  created_at timestamptz not null default now()
);

create index if not exists congregaciones_eliminadas_historial_congregacion_idx
  on congregaciones_eliminadas_historial (congregacion_id);

alter table congregaciones_eliminadas_historial enable row level security;

drop policy if exists congregaciones_eliminadas_historial_select on congregaciones_eliminadas_historial;
create policy congregaciones_eliminadas_historial_select on congregaciones_eliminadas_historial
for select to authenticated
using (es_super_admin());

-- -----------------------------------------------------------------------------
-- 3. Solicitar eliminacion -- mismo patron de permisos que
--    anular_congregacion(): distrital dueno del distrito, o
--    super_admin.
-- -----------------------------------------------------------------------------

create or replace function solicitar_eliminacion_congregacion(
  p_congregacion_id uuid,
  p_motivo text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_congregacion congregaciones%rowtype;
  v_solicitante_nombre text;
  v_persona_local record;
begin
  select * into v_congregacion from congregaciones where id = p_congregacion_id;
  if v_congregacion.id is null then
    raise exception 'Congregación no encontrada';
  end if;

  if not (
    v_congregacion.distrito_id in (select mis_distritos())
    or es_super_admin()
  ) then
    raise exception 'No tienes permisos sobre esta congregación';
  end if;

  if v_congregacion.estado not in ('activa', 'suspendida') then
    raise exception 'Solo se puede solicitar la eliminación de una congregación activa o suspendida (estado actual: %). Si todavía no fue aprobada, usa "Anular" en su lugar.', v_congregacion.estado;
  end if;

  if v_congregacion.eliminacion_programada_para is not null then
    raise exception 'Esta congregación ya tiene una eliminación programada.';
  end if;

  select coalesce(p.nombres || ' ' || p.apellidos, u.email) into v_solicitante_nombre
  from auth.users u
  left join personas p on p.auth_user_id = u.id
  where u.id = auth.uid();

  update congregaciones set
    estado_antes_eliminacion = v_congregacion.estado,
    estado = 'suspendida',
    eliminacion_solicitada_en = now(),
    eliminacion_programada_para = now() + interval '30 days',
    eliminacion_solicitada_por = auth.uid(),
    eliminacion_motivo = p_motivo,
    eliminacion_recordatorio_enviado = false
  where id = p_congregacion_id;

  insert into congregaciones_eliminadas_historial (
    congregacion_id, congregacion_nombre, distrito_numero,
    solicitada_por, solicitada_por_nombre, motivo, programada_para
  )
  select
    v_congregacion.id, v_congregacion.nombre, d.numero,
    auth.uid(), v_solicitante_nombre, p_motivo, now() + interval '30 days'
  from distritos d where d.id = v_congregacion.distrito_id;

  -- Avisar a cada pastor/líder local activo de esa congregación.
  for v_persona_local in
    select p.auth_user_id from roles_sistema r
    join personas p on p.id = r.persona_id
    where r.congregacion_id = p_congregacion_id and r.nivel = 'local' and r.fecha_fin is null
      and p.auth_user_id is not null
  loop
    perform crear_notificacion_usuario(
      v_persona_local.auth_user_id,
      'Eliminación de tu congregación programada',
      'Se solicitó la eliminación de "' || v_congregacion.nombre || '". Tu acceso operativo queda bloqueado mientras tanto. Si esto es un error, contacta a tu líder distrital o a soporte antes de que se cumpla el plazo.',
      'danger',
      '/perfil'
    );
  end loop;
end;
$$;

revoke all on function solicitar_eliminacion_congregacion(uuid, text) from public, anon;
grant execute on function solicitar_eliminacion_congregacion(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Cancelar una eliminacion programada -- mismos permisos.
-- -----------------------------------------------------------------------------

create or replace function cancelar_eliminacion_congregacion(p_congregacion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_congregacion congregaciones%rowtype;
  v_persona_local record;
begin
  select * into v_congregacion from congregaciones where id = p_congregacion_id;
  if v_congregacion.id is null then
    raise exception 'Congregación no encontrada';
  end if;

  if not (
    v_congregacion.distrito_id in (select mis_distritos())
    or es_super_admin()
  ) then
    raise exception 'No tienes permisos sobre esta congregación';
  end if;

  if v_congregacion.eliminacion_programada_para is null then
    raise exception 'Esta congregación no tiene ninguna eliminación programada.';
  end if;

  update congregaciones set
    estado = coalesce(v_congregacion.estado_antes_eliminacion, 'activa'),
    estado_antes_eliminacion = null,
    eliminacion_solicitada_en = null,
    eliminacion_programada_para = null,
    eliminacion_solicitada_por = null,
    eliminacion_motivo = null,
    eliminacion_recordatorio_enviado = false
  where id = p_congregacion_id;

  update congregaciones_eliminadas_historial
  set cancelada_en = now(), cancelada_por = auth.uid()
  where congregacion_id = p_congregacion_id and ejecutada_en is null and cancelada_en is null;

  for v_persona_local in
    select p.auth_user_id from roles_sistema r
    join personas p on p.id = r.persona_id
    where r.congregacion_id = p_congregacion_id and r.nivel = 'local' and r.fecha_fin is null
      and p.auth_user_id is not null
  loop
    perform crear_notificacion_usuario(
      v_persona_local.auth_user_id,
      'Eliminación cancelada',
      'La eliminación programada de "' || v_congregacion.nombre || '" fue cancelada. Tu acceso vuelve a la normalidad.',
      'success',
      '/perfil'
    );
  end loop;
end;
$$;

revoke all on function cancelar_eliminacion_congregacion(uuid) from public, anon;
grant execute on function cancelar_eliminacion_congregacion(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Ejecucion definitiva -- SOLO la llama el cron interno (sin
--    sesion). Si alguna vez se llama desde la app, exige super_admin
--    -- mismo guard que capturar_snapshot_negocio().
--    Generaliza el script manual que se uso para "AGUA BONITA SUAREZ
--    CAUCA": antes de borrar, guarda que cuentas de login quedan
--    huerfanas para que el super_admin las limpie a mano en
--    Authentication (igual que paso con andresanchezw916@gmail.com).
-- -----------------------------------------------------------------------------

create or replace function eliminar_congregacion_definitivo(p_congregacion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_congregacion congregaciones%rowtype;
  v_huerfanas text;
begin
  if auth.uid() is not null and not es_super_admin() then
    raise exception 'No tienes permiso para ejecutar una eliminación definitiva';
  end if;

  select * into v_congregacion from congregaciones where id = p_congregacion_id;
  if v_congregacion.id is null then
    raise exception 'Congregación no encontrada';
  end if;

  if v_congregacion.eliminacion_programada_para is null or v_congregacion.eliminacion_programada_para > now() then
    raise exception 'Esta congregación no tiene una eliminación vencida para ejecutar.';
  end if;

  -- Cuentas de login que quedaran sin congregacion -- se registran
  -- antes de borrar nada, para revision manual en Authentication.
  select string_agg(u.email, ', ') into v_huerfanas
  from personas p join auth.users u on u.id = p.auth_user_id
  where p.congregacion_id = p_congregacion_id and p.auth_user_id is not null;

  -- Mismo orden que el script manual de Agua Bonita.
  delete from pastores where id in (
    select pastor_id from asignaciones_pastorales where congregacion_id = p_congregacion_id
  );
  delete from roles_sistema where congregacion_id = p_congregacion_id;
  delete from personas where congregacion_id = p_congregacion_id;
  delete from modulos where congregacion_id = p_congregacion_id;
  delete from categorias_demograficas where congregacion_id = p_congregacion_id;
  update catalogo_congregaciones_ipuc set congregacion_id = null where congregacion_id = p_congregacion_id;
  delete from congregaciones where id = p_congregacion_id;

  update congregaciones_eliminadas_historial
  set ejecutada_en = now(), cuentas_auth_huerfanas = v_huerfanas
  where congregacion_id = p_congregacion_id and ejecutada_en is null and cancelada_en is null;
end;
$$;

revoke all on function eliminar_congregacion_definitivo(uuid) from public, anon;
grant execute on function eliminar_congregacion_definitivo(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Recordatorio a 6-7 dias del plazo -- una sola vez por congregacion.
-- -----------------------------------------------------------------------------

create or replace function enviar_recordatorios_eliminacion_congregacion()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_congregacion record;
  v_persona_local record;
  v_dias_restantes integer;
begin
  if auth.uid() is not null and not es_super_admin() then
    raise exception 'No tienes permiso para esta operación';
  end if;

  for v_congregacion in
    select * from congregaciones
    where eliminacion_programada_para is not null
      and eliminacion_recordatorio_enviado = false
      and eliminacion_programada_para <= now() + interval '7 days'
      and eliminacion_programada_para > now() + interval '6 days'
  loop
    v_dias_restantes := ceil(extract(epoch from (v_congregacion.eliminacion_programada_para - now())) / 86400);
    for v_persona_local in
      select p.auth_user_id from roles_sistema r
      join personas p on p.id = r.persona_id
      where r.congregacion_id = v_congregacion.id and r.nivel = 'local' and r.fecha_fin is null
        and p.auth_user_id is not null
    loop
      perform crear_notificacion_usuario(
        v_persona_local.auth_user_id,
        'Quedan pocos días',
        'Tu congregación "' || v_congregacion.nombre || '" se eliminará en aproximadamente ' || v_dias_restantes || ' días si nadie cancela la solicitud.',
        'warning',
        '/perfil'
      );
    end loop;
    update congregaciones set eliminacion_recordatorio_enviado = true where id = v_congregacion.id;
  end loop;
end;
$$;

revoke all on function enviar_recordatorios_eliminacion_congregacion() from public, anon;
grant execute on function enviar_recordatorios_eliminacion_congregacion() to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Job diario -- mismo patron que negocio_snapshots_diarios.sql.
-- -----------------------------------------------------------------------------

create or replace function procesar_eliminaciones_congregaciones()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_congregacion_id uuid;
begin
  perform enviar_recordatorios_eliminacion_congregacion();

  for v_congregacion_id in
    select id from congregaciones
    where eliminacion_programada_para is not null and eliminacion_programada_para <= now()
  loop
    perform eliminar_congregacion_definitivo(v_congregacion_id);
  end loop;
end;
$$;

revoke all on function procesar_eliminaciones_congregaciones() from public, anon;

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule('procesar-eliminaciones-congregaciones') where exists (
  select 1 from cron.job where jobname = 'procesar-eliminaciones-congregaciones'
);
select cron.schedule('procesar-eliminaciones-congregaciones', '15 5 * * *', $$select procesar_eliminaciones_congregaciones()$$);
