-- SIGA - Licencias ministeriales de la IPUC (escalafon pastoral).
-- Orden estrictamente secuencial: obrero -> local -> general -> ordenacion.
-- Ejecutar despues de pastoral_distrital.sql y gestion_pastoral_distrital_v2.sql.
-- Es repetible.

alter table pastores add column if not exists licencia text not null default 'obrero'
  check (licencia in ('obrero', 'local', 'general', 'ordenacion'));

create table if not exists historial_licencias_pastorales (
  id uuid primary key default gen_random_uuid(),
  pastor_id uuid not null references pastores(id) on delete cascade,
  licencia_anterior text not null,
  licencia_nueva text not null,
  fecha date not null default current_date,
  observaciones text,
  otorgado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table historial_licencias_pastorales enable row level security;

drop policy if exists historial_licencias_distrital_read on historial_licencias_pastorales;
create policy historial_licencias_distrital_read on historial_licencias_pastorales for select to authenticated
using (exists (select 1 from pastores p where p.id = historial_licencias_pastorales.pastor_id and es_lider_distrital(p.distrito_id)));

-- Avanza al pastor exactamente un nivel (nunca salta niveles ni retrocede).
create or replace function ascender_licencia_pastor(
  p_pastor_id uuid,
  p_fecha date default current_date,
  p_observaciones text default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_distrito_id uuid;
  v_licencia_actual text;
  v_licencia_nueva text;
begin
  select distrito_id, licencia into v_distrito_id, v_licencia_actual from pastores where id = p_pastor_id;
  if v_distrito_id is null or not es_lider_distrital(v_distrito_id) then
    raise exception 'No tienes permisos sobre este pastor';
  end if;

  v_licencia_nueva := case v_licencia_actual
    when 'obrero' then 'local'
    when 'local' then 'general'
    when 'general' then 'ordenacion'
    else null
  end;

  if v_licencia_nueva is null then
    raise exception 'El pastor ya tiene el grado maximo (Ordenación Ministerial)';
  end if;

  update pastores set licencia = v_licencia_nueva where id = p_pastor_id;

  insert into historial_licencias_pastorales (pastor_id, licencia_anterior, licencia_nueva, fecha, observaciones, otorgado_por)
  values (p_pastor_id, v_licencia_actual, v_licencia_nueva, coalesce(p_fecha, current_date), p_observaciones, auth.uid());

  return v_licencia_nueva;
end;
$$;

revoke all on function ascender_licencia_pastor(uuid, date, text) from public, anon;
grant execute on function ascender_licencia_pastor(uuid, date, text) to authenticated;
