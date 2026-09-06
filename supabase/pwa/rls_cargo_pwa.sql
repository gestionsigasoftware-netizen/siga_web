-- SIGA - Habilita el acceso REAL (no solo visual) para personas invitadas
-- UNICAMENTE con un cargo operativo (asignaciones_cargo), sin rol de
-- sistema (roles_sistema) ni perfil de acceso web (perfiles_acceso) -- que
-- es exactamente el perfil de la mayoria de "Capturador PWA" reales
-- (ujieres, evangelistas, delegados de Obra Carcelaria sin acceso a la
-- web). Y de paso cierra el hueco de seguridad reportado: alguien con
-- cargo SOLO en un modulo no debe poder escribir en otro.
--
-- HALLAZGO (confirmado leyendo las policies existentes, no una suposicion):
-- invitar-usuario SIEMPRE crea una fila en roles_sistema (nivel 'local')
-- al invitar a alguien, incluso si solo se le asigna un cargo -- con
-- rol_local 'solo_lectura' cuando no se eligio un perfil de acceso web.
-- Eso le basta para leer el catalogo (zonas, categorias, tipos de
-- actividad, su propia asignacion) via mis_congregaciones(), PERO el
-- INSERT real de registros_actividad (asistencia_web.sql, policy
-- registros_write_scope) exige ADEMAS tiene_permiso(...,
-- 'estadisticas.registrar' o 'feligresia.editar') -- y tiene_permiso()
-- solo concede eso automaticamente cuando rol_local = 'pastor'. Un
-- capturador invitado solo con cargo (rol_local = 'solo_lectura') nunca
-- cumple esa condicion: hoy NO PUEDE escribir un solo registro de
-- asistencia, sin importar que la PWA le muestre el formulario -- el
-- mecanismo de cargos nunca funciono de verdad para su publico real. Lo
-- mismo aplica a obra_carcelaria_cultos (exige tiene_permiso(...,
-- 'obra_carcelaria.editar')). Y en el otro extremo, quien SI es pastor
-- (rol_local = 'pastor', como la cuenta de prueba) puede escribir en
-- CUALQUIER modulo de su congregacion sin que su cargo especifico lo
-- restrinja -- por diseno (autoridad total del pastor sobre su
-- congregacion, igual que en la web) -- exactamente lo que se reporto
-- como bug. Este script NO cambia esa autoridad del pastor; soluciona
-- el problema real (capturadores sin rol de pastor no podian escribir
-- nada) y ademas acota su escritura al modulo exacto de su cargo.
--
-- CORRECCION: se agregan policies NUEVAS y aditivas (ninguna existente se
-- toca ni se reemplaza) que dan acceso via cargo, pero SOLO al modulo
-- especifico de ese cargo -- nunca a toda la congregacion. Quien ya tenia
-- acceso amplio (pastor, distrital, nacional, super_admin) lo conserva
-- exactamente igual, por las policies existentes.
--
-- Ejecutar despues de schema.sql, migracion_produccion.sql, accesos.sql,
-- asistencia_web.sql, obra_carcelaria.sql y
-- sembrar_modulo_obra_carcelaria.sql. Repetible.

-- =========================================================================
-- Funciones helper (security definer: no dependen de que las tablas que
-- consultan ya tengan una policy que permita leerlas para este usuario).
-- =========================================================================

create or replace function tengo_cargo_activo(p_modulo_id uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from asignaciones_cargo ac
    join cargos c on c.id = ac.cargo_id
    where c.modulo_id = p_modulo_id
      and ac.persona_id = mi_persona_id()
      and ac.fecha_fin is null
  );
$$;

-- Version mas estricta para registros_actividad: exige que modulo_id Y
-- congregacion_id (los dos campos del registro) correspondan A LA VEZ al
-- mismo cargo activo -- evita que alguien mande un modulo_id real pero un
-- congregacion_id de otra congregacion en el mismo insert.
create or replace function tengo_cargo_en_modulo_congregacion(p_modulo_id uuid, p_congregacion_id uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from asignaciones_cargo ac
    join cargos c on c.id = ac.cargo_id
    join modulos m on m.id = c.modulo_id
    where m.id = p_modulo_id
      and m.congregacion_id = p_congregacion_id
      and ac.persona_id = mi_persona_id()
      and ac.fecha_fin is null
  );
$$;

