-- SIGAP - Diagnostico de solo lectura: personas SIN cuenta de login
-- (auth_user_id null) que de todas formas tienen un rol en
-- roles_sistema -- por eso el DELETE FROM personas del paso 1 fallo
-- con "violates foreign key constraint roles_sistema_persona_id_fkey".
--
-- Esto no deberia pasar en condiciones normales (un rol sin login no
-- se puede usar para nada), asi que probablemente es un residuo de
-- pruebas -- pero se revisa antes de decidir que hacer, no se asume.

select
  p.id as persona_id,
  p.nombres,
  p.apellidos,
  p.congregacion_id,
  c.nombre as congregacion,
  r.id as rol_id,
  r.nivel,
  r.congregacion_id as rol_congregacion_id,
  r.distrito_id,
  r.fecha_inicio,
  r.fecha_fin
from personas p
join roles_sistema r on r.persona_id = p.id
left join congregaciones c on c.id = p.congregacion_id
where p.auth_user_id is null
order by r.fecha_fin nulls first, p.apellidos;
