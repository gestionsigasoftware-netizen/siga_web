-- SIGA - Categorias demograficas sugeridas para poblaciones especiales.
-- Ejecutar despues de schema.sql.
--
-- categorias_demograficas ya es un catalogo 100% editable por
-- congregacion (Configuracion > Categorias demograficas) -- no hace
-- falta ningun cambio de codigo ni de esquema. La brecha es de
-- estandarizacion: el seed original (schema.sql, funcion
-- crear_congregacion_demo) solo trae Niños/Adolescentes/Jovenes/
-- Caballeros/Damas/Ancianos/Amigos. El testimonio de un lider
-- distrital (2026-09-08, ver docs/pendientes.md) describe que en
-- campo tambien se caracteriza a poblacion sorda e indigena/etnica,
-- y si cada congregacion inventa su propio nombre para eso, el
-- reporte nacional deja de ser comparable.
--
-- Este script agrega esas dos categorias sugeridas, de forma
-- retroactiva, a TODAS las congregaciones existentes que aun no
-- tengan una categoria con ese nombre (comparacion case-insensitive,
-- para no duplicar si alguna congregacion ya la agrego manualmente
-- con mayusculas distintas). Es idempotente: correrlo varias veces es
-- seguro. Cada congregacion conserva la libertad de renombrar o
-- desactivar/eliminar estas categorias desde Configuracion, igual que
-- cualquier otra.
--
-- Nota aparte (fuera de alcance de este script, dejar como pendiente
-- separado si se decide atender): la funcion real de alta de
-- congregaciones (crear_congregacion_con_pastor, en
-- supabase/distrital/gestion_distrital_congregaciones.sql) no siembra
-- NINGUNA categoria demografica por defecto -- una congregacion nueva
-- arranca hoy con el catalogo completamente vacio, distinto de
-- crear_congregacion_demo. No se toca aqui por ser un alcance mayor
-- al pedido (sembrar el set base completo en el alta real).

do $$
declare
  v_congregacion record;
  v_siguiente_orden int;
  v_categoria text;
begin
  for v_congregacion in select id from congregaciones loop
    foreach v_categoria in array array['Población sorda', 'Población indígena / étnica'] loop
      if not exists (
        select 1 from categorias_demograficas
        where congregacion_id = v_congregacion.id and lower(nombre) = lower(v_categoria)
      ) then
        select coalesce(max(orden), 0) + 1 into v_siguiente_orden
        from categorias_demograficas where congregacion_id = v_congregacion.id;
        insert into categorias_demograficas (congregacion_id, nombre, orden)
        values (v_congregacion.id, v_categoria, v_siguiente_orden);
      end if;
    end loop;
  end loop;
end $$;
