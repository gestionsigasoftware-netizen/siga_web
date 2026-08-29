-- SIGA - Configuracion del modulo Evangelismo.
-- Ejecutar despues de schema.sql, accesos.sql y feligresia.sql.
-- La PWA es la fuente de asistencia: registros_actividad + zonas + tipos_actividad.
-- La web administra catalogos y consulta los datos para toma de decisiones.

-- Crea el modulo por congregacion sin duplicar la captura de la PWA.
do $$
declare
  v_modulo_id uuid;
  v_congregacion record;
  v_metodo text;
begin
  for v_congregacion in select id from congregaciones loop
    select id into v_modulo_id from modulos where congregacion_id = v_congregacion.id and lower(nombre_modulo) = 'evangelismo' limit 1;
    if v_modulo_id is null then
      insert into modulos (congregacion_id, nombre_modulo, alcance, requiere_zona)
      values (v_congregacion.id, 'Evangelismo', 'extramural', true)
      returning id into v_modulo_id;
    else
      update modulos set alcance = 'extramural', requiere_zona = true where id = v_modulo_id;
    end if;
    foreach v_metodo in array array['REFAM', 'Culto de barrio', 'Culto relampago', 'Celula', 'Discipulado', 'Visita'] loop
      insert into tipos_actividad (modulo_id, nombre, caracter)
      select v_modulo_id, v_metodo, 'Evangelismo'
      where not exists (select 1 from tipos_actividad where modulo_id = v_modulo_id and lower(nombre) = lower(v_metodo));
    end loop;
  end loop;
end $$;

-- Vincula el seguimiento individual de Amigos a la zona y metodología de la PWA.
alter table zonas add column if not exists lider_persona_id uuid references personas(id) on delete set null;
alter table amigos add column if not exists evangelismo_metodologia_id uuid references tipos_actividad(id) on delete set null;

create or replace function impedir_reversion_amigo_incorporado()
returns trigger language plpgsql as $$
begin
  if new.persona_id is not null and (new.estado_espiritual <> 'bautizado' or not new.convertido) then
    raise exception 'Solo un amigo bautizado puede incorporarse a Feligresía';
  end if;
  if old.persona_id is not null and (new.persona_id is distinct from old.persona_id or new.estado_espiritual <> 'bautizado' or not new.convertido) then
    raise exception 'Una persona incorporada a Feligresía no puede volver a estado en ruta';
  end if;
  return new;
end;
$$;

drop trigger if exists amigos_no_reversion_incorporado on amigos;
create trigger amigos_no_reversion_incorporado before update on amigos
for each row execute function impedir_reversion_amigo_incorporado();

create table if not exists historial_amigos (
  id uuid primary key default gen_random_uuid(),
  amigo_id uuid not null references amigos(id) on delete cascade,
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  etapa_anterior_id uuid references etapas_seguimiento(id) on delete set null,
  etapa_nueva_id uuid references etapas_seguimiento(id) on delete set null,
  observacion text,
  usuario_id uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now()
);

create or replace function registrar_cambio_etapa_amigo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id then
    insert into historial_amigos (amigo_id, congregacion_id, etapa_anterior_id, etapa_nueva_id)
    values (new.id, new.congregacion_id, case when tg_op = 'INSERT' then null else old.etapa_id end, new.etapa_id);
  end if;
  return new;
end;
$$;

drop trigger if exists amigos_historial_etapa on amigos;
create trigger amigos_historial_etapa after insert or update of etapa_id on amigos
for each row execute function registrar_cambio_etapa_amigo();

alter table historial_amigos enable row level security;
drop policy if exists historial_amigos_read on historial_amigos;
drop policy if exists historial_amigos_write on historial_amigos;
create policy historial_amigos_read on historial_amigos for select to authenticated
using (congregacion_id in (select mis_congregaciones()));
create policy historial_amigos_write on historial_amigos for insert to authenticated
with check (congregacion_id in (select mis_congregaciones()));

create index if not exists amigos_evangelismo_analisis_idx on amigos (congregacion_id, zona_id, convertido, evangelismo_metodologia_id);
create index if not exists historial_amigos_amigo_fecha_idx on historial_amigos (amigo_id, creado_en desc);
create index if not exists registros_evangelismo_analisis_idx on registros_actividad (congregacion_id, modulo_id, zona_id, tipo_actividad_id, fecha desc);

comment on table registros_actividad is 'Fuente oficial de asistencia de PWA para Ujieres y Evangelismo; desglose contiene las categorias demograficas.';
comment on column amigos.zona_id is 'Zona/barrio/vereda de Evangelismo donde se hace el seguimiento.';

insert into permisos_perfil (perfil_id, permiso)
select p.id, x.permiso
from perfiles_acceso p
cross join (values
  ('pastor', 'evangelismo.consultar'), ('pastor', 'evangelismo.editar'), ('pastor', 'evangelismo.registrar'),
  ('estadisticas', 'evangelismo.consultar'), ('estadisticas', 'evangelismo.registrar'),
  ('consulta', 'evangelismo.consultar')
) as x(codigo, permiso)
where p.codigo = x.codigo
on conflict do nothing;
