-- SIGAP - Diagnostico de solo lectura: que cuenta(s) de login estan
-- ligadas a la congregacion "PUERTO TEJADA", y si alguna de esas
-- cuentas tiene TAMBIEN un rol super_admin (serian la misma persona
-- usando dos roles) o son cuentas distintas. No modifica nada.

select
  c.nombre as congregacion,
  p.id as persona_id,
  p.nombres,
  p.apellidos,
  p.auth_user_id,
  u.email,
  r.nivel as rol_en_esta_fila,
  r.fecha_fin,
  exists (
    select 1 from roles_sistema r2
    where r2.persona_id = p.id and r2.nivel = 'super_admin' and r2.fecha_fin is null
  ) as esta_misma_persona_es_super_admin
from congregaciones c
join roles_sistema r on r.congregacion_id = c.id
join personas p on p.id = r.persona_id
left join auth.users u on u.id = p.auth_user_id
where c.nombre ilike '%puerto tejada%'
order by r.fecha_fin nulls first, r.nivel;
