-- SIGAP - Excluir la congregacion demo del snapshot diario de negocio.
--
-- capturar_snapshot_negocio() (negocio_snapshots_diarios.sql) cuenta
-- congregaciones directo, sin pasar por mis_congregaciones() -- la
-- congregacion demo (estado='activa') se contaria como una
-- congregacion de negocio mas en total_congregaciones/activas, sin
-- tener nunca una fila en suscripciones (eso no cambia: ya estaba
-- correctamente excluida del MRR porque el join es contra
-- suscripciones, no contra congregaciones).

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

  select count(*) into v_total from congregaciones where es_demo = false;
  select count(*) filter (where estado = 'activa') into v_activas from congregaciones where es_demo = false;
  select count(*) filter (where estado = 'pendiente_aprobacion') into v_pendientes from congregaciones where es_demo = false;
  select count(*) filter (where estado = 'suspendida') into v_suspendidas from congregaciones where es_demo = false;

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
