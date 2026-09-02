-- SIGA - Permite a cualquier usuario corregir su propio nombre en el
-- censo (util cuando quedo mal escrito, o vacio, al registrarse desde
-- una invitacion). Actualiza directamente personas.nombres/apellidos de
-- la fila vinculada a su propia cuenta -- nunca puede tocar otra fila,
-- y es la unica fuente real de "nombre" que existe: no se guarda un
-- nombre distinto en Auth para no terminar con dos nombres diferentes
-- para la misma persona.

drop function if exists actualizar_mi_nombre(text, text);
create function actualizar_mi_nombre(p_nombres text, p_apellidos text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if trim(coalesce(p_nombres, '')) = '' or trim(coalesce(p_apellidos, '')) = '' then
    raise exception 'Nombres y apellidos son obligatorios';
  end if;

  update personas
  set nombres = trim(p_nombres), apellidos = trim(p_apellidos)
  where auth_user_id = auth.uid();

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function actualizar_mi_nombre(text, text) from public, anon;
grant execute on function actualizar_mi_nombre(text, text) to authenticated;
