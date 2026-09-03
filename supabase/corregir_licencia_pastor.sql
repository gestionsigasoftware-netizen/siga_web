-- SIGA - Corregir la licencia ministerial de un pastor directamente
-- (ej. se capturo mal desde el inicio), distinto de
-- ascender_licencia_pastor (licencias_pastorales.sql) que SOLO avanza
-- un nivel a la vez y nunca retrocede -- esa regla de negocio se
-- mantiene intacta para los ascensos reales. Esta funcion es una via
-- aparte, exclusivamente para corregir errores de captura, y deja
-- constancia en el mismo historial pero marcada como 'correccion' para
-- no mezclarse con los ascensos reales.
--
-- Ejecutar despues de licencias_pastorales.sql.

alter table historial_licencias_pastorales add column if not exists tipo text not null default 'ascenso' check (tipo in ('ascenso', 'correccion'));

create or replace function corregir_licencia_pastor(
  p_pastor_id uuid,
  p_licencia text,
  p_observaciones text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_distrito_id uuid;
  v_licencia_actual text;
begin
  select distrito_id, licencia into v_distrito_id, v_licencia_actual from pastores where id = p_pastor_id;
  if v_distrito_id is null or not es_lider_distrital(v_distrito_id) then
    raise exception 'No tienes permisos sobre este pastor';
  end if;
  if p_licencia not in ('obrero', 'local', 'general', 'ordenacion') then
    raise exception 'Licencia no valida';
  end if;
  if p_licencia = v_licencia_actual then
    return;
  end if;

  update pastores set licencia = p_licencia where id = p_pastor_id;

  insert into historial_licencias_pastorales (pastor_id, licencia_anterior, licencia_nueva, observaciones, otorgado_por, tipo)
  values (p_pastor_id, v_licencia_actual, p_licencia, coalesce(nullif(trim(p_observaciones), ''), 'Corrección manual'), auth.uid(), 'correccion');
end;
$$;

revoke all on function corregir_licencia_pastor(uuid, text, text) from public, anon;
grant execute on function corregir_licencia_pastor(uuid, text, text) to authenticated;
