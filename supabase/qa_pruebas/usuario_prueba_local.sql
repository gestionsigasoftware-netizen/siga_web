-- Usuario temporal de pruebas para SIGA.
-- 1. Crea primero el usuario en Supabase > Authentication > Users.
-- 2. Reemplaza solo el correo de prueba de abajo.
-- 3. Ejecuta este script en el SQL Editor.
-- Nunca pongas aquí la contraseña.

do $$
declare
  v_email text := 'gestionsigasoftware@gmail.com';
  v_user_id uuid;
  v_distrito_id uuid;
  v_congregacion_id uuid;
  v_persona_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No existe un usuario Auth con el correo %', v_email;
  end if;

  select id into v_distrito_id
  from distritos
  order by created_at
  limit 1;

  if v_distrito_id is null then
    insert into distritos (nombre)
    values ('Distrito de Pruebas')
    returning id into v_distrito_id;
  end if;

  select id into v_congregacion_id
  from congregaciones
  where es_demo = true
  order by created_at
  limit 1;

  if v_congregacion_id is null then
    insert into congregaciones (distrito_id, nombre, pastor_nombre, estado, es_demo)
    values (v_distrito_id, 'Congregación de Pruebas', 'Pastor de Pruebas', 'activa', true)
    returning id into v_congregacion_id;
  end if;

  insert into personas (congregacion_id, auth_user_id, nombres, apellidos)
  values (v_congregacion_id, v_user_id, 'Usuario', 'de Pruebas')
  on conflict (auth_user_id) do update
    set congregacion_id = excluded.congregacion_id,
        nombres = excluded.nombres,
        apellidos = excluded.apellidos
  returning id into v_persona_id;

  insert into roles_sistema (persona_id, nivel, congregacion_id)
  select v_persona_id, 'local', v_congregacion_id
  where not exists (
    select 1 from roles_sistema
    where persona_id = v_persona_id
      and nivel = 'local'
      and congregacion_id = v_congregacion_id
      and fecha_fin is null
  );

  raise notice 'Usuario local listo: %', v_email;
  raise notice 'Congregacion: %', v_congregacion_id;
end $$;

-- Verificacion: debe devolver una fila con nivel local.
select
  u.email,
  p.nombres,
  p.apellidos,
  r.nivel,
  c.nombre as congregacion
from auth.users u
join personas p on p.auth_user_id = u.id
join roles_sistema r on r.persona_id = p.id and r.fecha_fin is null
join congregaciones c on c.id = r.congregacion_id
where lower(u.email) = lower('gestionsigasoftware@gmail.com');
