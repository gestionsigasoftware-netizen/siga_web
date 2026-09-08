-- SIGA - Corregir una congregacion creada por error.
--
-- Hasta ahora no existia forma de deshacer una congregacion creada por
-- error desde "Registrar nueva congregacion" -- por diseno,
-- `congregaciones` no tiene politica de DELETE para el cliente (evita
-- borrados accidentales de un tenant real con datos verdaderos). Esta
-- funcion NO cambia esa regla -- es un "deshacer creacion" muy
-- estrecho, simetrico exacto de lo que hace crear_congregacion_con_pastor():
-- borra la fila de congregaciones, la persona-pastor autocreada, su rol
-- de sistema, su fila en pastores y su asignacion pastoral.
--
-- Solo funciona si la congregacion sigue "pendiente_aprobacion" (nunca
-- se activo) y no tiene ninguna persona real aparte del pastor
-- autocreado -- si ya se aprobo o ya tiene censo real, se rechaza y hay
-- que usar el SQL Editor a proposito, igual que antes.

create or replace function anular_congregacion(p_congregacion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_congregacion congregaciones%rowtype;
  v_personas_count integer;
begin
  select * into v_congregacion from congregaciones where id = p_congregacion_id;
  if v_congregacion.id is null then
    raise exception 'Congregación no encontrada';
  end if;

  if not (
    v_congregacion.distrito_id in (select mis_distritos())
    or es_nacional()
    or es_super_admin()
  ) then
    raise exception 'No tienes permisos sobre esta congregación';
  end if;

  if v_congregacion.estado <> 'pendiente_aprobacion' then
    raise exception 'Solo se puede anular una congregación que todavía no ha sido aprobada (estado actual: %). Si ya está activa o suspendida y de verdad fue un error, contacta soporte.', v_congregacion.estado;
  end if;

  select count(*) into v_personas_count from personas where congregacion_id = p_congregacion_id;
  if v_personas_count > 1 then
    raise exception 'Esta congregación ya tiene % personas registradas -- no se puede anular automáticamente, contacta soporte.', v_personas_count;
  end if;

  delete from asignaciones_pastorales where congregacion_id = p_congregacion_id;
  delete from roles_sistema where congregacion_id = p_congregacion_id;
  delete from pastores where id = v_congregacion.pastor_id;
  delete from personas where congregacion_id = p_congregacion_id;
  delete from congregaciones where id = p_congregacion_id;
end;
$$;

revoke all on function anular_congregacion(uuid) from public, anon;
grant execute on function anular_congregacion(uuid) to authenticated;
