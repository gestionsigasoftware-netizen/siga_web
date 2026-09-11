-- SIGA - Limpieza de higiene (2026-09-10), hallazgo de la auditoria del
-- bug "column reference congregacion_id is ambiguous": existen 3
-- versiones historicas de crear_congregacion_con_pastor con distinta
-- cantidad de parametros (5, 6 y 7), porque Postgres no reemplaza una
-- funcion con `create or replace` cuando la firma cambia -- crea una
-- sobrecarga nueva que convive con las anteriores. La version de 7
-- parametros (con p_catalogo_id, ya corregida en
-- fix_ambiguedad_congregacion_id_catalogo.sql) es la unica que el
-- frontend llama hoy. Se eliminan las 2 sobrecargas viejas, que ya
-- nadie usa, para dejar una sola version de esta funcion de negocio.
-- Ejecutar despues de fix_ambiguedad_congregacion_id_catalogo.sql. Es
-- repetible.

drop function if exists crear_congregacion_con_pastor(uuid, text, text, text, text);
drop function if exists crear_congregacion_con_pastor(uuid, text, text, text, text, text);
