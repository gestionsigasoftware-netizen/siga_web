-- SIGA - Historial real de negocio (para graficas de crecimiento/MRR
-- en el tiempo, que hoy no existen porque todo se calcula en vivo a
-- partir del estado actual). Una fila por dia, capturada sola via
-- pg_cron -- nadie tiene que acordarse de nada.
--
-- Dominio EXCLUSIVO de super_admin, mismo patron que suscripciones.sql
-- y monitoreo_errores_frontend.sql.

create table if not exists negocio_snapshots_diarios (
  fecha date primary key,
  total_congregaciones integer not null,
  activas integer not null,
  pendientes integer not null,
  suspendidas integer not null,
  al_dia integer not null,
  en_gracia integer not null,
  bloqueadas integer not null,
  sin_configurar integer not null,
  mrr_estimado numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

alter table negocio_snapshots_diarios enable row level security;

drop policy if exists negocio_snapshots_diarios_select on negocio_snapshots_diarios;
create policy negocio_snapshots_diarios_select on negocio_snapshots_diarios
for select to authenticated
using (es_super_admin());

-- Calcula y guarda (o actualiza, si ya se corrio hoy) la foto de hoy.
-- security definer porque quien la llama es el cron interno de
-- Postgres, no un usuario autenticado con sesion -- pero igual queda
-- protegida: si alguna vez se llama desde la app, exige super_admin.
create or replace function capturar_snapshot_negocio()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_activas integer;
  v_pendientes integer;
  v_suspendidas integer;
  v_al_dia integer;
  v_en_gracia integer;
  v_bloqueadas integer;
  v_con_suscripcion integer;
  v_mrr numeric;
begin
  if auth.uid() is not null and not es_super_admin() then
    raise exception 'No tienes permiso para capturar el snapshot de negocio';
  end if;

  select count(*) into v_total from congregaciones;
  select count(*) filter (where estado = 'activa') into v_activas from congregaciones;
  select count(*) filter (where estado = 'pendiente_aprobacion') into v_pendientes from congregaciones;
  select count(*) filter (where estado = 'suspendida') into v_suspendidas from congregaciones;

  select
    count(*) filter (where estado_suscripcion(s.fecha_proximo_pago, s.dias_gracia) = 'activa'),
    count(*) filter (where estado_suscripcion(s.fecha_proximo_pago, s.dias_gracia) = 'en_gracia'),
    count(*) filter (where estado_suscripcion(s.fecha_proximo_pago, s.dias_gracia) = 'bloqueada'),
    count(*),
    coalesce(sum(case when estado_suscripcion(s.fecha_proximo_pago, s.dias_gracia) = 'activa'
      then (case when s.plan = 'anual' then s.monto / 12 else s.monto end) else 0 end), 0)
  into v_al_dia, v_en_gracia, v_bloqueadas, v_con_suscripcion, v_mrr
  from suscripciones s;

  insert into negocio_snapshots_diarios (
    fecha, total_congregaciones, activas, pendientes, suspendidas,
    al_dia, en_gracia, bloqueadas, sin_configurar, mrr_estimado
  ) values (
    current_date, v_total, v_activas, v_pendientes, v_suspendidas,
    v_al_dia, v_en_gracia, v_bloqueadas, greatest(v_total - v_con_suscripcion, 0), v_mrr
  )
  on conflict (fecha) do update set
    total_congregaciones = excluded.total_congregaciones,
    activas = excluded.activas,
    pendientes = excluded.pendientes,
    suspendidas = excluded.suspendidas,
    al_dia = excluded.al_dia,
    en_gracia = excluded.en_gracia,
    bloqueadas = excluded.bloqueadas,
    sin_configurar = excluded.sin_configurar,
    mrr_estimado = excluded.mrr_estimado;
end;
$$;

revoke all on function capturar_snapshot_negocio() from public, anon;
grant execute on function capturar_snapshot_negocio() to authenticated;

-- Si pg_cron no esta habilitado, esta linea falla -- habilitarlo desde
-- el dashboard de Supabase (Database -> Extensions -> pg_cron) y
-- volver a ejecutar solo este bloque.
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule('snapshot-negocio-diario') where exists (
  select 1 from cron.job where jobname = 'snapshot-negocio-diario'
);
select cron.schedule('snapshot-negocio-diario', '5 5 * * *', $$select capturar_snapshot_negocio()$$);
