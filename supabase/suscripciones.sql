-- SIGA - Cobro por congregacion (planes de pago). El usuario aun no
-- tiene la conversacion comercial con la IPUC, asi que esto se disena
-- para operar con cobro manual (Nequi, cuenta bancaria) desde el primer
-- dia, sin depender de integrar una pasarela de pagos todavia -- aunque
-- el diseño (estados de suscripcion, RPC de pago) ya queda listo para
-- que el dia que haya pasarela, solo cambie QUIEN llama a
-- registrar_pago_suscripcion (un webhook en vez de un admin manual).
--
-- Este es un dominio EXCLUSIVO de super_admin, no de nacional -- nacional
-- es un rol pastoral de la IPUC (cliente), super_admin es quien
-- administra el negocio SIGAP. Nacional no configura ni desbloquea
-- suscripciones.
--
-- Diseño clave: una congregacion SIN fila en esta tabla no esta
-- bloqueada -- el bloqueo solo aplica a quien super_admin decida
-- empezar a facturar explicitamente. Esto evita bloquear de sorpresa a
-- las congregaciones que ya usan SIGAP hoy cuando se active esta
-- funcion.
--
-- El estado (activa/en_gracia/bloqueada) NUNCA se guarda -- se calcula
-- siempre a partir de fecha_proximo_pago + dias_gracia comparado con
-- hoy, para que nunca quede desactualizado (no hay un job programado
-- que lo actualice).

create table if not exists suscripciones (
  id uuid primary key default gen_random_uuid(),
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  plan text not null default 'mensual' check (plan in ('mensual', 'anual')),
  monto numeric(12, 2),
  fecha_inicio date not null default current_date,
  fecha_proximo_pago date not null,
  dias_gracia integer not null default 5,
  ultimo_pago_en timestamptz,
  ultimo_pago_metodo text,
  ultimo_pago_registrado_por uuid references auth.users(id),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (congregacion_id)
);

create or replace function estado_suscripcion(p_fecha_proximo_pago date, p_dias_gracia integer)
returns text language sql immutable as $$
  select case
    when current_date <= p_fecha_proximo_pago then 'activa'
    when current_date <= (p_fecha_proximo_pago + p_dias_gracia) then 'en_gracia'
    else 'bloqueada'
  end;
$$;

alter table suscripciones enable row level security;

-- Cualquiera ve el estado de su propia congregacion (para saber si debe
-- pagar); solo super_admin ve y administra todas.
drop policy if exists suscripciones_select on suscripciones;
create policy suscripciones_select on suscripciones
for select to authenticated
using (congregacion_id in (select mis_congregaciones()) or es_super_admin());

drop policy if exists suscripciones_insert on suscripciones;
create policy suscripciones_insert on suscripciones
for insert to authenticated
with check (es_super_admin());

drop policy if exists suscripciones_update on suscripciones;
create policy suscripciones_update on suscripciones
for update to authenticated
using (es_super_admin())
with check (es_super_admin());

-- Registrar un pago: mueve fecha_proximo_pago un mes o un año hacia
-- adelante segun el plan (desde la fecha de pago mas cercana entre hoy
-- y la fecha que ya tenia, para no "perder" tiempo ya pagado si se
-- registra antes de tiempo). Exclusivo de super_admin -- es quien
-- desbloquea una congregacion vencida.
create or replace function registrar_pago_suscripcion(
  p_congregacion_id uuid,
  p_metodo text default null,
  p_notas text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_base date;
begin
  if not es_super_admin() then
    raise exception 'No tienes permiso para registrar pagos';
  end if;

  select plan, greatest(fecha_proximo_pago, current_date) into v_plan, v_base
  from suscripciones where congregacion_id = p_congregacion_id;

  if v_plan is null then
    raise exception 'Esta congregacion no tiene una suscripcion configurada';
  end if;

  update suscripciones
  set fecha_proximo_pago = case when v_plan = 'anual' then v_base + interval '1 year' else v_base + interval '1 month' end,
      ultimo_pago_en = now(),
      ultimo_pago_metodo = p_metodo,
      ultimo_pago_registrado_por = auth.uid(),
      notas = coalesce(p_notas, notas),
      updated_at = now()
  where congregacion_id = p_congregacion_id;
end;
$$;

revoke all on function registrar_pago_suscripcion(uuid, text, text) from public, anon;
grant execute on function registrar_pago_suscripcion(uuid, text, text) to authenticated;

-- Metodo de pago manual (Nequi / cuenta bancaria) que se le muestra a
-- una congregacion cuando le toca pagar. Una sola fila (singleton) --
-- por ahora es un unico metodo de pago para todo SIGAP, no uno por
-- congregacion. Cualquiera autenticado puede verlo (lo necesita para
-- saber donde pagar); solo super_admin lo edita.
create table if not exists metodos_pago_sigap (
  id boolean primary key default true check (id),
  nequi_numero text,
  nequi_titular text,
  banco_nombre text,
  banco_numero text,
  banco_titular text,
  notas text,
  updated_at timestamptz not null default now()
);

insert into metodos_pago_sigap (id) values (true) on conflict (id) do nothing;

alter table metodos_pago_sigap enable row level security;

drop policy if exists metodos_pago_sigap_select on metodos_pago_sigap;
create policy metodos_pago_sigap_select on metodos_pago_sigap
for select to authenticated using (true);

drop policy if exists metodos_pago_sigap_update on metodos_pago_sigap;
create policy metodos_pago_sigap_update on metodos_pago_sigap
for update to authenticated
using (es_super_admin())
with check (es_super_admin());
