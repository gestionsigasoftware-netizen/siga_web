-- SIGAP - Paso 3: borrar la congregacion de prueba completa
-- "AGUA BONITA SUAREZ CAUCA" (confirmada por el usuario: todo ahi es
-- de prueba, incluido su pastor) y el pastor de prueba del directorio
-- distrital "Carlos Andres Sanchez Mina".
--
-- IDs confirmados por los diagnosticos anteriores:
--   congregacion: edbe675d-fbd4-4ad0-a8b6-534994aa5e3f (AGUA BONITA SUAREZ CAUCA)
--   persona (censo): aaae26e0-d554-4e6d-a6e9-adafeeb7a241 (Carlos Andres Sanchez Mina)
--   pastor (directorio distrital): a3e518b9-c785-4815-82af-44a3e5a962e2
--   auth_user_id de esa persona: bbc08d2f-f9d0-48f8-818a-3f75cbf1ecb8 (andresanchezw916@gmail.com)
--
-- Los otros 2 pastores del directorio (Damil Lerma - PUERTO TEJADA,
-- Carlos Alberto Diaz Gonzalez - SUCRE CAUCA) son reales, NO se tocan.
--
-- IMPORTANTE: esta persona SI tiene cuenta de login real (a diferencia
-- de Damil Lerma). Este script borra sus datos de aplicacion (censo,
-- rol, directorio distrital), pero NO puede borrar la cuenta de
-- Supabase Authentication en si -- eso se hace aparte, en el panel de
-- Supabase (Authentication > Users > buscar andresanchezw916@gmail.com
-- > Delete user), despues de correr este script.

begin;

-- 1) Pastor de prueba del directorio distrital -- cascada automatica
--    a asignaciones_pastorales, historial_licencias_pastorales y
--    formacion_pastoral de este pastor. Tambien resuelve de paso la
--    referencia pastores.persona_id -> personas (si estaba enlazada)
--    antes de borrar la persona en el paso 3.
delete from pastores where id = 'a3e518b9-c785-4815-82af-44a3e5a962e2';

-- 2) Rol local de esa persona (bloquea el DELETE de personas si no se
--    quita primero, mismo patron que el caso de Damil Lerma).
delete from roles_sistema where persona_id = 'aaae26e0-d554-4e6d-a6e9-adafeeb7a241';

-- 3) La persona del censo.
delete from personas where id = 'aaae26e0-d554-4e6d-a6e9-adafeeb7a241';

-- 4) Estructura propia de la congregacion de prueba, preservada
--    globalmente para las congregaciones reales pero que bloquearia
--    el DELETE de `congregaciones` si no se limpia para esta en
--    particular. modulos cascada automaticamente a sus
--    tipos_actividad y cargos.
delete from modulos where congregacion_id = 'edbe675d-fbd4-4ad0-a8b6-534994aa5e3f';
delete from categorias_demograficas where congregacion_id = 'edbe675d-fbd4-4ad0-a8b6-534994aa5e3f';

-- 5) El catalogo oficial IPUC NO se borra (es la lista nacional real)
--    -- solo se desvincula de esta congregacion de prueba, para que el
--    lugar real (si existe) se pueda volver a registrar correctamente
--    mas adelante.
update catalogo_congregaciones_ipuc set congregacion_id = null
where congregacion_id = 'edbe675d-fbd4-4ad0-a8b6-534994aa5e3f';

-- 6) La congregacion misma -- en cascada se lleva suscripciones,
--    configuracion_congregacion, asignaciones_acceso, caracteres_culto,
--    refam/esfob/discipulado_lecciones y cualquier otra tabla que ya
--    estaba vacia desde el paso 1.
delete from congregaciones where id = 'edbe675d-fbd4-4ad0-a8b6-534994aa5e3f';

commit;

-- Verificacion sugerida (correr aparte, despues del commit):
-- select count(*) from congregaciones;  -- debe ser 1 menos que antes
-- select count(*) from personas;        -- debe ser 2 (super_admin + Damil Lerma)
-- select count(*) from pastores;        -- debe ser 2 (Damil Lerma, Carlos Alberto Diaz)
-- select nombres, apellidos, auth_user_id from personas; -- revisar que ambas sean las reales
--
-- Y para terminar de limpiar la cuenta de login huerfana:
-- Panel de Supabase > Authentication > Users > buscar
-- andresanchezw916@gmail.com > Delete user.
