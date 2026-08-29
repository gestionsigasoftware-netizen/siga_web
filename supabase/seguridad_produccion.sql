-- SIGA - Endurecimiento adicional para publicacion en Internet.
-- Ejecutar despues de schema.sql, accesos.sql, feligresia.sql,
-- migracion_produccion.sql y mision_juvenil.sql.

-- Las funciones SECURITY DEFINER deben resolver siempre objetos del esquema
-- esperado. La funcion de demo no debe poder ejecutarse desde el navegador.
alter function mi_persona_id() set search_path = public;
alter function es_super_admin() set search_path = public;
alter function es_nacional() set search_path = public;
alter function mis_distritos() set search_path = public;
alter function mis_congregaciones() set search_path = public;
alter function tengo_acceso_zona(uuid) set search_path = public;
alter function tiene_permiso(uuid, text) set search_path = public;
revoke execute on function crear_congregacion_demo(text) from public, anon, authenticated;

-- Conserva el acceso total del pastor local e incluye los permisos de los
-- modulos nuevos cuando no usa una asignacion de perfil adicional.
create or replace function tiene_permiso(p_congregacion_id uuid, p_permiso text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from asignaciones_acceso a
    join permisos_perfil pp on pp.perfil_id = a.perfil_id
    where a.persona_id = mi_persona_id()
      and a.congregacion_id = p_congregacion_id
      and a.fecha_fin is null
      and pp.permiso = p_permiso
  ) or exists (
    select 1 from roles_sistema r
    where r.persona_id = mi_persona_id()
      and r.nivel = 'local'
      and r.congregacion_id = p_congregacion_id
      and r.fecha_fin is null
      and coalesce(r.rol_local, 'pastor') = 'pastor'
      and p_permiso in (
        'feligresia.consultar', 'feligresia.editar',
        'estadisticas.consultar', 'estadisticas.registrar',
        'reportes.consultar', 'usuarios.administrar',
        'configuracion.administrar', 'auditoria.consultar',
        'evangelismo.consultar', 'evangelismo.editar',
        'evangelismo.registrar', 'mision_juvenil.consultar',
        'mision_juvenil.editar', 'mision_juvenil.registrar'
        , 'ruta_evangelistica.consultar', 'ruta_evangelistica.editar',
        'ruta_evangelistica.registrar'
      )
  );
$$;

-- Reemplaza el acceso amplio de Mision Juvenil por permisos de negocio.
drop policy if exists mision_instituciones_scope on mision_instituciones;
drop policy if exists mision_instituciones_read on mision_instituciones;
drop policy if exists mision_instituciones_write on mision_instituciones;
drop policy if exists mision_instituciones_update on mision_instituciones;
drop policy if exists mision_instituciones_delete on mision_instituciones;
create policy mision_instituciones_read on mision_instituciones
for select to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.consultar'));
create policy mision_instituciones_write on mision_instituciones
for insert to authenticated
with check (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));
create policy mision_instituciones_update on mision_instituciones
for update to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'))
with check (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));
create policy mision_instituciones_delete on mision_instituciones
for delete to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));

drop policy if exists mision_estudiantes_scope on mision_estudiantes;
drop policy if exists mision_estudiantes_read on mision_estudiantes;
drop policy if exists mision_estudiantes_write on mision_estudiantes;
drop policy if exists mision_estudiantes_update on mision_estudiantes;
drop policy if exists mision_estudiantes_delete on mision_estudiantes;
create policy mision_estudiantes_read on mision_estudiantes
for select to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.consultar'));
create policy mision_estudiantes_write on mision_estudiantes
for insert to authenticated
with check (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));
create policy mision_estudiantes_update on mision_estudiantes
for update to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'))
with check (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));
create policy mision_estudiantes_delete on mision_estudiantes
for delete to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));

