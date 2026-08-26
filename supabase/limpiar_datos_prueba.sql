-- SIGA - Limpieza del seed de carga visual.
-- SOLO elimina filas marcadas por seed_datos_prueba.sql en la congregacion demo.
-- Ejecutar despues de terminar las pruebas.

begin;

do $$
declare
  v_congregacion_id uuid;
begin
  select id into v_congregacion_id
  from congregaciones
  where es_demo = true
  order by created_at
  limit 1;

  if v_congregacion_id is null then
    raise exception 'No existe una congregacion demo.';
  end if;

  delete from mision_asistencia_estudiante where leccion_id in (select l.id from mision_lecciones l join mision_grupos g on g.id = l.grupo_id where g.congregacion_id = v_congregacion_id and g.nombre like 'SIGA_PRUEBA_CARGA%');
  delete from mision_lecciones where grupo_id in (select id from mision_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%');
  delete from mision_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%';
  delete from mision_estudiantes where congregacion_id = v_congregacion_id and notas = 'SIGA_PRUEBA_CARGA';
  delete from mision_instituciones where congregacion_id = v_congregacion_id and notas = 'SIGA_PRUEBA_CARGA';
  delete from mision_lideres where congregacion_id = v_congregacion_id and persona_id in (select id from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA');
  delete from notificaciones where titulo like 'SIGA_PRUEBA_CARGA%';
  delete from amigos_notas where amigo_id in (select id from amigos where congregacion_id = v_congregacion_id and nombres like 'Amigo Prueba % Carga');
  delete from registros_actividad where congregacion_id = v_congregacion_id and novedades = 'SIGA_PRUEBA_CARGA';
  delete from seguimientos_pastorales where congregacion_id = v_congregacion_id and notas = 'SIGA_PRUEBA_CARGA';
  delete from historial_cargos where observaciones = 'SIGA_PRUEBA_CARGA' and persona_id in (select id from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA');
  delete from membresias_comite where comite_id in (select id from comites where congregacion_id = v_congregacion_id and descripcion = 'SIGA_PRUEBA_CARGA');
  delete from amigos where congregacion_id = v_congregacion_id and nombres like 'Amigo Prueba % Carga';
  delete from comites where congregacion_id = v_congregacion_id and descripcion = 'SIGA_PRUEBA_CARGA';
  delete from zonas where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%';
  delete from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA';
  delete from familias where congregacion_id = v_congregacion_id and nombre_familia like 'SIGA_PRUEBA_CARGA%';
  delete from tipos_actividad where modulo_id in (select id from modulos where congregacion_id = v_congregacion_id) and caracter = 'SIGA_PRUEBA_CARGA';
  delete from configuracion_congregacion where congregacion_id = v_congregacion_id;

  raise notice 'Datos de prueba eliminados de la congregacion demo.';
end $$;

commit;

select 'personas' as entidad, count(*) as filas from personas where observaciones_pastorales = 'SIGA_PRUEBA_CARGA'
union all select 'familias', count(*) from familias where nombre_familia like 'SIGA_PRUEBA_CARGA%'
union all select 'comites', count(*) from comites where descripcion = 'SIGA_PRUEBA_CARGA'
union all select 'seguimientos', count(*) from seguimientos_pastorales where notas = 'SIGA_PRUEBA_CARGA'
union all select 'asistencias', count(*) from registros_actividad where novedades = 'SIGA_PRUEBA_CARGA'
union all select 'instituciones juveniles', count(*) from mision_instituciones where notas = 'SIGA_PRUEBA_CARGA'
union all select 'estudiantes juveniles', count(*) from mision_estudiantes where notas = 'SIGA_PRUEBA_CARGA'
union all select 'grupos juveniles', count(*) from mision_grupos where nombre like 'SIGA_PRUEBA_CARGA%';
