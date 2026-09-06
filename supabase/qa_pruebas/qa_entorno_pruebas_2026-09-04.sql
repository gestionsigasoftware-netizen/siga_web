-- SIGA - Entorno de pruebas QA (2026-09-04)
-- Un solo uso, para preparar la ronda de pruebas de produccion.
--
-- Que hace:
-- 1. Crea una congregacion de prueba AISLADA (es_demo=true), sin tocar
--    Puerto Tejada Cauca Central ni ningun dato real.
-- 2. Le da a la MISMA cuenta de prueba que ya existe (pueba691@gmail.com,
--    persona Jhan Sanchez) acceso local a esa congregacion nueva, mas
--    acceso distrital (Distrito 6, el mismo de Puerto Tejada) y nacional
--    -- todo en la misma cuenta, para poder cambiar de rol desde Perfil
--    sin crear usuarios nuevos.
--
-- No requiere ejecutar crear_congregacion_demo() por separado -- este
-- bloque ya lo hace y usa el id que devuelve.

do $$
declare
  v_congregacion_id uuid;
  v_persona_id uuid := '2c622693-efa1-40b9-a207-4d67a9c4a217'; -- Jhan Sanchez (cuenta de prueba ya existente)
  v_distrito_id uuid;
begin
  v_congregacion_id := crear_congregacion_demo('QA - Prueba SIGAP');

  select distrito_id into v_distrito_id
  from congregaciones
  where id = 'a9420cae-cacd-4484-875f-f54548f9f639'; -- Puerto Tejada Cauca Central

  insert into roles_sistema (persona_id, nivel, congregacion_id, rol_local)
  values (v_persona_id, 'local', v_congregacion_id, 'pastor');

  insert into roles_sistema (persona_id, nivel, distrito_id)
  values (v_persona_id, 'distrital', v_distrito_id);

  insert into roles_sistema (persona_id, nivel)
  values (v_persona_id, 'nacional');

  raise notice 'Congregacion QA creada con id: %', v_congregacion_id;
end $$;

-- Para ver el id de la congregacion QA recien creada (util para el reporte final):
select id, nombre, es_demo, distrito_id from congregaciones where nombre = 'QA - Prueba SIGAP';
