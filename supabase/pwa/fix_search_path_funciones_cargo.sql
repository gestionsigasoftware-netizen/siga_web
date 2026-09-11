-- SIGA - Endurecimiento encontrado en la auditoria de aislamiento entre
-- congregaciones (2026-09-10): estas 7 funciones son `security definer`
-- y se usan directamente dentro de politicas RLS (corren en cada
-- consulta a personas, congregaciones, modulos, zonas, amigos, comites,
-- registros_actividad, obra_carcelaria_cultos, cargos), pero a
-- diferencia del set base (tiene_permiso, mis_congregaciones, etc., ya
-- endurecidas en seguridad_produccion.sql) nunca recibieron
-- `set search_path = public` -- riesgo de search_path hijacking. No
-- cambia su comportamiento para nadie, solo fija donde buscan los
-- nombres de tabla/funcion que usan.
-- Ejecutar despues de tengo_cargo_activo_rls.sql, rls_cargo_pwa.sql y
-- hotfix_recursion_cargos.sql. Es repetible.

alter function tengo_cargo_activo_congregacion(uuid) set search_path = public;
alter function tengo_cargo_activo(uuid) set search_path = public;
alter function tengo_cargo_en_modulo_congregacion(uuid, uuid) set search_path = public;
alter function tengo_cargo_obra_carcelaria(uuid) set search_path = public;
alter function mis_congregaciones_via_cargo() set search_path = public;
alter function mis_distritos_via_cargo() set search_path = public;
alter function tengo_este_cargo(uuid) set search_path = public;
