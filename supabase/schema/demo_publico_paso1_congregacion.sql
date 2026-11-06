-- SIGAP - Acceso demo publico, paso 1: crear la congregacion demo.
--
-- Reutiliza crear_congregacion_demo(), que ya existe en schema.sql
-- (seccion "5. SEED de datos demo") pero sigue bloqueada para el
-- navegador (revoke execute ... from public, anon, authenticated en
-- seguridad_produccion.sql) -- solo se puede invocar aqui, desde el
-- SQL Editor, con el rol postgres. Eso es correcto y no se toca.
--
-- Este paso SOLO crea la congregacion + su estructura base (modulo,
-- categorias demograficas, tipos de actividad, etapas de seguimiento).
-- Todavia no tiene censo ni actividad de ejemplo -- eso va en el
-- paso 2, que necesita el id de esta congregacion y el auth_user_id
-- de la cuenta de login demo (que se crea aparte, a mano, en
-- Authentication > Users, porque no hay forma de crear un usuario de
-- Auth por SQL).

select crear_congregacion_demo('Congregación Demo SIGAP') as congregacion_demo_id;

-- Copia el uuid que devuelve esta consulta -- se necesita para el
-- paso 2. Tambien queda disponible despues con:
-- select id from congregaciones where es_demo = true and nombre = 'Congregación Demo SIGAP';
