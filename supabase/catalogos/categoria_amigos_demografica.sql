-- SIGA - Categoria demografica "Amigos", sembrada retroactivamente.
-- Ejecutar despues de schema.sql.
--
-- Hallazgo (auditoria del Resumen, 2026-09-10): la seccion "Amigos e
-- integracion" del Dashboard (src/pages/Dashboard.jsx) busca una
-- categoria demografica llamada exactamente "Amigos" (comparacion
-- case-insensitive) para poder sumar la asistencia de Ujieres asociada
-- a esa categoria. Esa categoria SI viene en el seed de congregaciones
-- demo (crear_congregacion_demo, schema.sql), pero la funcion real de
-- alta de congregaciones (crear_congregacion_con_pastor,
-- supabase/distrital/gestion_distrital_congregaciones.sql) no siembra
-- NINGUNA categoria demografica -- una congregacion real arranca con
-- ese catalogo vacio. Sin la categoria "Amigos", esa seccion del
-- Resumen queda inutilizable en cualquier congregacion real que no la
-- haya creado a mano con ese nombre exacto.
--
-- Igual que poblaciones_especiales_demograficas.sql, este script solo
-- agrega la categoria puntual que un consumidor real necesita -- no
-- intenta sembrar el set base completo (Niños/Adolescentes/etc.) en el
-- alta real de congregaciones, que sigue siendo un alcance mayor,
-- pendiente aparte.

do $$
declare
  v_congregacion record;
  v_siguiente_orden int;
begin
  for v_congregacion in select id from congregaciones loop
    if not exists (
      select 1 from categorias_demograficas
      where congregacion_id = v_congregacion.id and lower(nombre) = lower('Amigos')
    ) then
      select coalesce(max(orden), 0) + 1 into v_siguiente_orden
      from categorias_demograficas where congregacion_id = v_congregacion.id;
      insert into categorias_demograficas (congregacion_id, nombre, orden)
      values (v_congregacion.id, 'Amigos', v_siguiente_orden);
    end if;
  end loop;
end $$;
