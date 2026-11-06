-- SIGAP - Excluir la congregacion demo de los reportes consolidados
-- nacionales.
--
-- mis_congregaciones() no filtraba es_demo en su rama nacional/
-- super_admin -- en cuanto exista una congregacion demo con censo y
-- actividad de ejemplo, se mezclaria con el Dashboard nacional, el
-- informe trimestral, la piramide poblacional y la salud de datos
-- reales. La rama local y la distrital no se tocan (si alguien tiene
-- un rol local/distrital real sobre la demo -- no deberia pasar en
-- producción, pero no hay razon para bloquearlo a proposito).

create or replace function mis_congregaciones() returns setof uuid language sql stable security definer as $$
  select r.congregacion_id from roles_sistema r
    join congregaciones c on c.id = r.congregacion_id
   where r.persona_id = mi_persona_id() and r.nivel = 'local' and r.fecha_fin is null and c.estado = 'activa'
  union
  select c.id from congregaciones c where c.distrito_id in (select mis_distritos())
  union
  select id from congregaciones where (es_super_admin() or es_nacional()) and es_demo = false;
$$;

-- Verificacion sugerida (correr aparte, de solo lectura):
-- select count(*) from congregaciones where es_demo = true; -- debe existir al menos 1 una vez corrido el paso 1
-- Con una cuenta nacional o super_admin real: confirmar que esa congregacion
-- demo ya NO aparece en listados que antes usaban mis_congregaciones().
