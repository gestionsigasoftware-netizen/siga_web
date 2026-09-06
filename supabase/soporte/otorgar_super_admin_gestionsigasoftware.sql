-- Otorga super_admin a gestionsigasoftware@gmail.com y se asegura de que
-- sea la UNICA cuenta con ese nivel activo (pedido explicito del
-- usuario: "el rol de super admin es el unico que lo debe tener").
--
-- La persona ya tiene roles local/distrital/nacional -- este script solo
-- agrega super_admin, no toca esos otros roles (no son mutuamente
-- excluyentes: una misma persona puede tener varios roles_sistema
-- activos a la vez, es el patron ya usado en toda la app).
--
-- No hay un flujo en la app para otorgar super_admin (otorgar-acceso-
-- jerarquico.sql solo cubre nacional/distrital) porque es el nivel mas
-- alto -- se hace una sola vez, directo aqui.

do $$
declare
  v_persona_id uuid;
  v_auth_user_id uuid;
begin
  select id into v_auth_user_id from auth.users where lower(email) = 'gestionsigasoftware@gmail.com';
  if v_auth_user_id is null then
    raise exception 'No existe una cuenta de Auth con ese correo';
  end if;

  select id into v_persona_id from personas where auth_user_id = v_auth_user_id;
  if v_persona_id is null then
    raise exception 'La cuenta no esta vinculada a ninguna persona del censo';
  end if;

  -- Revoca super_admin de cualquier otra persona que lo tenga activo,
  -- para que quede como el unico nivel exclusivo de esta cuenta.
  update roles_sistema
  set fecha_fin = now()
  where nivel = 'super_admin'
    and fecha_fin is null
    and persona_id <> v_persona_id;

  -- Otorga super_admin a la persona objetivo, si no lo tiene ya activo.
  if not exists (
    select 1 from roles_sistema
    where persona_id = v_persona_id and nivel = 'super_admin' and fecha_fin is null
  ) then
    insert into roles_sistema (persona_id, nivel)
    values (v_persona_id, 'super_admin');
  end if;
end $$;

-- Verificacion: quien queda con super_admin activo despues de correr esto
-- (deberia ser una sola fila, la de gestionsigasoftware@gmail.com).
select p.nombres, p.apellidos, u.email
from roles_sistema r
join personas p on p.id = r.persona_id
left join auth.users u on u.id = p.auth_user_id
where r.nivel = 'super_admin' and r.fecha_fin is null;