create or replace function tengo_cargo_obra_carcelaria(p_congregacion_id uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from asignaciones_cargo ac
    join cargos c on c.id = ac.cargo_id
    join modulos m on m.id = c.modulo_id
    where m.congregacion_id = p_congregacion_id
      and lower(m.nombre_modulo) = 'obra carcelaria'
      and ac.persona_id = mi_persona_id()
      and ac.fecha_fin is null
  );
$$;

create or replace function mis_congregaciones_via_cargo() returns setof uuid language sql stable security definer as $$
  select distinct m.congregacion_id
  from asignaciones_cargo ac
  join cargos c on c.id = ac.cargo_id
  join modulos m on m.id = c.modulo_id
  where ac.persona_id = mi_persona_id() and ac.fecha_fin is null;
$$;

create or replace function mis_distritos_via_cargo() returns setof uuid language sql stable security definer as $$
  select distinct c.distrito_id
  from asignaciones_cargo ac
  join cargos ca on ca.id = ac.cargo_id
  join modulos m on m.id = ca.modulo_id
  join congregaciones c on c.id = m.congregacion_id
  where ac.persona_id = mi_persona_id() and ac.fecha_fin is null;
$$;

-- =========================================================================
-- Lectura de catalogo/contexto (necesaria para que la PWA arme el
-- formulario: nombre de congregacion, zonas, categorias, tipos de
-- actividad, y la propia fila de asignaciones_cargo/cargos/modulos que
-- consulta useMisAsignaciones()). Baja sensibilidad -- no expone el censo.
-- =========================================================================

drop policy if exists personas_select_propia on personas;
create policy personas_select_propia on personas for select to authenticated
using (auth_user_id = auth.uid());

drop policy if exists congregaciones_select_via_cargo on congregaciones;
create policy congregaciones_select_via_cargo on congregaciones for select to authenticated
using (id in (select mis_congregaciones_via_cargo()));

drop policy if exists modulos_select_via_cargo on modulos;
create policy modulos_select_via_cargo on modulos for select to authenticated
using (congregacion_id in (select mis_congregaciones_via_cargo()));

drop policy if exists zonas_select_via_cargo on zonas;
create policy zonas_select_via_cargo on zonas for select to authenticated
using (congregacion_id in (select mis_congregaciones_via_cargo()));

drop policy if exists categorias_demograficas_select_via_cargo on categorias_demograficas;
create policy categorias_demograficas_select_via_cargo on categorias_demograficas for select to authenticated
using (congregacion_id in (select mis_congregaciones_via_cargo()));

drop policy if exists tipos_actividad_select_via_cargo on tipos_actividad;
create policy tipos_actividad_select_via_cargo on tipos_actividad for select to authenticated
using (tengo_cargo_activo(modulo_id));

drop policy if exists cargos_select_propio on cargos;
create policy cargos_select_propio on cargos for select to authenticated
using (id in (select cargo_id from asignaciones_cargo where persona_id = mi_persona_id() and fecha_fin is null));

drop policy if exists asignaciones_cargo_select_propia on asignaciones_cargo;
create policy asignaciones_cargo_select_propia on asignaciones_cargo for select to authenticated
using (persona_id = mi_persona_id());

drop policy if exists centros_reclusion_select_via_cargo on centros_reclusion;
create policy centros_reclusion_select_via_cargo on centros_reclusion for select to authenticated
using (distrito_id in (select mis_distritos_via_cargo()));

-- =========================================================================
-- Escritura de datos reales: SOLO al modulo especifico del cargo. Esta es
-- la parte que cierra el hueco de seguridad reportado.
-- =========================================================================

drop policy if exists registros_select_via_cargo on registros_actividad;
create policy registros_select_via_cargo on registros_actividad for select to authenticated
using (tengo_cargo_en_modulo_congregacion(modulo_id, congregacion_id));

drop policy if exists registros_write_via_cargo on registros_actividad;
create policy registros_write_via_cargo on registros_actividad for insert to authenticated
with check (tengo_cargo_en_modulo_congregacion(modulo_id, congregacion_id));

drop policy if exists obra_carcelaria_cultos_read_via_cargo on obra_carcelaria_cultos;
create policy obra_carcelaria_cultos_read_via_cargo on obra_carcelaria_cultos for select to authenticated
using (tengo_cargo_obra_carcelaria(congregacion_id));

drop policy if exists obra_carcelaria_cultos_write_via_cargo on obra_carcelaria_cultos;
create policy obra_carcelaria_cultos_write_via_cargo on obra_carcelaria_cultos for insert to authenticated
with check (tengo_cargo_obra_carcelaria(congregacion_id));
