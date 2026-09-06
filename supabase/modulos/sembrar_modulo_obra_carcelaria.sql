-- SIGA - Crea el modulo "Obra Carcelaria" para cada congregacion, para que
-- pueda asignarse como "Responsabilidad operativa" en Equipo de trabajo y
-- de ahi la PWA de captura (siga-pwa-nacional) lo detecte automaticamente.
--
-- A diferencia de Evangelismo/Mision Juvenil, Obra Carcelaria NO usa el motor
-- generico de registros_actividad (tiene su propio esquema en
-- obra_carcelaria.sql: obra_carcelaria_cultos, etc.), asi que aqui solo se
-- crea la fila de modulos -- sin tipos_actividad -- unicamente para que
-- exista el "gancho" de asignacion de cargo (cargos + asignaciones_cargo)
-- que ya usan tanto la web (EquipoCongregacion.jsx / invitar-usuario) como
-- la PWA (useMisAsignaciones).
--
-- Idempotente: se puede volver a ejecutar sin duplicar modulos.

do $$
declare
  v_modulo_id uuid;
  v_congregacion record;
begin
  for v_congregacion in select id from congregaciones loop
    select id into v_modulo_id from modulos where congregacion_id = v_congregacion.id and lower(nombre_modulo) = 'obra carcelaria' limit 1;
    if v_modulo_id is null then
      insert into modulos (congregacion_id, nombre_modulo, alcance, requiere_zona)
      values (v_congregacion.id, 'Obra Carcelaria', 'extramural', false);
    else
      update modulos set alcance = 'extramural', requiere_zona = false where id = v_modulo_id;
    end if;
  end loop;
end $$;
