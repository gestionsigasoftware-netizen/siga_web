-- SIGA - HOTFIX urgente: rls_cargo_pwa.sql introdujo una recursion
-- infinita en las policies de "cargos" que rompio el acceso de TODAS las
-- cuentas (no solo la de prueba), incluidas las de pastor.
--
-- Causa exacta: la policy cargos_select_propio hacia una subconsulta
-- DIRECTA sobre asignaciones_cargo dentro de su "using". Pero
-- asignaciones_cargo_scope (la policy original, de migracion_produccion.sql)
-- hace JOIN de vuelta a cargos -- y evaluar esa policy vuelve a evaluar
-- TODAS las policies de cargos, incluida cargos_select_propio, que vuelve
-- a consultar asignaciones_cargo... ciclo infinito. El resto de las
-- policies nuevas de rls_cargo_pwa.sql ya usaban funciones security
-- definer para evitar justo esto -- a esta se le paso por alto.
--
-- Ejecutar esto INMEDIATAMENTE despues de rls_cargo_pwa.sql para
-- corregirlo. Repetible.

create or replace function tengo_este_cargo(p_cargo_id uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from asignaciones_cargo ac
    where ac.cargo_id = p_cargo_id
      and ac.persona_id = mi_persona_id()
      and ac.fecha_fin is null
  );
$$;

drop policy if exists cargos_select_propio on cargos;
create policy cargos_select_propio on cargos for select to authenticated
using (tengo_este_cargo(id));
