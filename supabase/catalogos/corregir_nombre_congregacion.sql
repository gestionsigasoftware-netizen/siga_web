-- SIGA - Corregir el nombre de una congregacion existente al nombre
-- oficial real de la IPUC (catalogo extraido de Debora), sin crear una
-- congregacion nueva ni trasladar al pastor -- es la misma congregacion,
-- solo se corrige como quedo mal registrada desde el inicio.
--
-- Caso de uso real: en "Editar pastor", el buscador de Congregacion
-- ahora tambien ofrece nombres oficiales que todavia no estan
-- registrados en SIGAP (ademas de las congregaciones reales, para
-- trasladar). Si el distrital elige una de esas oficiales sin registrar,
-- se llama esta funcion en vez de trasladar_pastor.
--
-- Ejecutar despues de catalogo_congregaciones_ipuc.sql.

create or replace function corregir_nombre_congregacion(
  p_congregacion_id uuid,
  p_catalogo_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_distrito_id uuid;
  v_distrito_numero integer;
  v_nombre_oficial text;
  v_catalogo_distrito integer;
begin
  select distrito_id into v_distrito_id from congregaciones where id = p_congregacion_id;
  if v_distrito_id is null or not (v_distrito_id in (select mis_distritos())) then
    raise exception 'No tienes permisos sobre esta congregacion';
  end if;

  select nombre, distrito_numero into v_nombre_oficial, v_catalogo_distrito
  from catalogo_congregaciones_ipuc where id = p_catalogo_id;
  if v_nombre_oficial is null then
    raise exception 'La congregacion oficial no existe en el catalogo';
  end if;

  select numero into v_distrito_numero from distritos where id = v_distrito_id;
  if v_catalogo_distrito is distinct from v_distrito_numero then
    raise exception 'Esa congregacion oficial pertenece a otro distrito';
  end if;

  -- Libera cualquier vinculo previo de esta congregacion en el catalogo
  -- (si tenia otro nombre oficial ligado por error) antes de asignar el
  -- nuevo, para que el catalogo mantenga una relacion 1 a 1 limpia.
  update catalogo_congregaciones_ipuc set congregacion_id = null where congregacion_id = p_congregacion_id;

  update congregaciones set nombre = v_nombre_oficial where id = p_congregacion_id;
  update catalogo_congregaciones_ipuc set congregacion_id = p_congregacion_id where id = p_catalogo_id;
end;
$$;

revoke all on function corregir_nombre_congregacion(uuid, uuid) from public, anon;
grant execute on function corregir_nombre_congregacion(uuid, uuid) to authenticated;