drop policy if exists mision_grupos_scope on mision_grupos;
drop policy if exists mision_grupos_read on mision_grupos;
drop policy if exists mision_grupos_write on mision_grupos;
drop policy if exists mision_grupos_update on mision_grupos;
drop policy if exists mision_grupos_delete on mision_grupos;
create policy mision_grupos_read on mision_grupos
for select to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.consultar'));
create policy mision_grupos_write on mision_grupos
for insert to authenticated
with check (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));
create policy mision_grupos_update on mision_grupos
for update to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'))
with check (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));
create policy mision_grupos_delete on mision_grupos
for delete to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));

drop policy if exists mision_lideres_scope on mision_lideres;
drop policy if exists mision_lideres_read on mision_lideres;
drop policy if exists mision_lideres_write on mision_lideres;
create policy mision_lideres_read on mision_lideres
for select to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.consultar'));
create policy mision_lideres_write on mision_lideres
for all to authenticated
using (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'))
with check (congregacion_id in (select mis_congregaciones())
  and tiene_permiso(congregacion_id, 'mision_juvenil.editar'));

drop policy if exists mision_lecciones_scope on mision_lecciones;
drop policy if exists mision_lecciones_read on mision_lecciones;
drop policy if exists mision_lecciones_write on mision_lecciones;
create policy mision_lecciones_read on mision_lecciones
for select to authenticated
using (exists (select 1 from mision_grupos g
  where g.id = mision_lecciones.grupo_id
    and g.congregacion_id in (select mis_congregaciones())
    and tiene_permiso(g.congregacion_id, 'mision_juvenil.consultar')));
create policy mision_lecciones_write on mision_lecciones
for all to authenticated
using (exists (select 1 from mision_grupos g
  where g.id = mision_lecciones.grupo_id
    and g.congregacion_id in (select mis_congregaciones())
    and tiene_permiso(g.congregacion_id, 'mision_juvenil.editar')))
with check (exists (select 1 from mision_grupos g
  where g.id = mision_lecciones.grupo_id
    and g.congregacion_id in (select mis_congregaciones())
    and tiene_permiso(g.congregacion_id, 'mision_juvenil.editar')));

drop policy if exists mision_asistencia_scope on mision_asistencia_estudiante;
drop policy if exists mision_asistencia_read on mision_asistencia_estudiante;
drop policy if exists mision_asistencia_write on mision_asistencia_estudiante;
create policy mision_asistencia_read on mision_asistencia_estudiante
for select to authenticated
using (exists (select 1 from mision_lecciones l
  join mision_grupos g on g.id = l.grupo_id
  where l.id = mision_asistencia_estudiante.leccion_id
    and g.congregacion_id in (select mis_congregaciones())
    and tiene_permiso(g.congregacion_id, 'mision_juvenil.consultar')));
create policy mision_asistencia_write on mision_asistencia_estudiante
for all to authenticated
using (exists (select 1 from mision_lecciones l
  join mision_grupos g on g.id = l.grupo_id
  where l.id = mision_asistencia_estudiante.leccion_id
    and g.congregacion_id in (select mis_congregaciones())
    and tiene_permiso(g.congregacion_id, 'mision_juvenil.editar')))
with check (exists (select 1 from mision_lecciones l
  join mision_grupos g on g.id = l.grupo_id
  where l.id = mision_asistencia_estudiante.leccion_id
    and g.congregacion_id in (select mis_congregaciones())
    and tiene_permiso(g.congregacion_id, 'mision_juvenil.editar')));

-- Evita asociar una asistencia a un estudiante de otra congregacion.
create or replace function validar_asistencia_mision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1
    from mision_lecciones l
    join mision_grupos g on g.id = l.grupo_id
    join mision_estudiantes e on e.id = new.estudiante_id
    where l.id = new.leccion_id
      and e.congregacion_id = g.congregacion_id
      and (g.institucion_id is null or e.institucion_id is null or g.institucion_id = e.institucion_id)
  ) then
    raise exception 'El estudiante no pertenece al ambito del grupo';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_asistencia_mision_trigger on mision_asistencia_estudiante;
create trigger validar_asistencia_mision_trigger
before insert or update on mision_asistencia_estudiante
for each row execute function validar_asistencia_mision();