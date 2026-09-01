-- SIGA - Censo de bautizados y sellados con el Espiritu Santo en todos los
-- modulos con ficha individual (intramural y extramural), y bautizado
-- como requisito obligatorio para pertenecer a un comite (con sellado
-- adicional para cargos que lo exijan). A pedido explicito del usuario:
-- bautizado y sellado son hitos INDEPENDIENTES (no secuenciales) y deben
-- medirse en cada censo de la IPUC, no solo en Feligresia.
--
-- Ejecutar despues de feligresia.sql, escuela_dominical_damas_dorcas.sql,
-- mision_juvenil.sql y schema.sql (amigos). Es repetible.

-- =========================================================================
-- 1. CAMPOS DE BAUTIZADO/SELLADO EN LOS CENSOS QUE AUN NO LOS TENIAN
-- =========================================================================
-- personas (Feligresia) y obra_carcelaria_internos ya los tienen.

alter table escuela_dominical_ninos add column if not exists bautizado boolean not null default false;
alter table escuela_dominical_ninos add column if not exists fecha_bautismo date;
alter table escuela_dominical_ninos add column if not exists sellado boolean not null default false;
alter table escuela_dominical_ninos add column if not exists fecha_sellado date;

alter table damas_dorcas_beneficiarias add column if not exists bautizado boolean not null default false;
alter table damas_dorcas_beneficiarias add column if not exists fecha_bautismo date;
alter table damas_dorcas_beneficiarias add column if not exists sellado boolean not null default false;
alter table damas_dorcas_beneficiarias add column if not exists fecha_sellado date;

alter table mision_estudiantes add column if not exists bautizado boolean not null default false;
alter table mision_estudiantes add column if not exists fecha_bautismo date;
alter table mision_estudiantes add column if not exists sellado boolean not null default false;
alter table mision_estudiantes add column if not exists fecha_sellado date;

alter table amigos add column if not exists bautizado boolean not null default false;
alter table amigos add column if not exists fecha_bautismo date;
alter table amigos add column if not exists sellado boolean not null default false;
alter table amigos add column if not exists fecha_sellado date;

-- No hace falta RLS nuevo: estas 4 tablas ya tienen politicas de
-- lectura/escritura por congregacion; los campos nuevos quedan cubiertos.

-- =========================================================================
-- 2. BAUTIZADO OBLIGATORIO PARA COMITES, SELLADO SEGUN EL CARGO
-- =========================================================================
-- El catalogo de cargos es configurable por cada congregacion (no hay una
-- lista fija de nombres a nivel de todo el sistema), asi que el requisito
-- de sellado se marca por cargo desde el propio catalogo del pastor
-- (Configuracion > Cargos de comite), no hardcodeado por nombre en SQL.

alter table cargos_comite add column if not exists requiere_sellado boolean not null default false;

create or replace function validar_requisitos_comite()
returns trigger language plpgsql as $$
declare
  v_bautizado boolean;
  v_sellado boolean;
  v_requiere_sellado boolean;
begin
  select bautizado, sellado_espiritu_santo into v_bautizado, v_sellado
  from personas where id = new.persona_id;

  if v_bautizado is not true then
    raise exception 'Solo personas bautizadas pueden pertenecer a un comité';
  end if;

  if new.cargo_id is not null then
    select requiere_sellado into v_requiere_sellado from cargos_comite where id = new.cargo_id;
    if v_requiere_sellado and v_sellado is not true then
      raise exception 'Este cargo requiere que la persona esté sellada con el Espíritu Santo';
    end if;
  end if;

  return new;
end;
$$;

-- Solo revalida cuando realmente cambia la persona o el cargo asignado —
-- nunca al actualizar fecha_fin/estado/motivo_retiro de una membresia ya
-- existente, para no romper membresias historicas creadas antes de esta
-- regla (o antes de que existiera el catalogo de cargos).
drop trigger if exists membresias_comite_requisitos on membresias_comite;
create trigger membresias_comite_requisitos
before insert or update of persona_id, cargo_id on membresias_comite
for each row execute function validar_requisitos_comite();

-- =========================================================================
-- 3. incorporar_amigo_bautizado(): copiar la fecha real de bautismo y el
--    estado de sellado del amigo, en vez de asumir "bautizado hoy mismo"
-- =========================================================================

create or replace function incorporar_amigo_bautizado(
  p_amigo_id uuid,
  p_nombres text,
  p_apellidos text,
  p_fecha_nacimiento date default null,
  p_estado_civil text default 'soltero',
  p_fecha_ingreso date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  amigo record;
  persona_existente uuid;
begin
  select * into amigo from amigos where id = p_amigo_id for update;
  if amigo.id is null then raise exception 'El amigo no existe'; end if;
  if not puede_administrar_feligresia(amigo.congregacion_id) then raise exception 'No tienes permiso para incorporar personas a la feligresía'; end if;
  if amigo.estado_espiritual <> 'bautizado' then raise exception 'Solo un amigo bautizado puede incorporarse a la feligresía'; end if;
  if amigo.persona_id is not null then return amigo.persona_id; end if;
  if nullif(trim(p_nombres), '') is null or nullif(trim(p_apellidos), '') is null then raise exception 'Nombres y apellidos son obligatorios para incorporar la persona'; end if;
  p_fecha_nacimiento := coalesce(p_fecha_nacimiento, amigo.fecha_nacimiento);
  p_estado_civil := coalesce(p_estado_civil, amigo.estado_civil, 'soltero');
  if p_fecha_nacimiento is null then raise exception 'La fecha de nacimiento es obligatoria para incorporar la persona'; end if;
  if p_estado_civil not in ('soltero', 'casado', 'union_libre', 'divorciado', 'viudo') then raise exception 'El estado civil no es válido'; end if;

  insert into personas (congregacion_id, nombres, apellidos, telefono, fecha_nacimiento, estado_membresia, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ingreso, estado_civil)
  values (amigo.congregacion_id, trim(p_nombres), trim(p_apellidos), amigo.telefono, p_fecha_nacimiento, 'activo', true, coalesce(amigo.fecha_bautismo, current_date), coalesce(amigo.sellado, false), amigo.fecha_sellado, p_fecha_ingreso, p_estado_civil)
  returning id into persona_existente;
  update amigos set persona_id = persona_existente, convertido = true where id = amigo.id;
  return persona_existente;
end;
$$;

revoke all on function incorporar_amigo_bautizado(uuid, text, text, date, text, date) from public, anon;
grant execute on function incorporar_amigo_bautizado(uuid, text, text, date, text, date) to authenticated;
