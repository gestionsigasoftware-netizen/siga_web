-- SIGAP - Diagnostico de solo lectura: quien es la persona (y su
-- cuenta de login, si tiene) ligada a AGUA BONITA SUAREZ CAUCA.
--
-- Como la persona SI sobrevivio al DELETE del paso 1 (que solo borro
-- personas SIN auth_user_id), esto implica que tiene una cuenta de
-- acceso real -- hay que confirmar quien es antes de decidir si esa
-- cuenta tambien se elimina (eso requiere borrar el usuario de
-- Authentication en el panel de Supabase, no solo filas de tablas).

select
  p.id as persona_id,
  p.nombres,
  p.apellidos,
  p.telefono,
  p.auth_user_id,
  u.email,
  u.created_at as cuenta_creada,
  u.last_sign_in_at,
  r.nivel,
  r.fecha_inicio,
  r.fecha_fin
from personas p
left join auth.users u on u.id = p.auth_user_id
left join roles_sistema r on r.persona_id = p.id and r.congregacion_id = p.congregacion_id
where p.congregacion_id = (select id from congregaciones where nombre = 'AGUA BONITA SUAREZ CAUCA');
