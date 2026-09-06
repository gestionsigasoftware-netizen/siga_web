-- SIGA - Limpieza del entorno de pruebas QA
-- Ejecutar SOLO cuando la ronda de QA haya terminado y el reporte ya
-- este entregado. Quita los 3 roles extra de la cuenta de prueba y
-- borra la congregacion "QA - Prueba SIGAP" (marcada es_demo=true) y
-- todo lo que se haya creado dentro de ella (cascada por foreign keys).

do $$
declare
  v_persona_id uuid := '2c622693-efa1-40b9-a207-4d67a9c4a217'; -- Jhan Sanchez
  v_congregacion_id uuid;
begin
  select id into v_congregacion_id from congregaciones where nombre = 'QA - Prueba SIGAP' and es_demo = true;

  delete from roles_sistema where persona_id = v_persona_id and nivel in ('distrital', 'nacional');
  delete from roles_sistema where persona_id = v_persona_id and nivel = 'local'
    and congregacion_id = v_congregacion_id;

  -- Residuo de una ronda de QA anterior: una persona de prueba ("QA
  -- Activa Persona Dos") que tuvo un rol de equipo de trabajo en la
  -- congregacion QA. La app no pudo borrarla con la anon key porque
  -- roles_sistema le sigue apuntando (proteccion de auditoria via RLS
  -- + FK) -- este script corre en el SQL Editor como superusuario, asi
  -- que si ignora RLS y puede borrar directamente.
  delete from roles_sistema where congregacion_id = v_congregacion_id;
  delete from personas where congregacion_id = v_congregacion_id;

  -- Semilla base que deja crear_congregacion_demo() al crear la
  -- congregacion (un modulo "Ujieres" + sus tipos de actividad,
  -- categorias demograficas y etapas de seguimiento) -- nadie mas la
  -- borro porque ninguna ronda de QA la creo, la trajo la funcion.
  delete from tipos_actividad where modulo_id in (select id from modulos where congregacion_id = v_congregacion_id);
  delete from modulos where congregacion_id = v_congregacion_id;
  delete from categorias_demograficas where congregacion_id = v_congregacion_id;
  delete from etapas_seguimiento where congregacion_id = v_congregacion_id;

  delete from congregaciones where id = v_congregacion_id;
end $$;
