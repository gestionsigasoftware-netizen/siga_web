-- SIGA - Avisar a super_admin cuando una congregacion queda activa, y
-- arrancarle un periodo de prueba real en vez de quedar "sin
-- configurar" para siempre.
--
-- Encontrado el 2026-09-23 (pregunta real del usuario): el cobro es
-- 100% opt-in manual -- una congregacion sin fila en `suscripciones`
-- nunca se bloquea (diseno intencional, ver suscripciones.sql), pero
-- nada le avisaba a super_admin que una congregacion nueva existia. Si
-- super_admin no entraba a revisar Aprobaciones o Suscripciones por su
-- cuenta, esa congregacion usaba SIGAP gratis para siempre sin que
-- nadie se enterara.
--
-- No existia ningun mecanismo para notificar a un ROL completo (solo a
-- una persona puntual, via crear_notificacion_usuario) ni ningun
-- trigger en el INSERT de congregaciones -- solo el de UPDATE de
-- estado (congregaciones_notificacion_estado, en notificaciones.sql),
-- que solo avisaba a la propia congregacion, nunca a super_admin.
--
-- Esta pieza extiende ESE MISMO trigger existente (create or replace
-- de la misma funcion, notificar_cambio_congregacion -- el trigger ya
-- apunta a este nombre, no hace falta recrearlo) para que, cuando una
-- congregacion pasa a 'activa':
-- 1. Si no tiene fila en `suscripciones` todavia, le crea una con 15
--    dias de prueba -- reutiliza el mecanismo de bloqueo por impago
--    que ya existe y ya funciona (calcularEstadoSuscripcion, el
--    banner "en_gracia" y el bloqueo en MainLayout.jsx), sin inventar
--    nada nuevo de UI.
-- 2. Le avisa a todos los super_admin (nuevo helper
--    notificar_super_admin, mismo patron que la funcion existente
--    pero recorriendo el rol en vez de una congregacion puntual) con
--    enlace a /suscripciones, para que ajuste el plan/monto real
--    cuando se confirme el pago por WhatsApp.
--
-- Ejecutar despues de notificaciones.sql y suscripciones.sql. Es
-- repetible.

create or replace function notificar_super_admin(
  p_titulo text,
  p_mensaje text,
  p_tipo text default 'info',
  p_enlace text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin record;
begin
  for admin in
    select p.auth_user_id
    from roles_sistema r
    join personas p on p.id = r.persona_id
    where r.nivel = 'super_admin' and r.fecha_fin is null and p.auth_user_id is not null
  loop
    perform crear_notificacion_usuario(admin.auth_user_id, p_titulo, p_mensaje, p_tipo, p_enlace);
  end loop;
end;
$$;

revoke execute on function notificar_super_admin(text, text, text, text) from public, authenticated;

create or replace function notificar_cambio_congregacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  estado_label text;
  tipo_aviso text;
  persona record;
begin
  if old.estado is not distinct from new.estado then
    return new;
  end if;

  estado_label := case new.estado
    when 'activa' then 'aprobada'
    when 'suspendida' then 'suspendida'
    else 'actualizada'
  end;
  tipo_aviso := case when new.estado = 'activa' then 'success' when new.estado = 'suspendida' then 'danger' else 'warning' end;

  for persona in
    select auth_user_id
    from personas
    where congregacion_id = new.id and auth_user_id is not null
  loop
    perform crear_notificacion_usuario(
      persona.auth_user_id,
      'Estado de congregación actualizado',
      format('La congregación %s fue %s.', new.nombre, estado_label),
      tipo_aviso,
      '/app'
    );
  end loop;

  if new.estado = 'activa' then
    insert into suscripciones (congregacion_id, plan, fecha_proximo_pago)
    values (new.id, 'mensual', current_date + interval '15 days')
    on conflict (congregacion_id) do nothing;

    perform notificar_super_admin(
      'Nueva congregación activa',
      format('%s (distrito %s) ya está activa y en periodo de prueba de 15 días -- configúrale la suscripción real.',
        new.nombre,
        (select numero::text from distritos where id = new.distrito_id)),
      'info',
      '/suscripciones'
    );
  end if;

  return new;
end;
$$;
