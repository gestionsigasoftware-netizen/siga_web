-- SIGA - Limpieza del seed de carga visual.
-- SOLO elimina filas marcadas por seed_datos_prueba.sql en la congregacion
-- demo (es_demo = true) y, ademas, solo las que llevan el marcador
-- 'SIGA_PRUEBA_CARGA' (o el patron de nombre equivalente) en cada tabla.
-- Esa doble condicion (congregacion demo + marcador) es a proposito: nunca
-- toca datos reales, ni siquiera si algun dia hay mas de una congregacion
-- de prueba o datos reales cargados por error en la demo.
-- Ejecutar despues de terminar las pruebas.
--
-- Actualizado 2026-09-01: se agrego la limpieza de los 8 modulos que
-- seed_datos_prueba.sql siembra desde esta sesion (Red de Familias,
-- Escuela Dominical, Damas Dorcas, Obra Carcelaria, Musica, Educacion
-- Artistica, Educacion Teologica, Conquistadores Pentecostales y Obra
-- Social) para que este script siga siendo la forma completa de borrar
-- todo lo sembrado, sin dejar residuos de las tablas nuevas.

begin;

do $$
declare
  v_congregacion_id uuid;
  v_distrito_id uuid;
begin
  select id into v_congregacion_id
  from congregaciones
  where es_demo = true
  order by created_at
  limit 1;

  if v_congregacion_id is null then
    raise exception 'No existe una congregacion demo.';
  end if;
  select distrito_id into v_distrito_id from congregaciones where id = v_congregacion_id;

  delete from obra_social_ayudas where caso_id in (select id from obra_social_casos where congregacion_id = v_congregacion_id and notas = 'SIGA_PRUEBA_CARGA');
  delete from obra_social_casos where congregacion_id = v_congregacion_id and notas = 'SIGA_PRUEBA_CARGA';
  delete from red_familias_casos where congregacion_id = v_congregacion_id and notas_confidenciales = 'SIGA_PRUEBA_CARGA';
  delete from conquistadores_asistencia where actividad_id in (select id from conquistadores_actividades where congregacion_id = v_congregacion_id and descripcion = 'SIGA_PRUEBA_CARGA');
  delete from conquistadores_actividades where congregacion_id = v_congregacion_id and descripcion = 'SIGA_PRUEBA_CARGA';
  delete from conquistadores_miembros where congregacion_id = v_congregacion_id and persona_id in (select id from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA');
  delete from teologica_asistencia where sesion_id in (select s.id from teologica_sesiones s join teologica_grupos g on g.id = s.grupo_id where g.congregacion_id = v_congregacion_id and g.nombre like 'SIGA_PRUEBA_CARGA%');
  delete from teologica_sesiones where grupo_id in (select id from teologica_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%');
  delete from teologica_integrantes where congregacion_id = v_congregacion_id and grupo_id in (select id from teologica_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%');
  delete from teologica_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%';
  delete from artistica_asistencia where sesion_id in (select s.id from artistica_sesiones s join artistica_grupos g on g.id = s.grupo_id where g.congregacion_id = v_congregacion_id and g.nombre like 'SIGA_PRUEBA_CARGA%');
  delete from artistica_sesiones where grupo_id in (select id from artistica_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%');
  delete from artistica_integrantes where congregacion_id = v_congregacion_id and grupo_id in (select id from artistica_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%');
  delete from artistica_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%';
  delete from musica_asistencia where sesion_id in (select s.id from musica_sesiones s join musica_grupos g on g.id = s.grupo_id where g.congregacion_id = v_congregacion_id and g.nombre like 'SIGA_PRUEBA_CARGA%');
  delete from musica_sesiones where grupo_id in (select id from musica_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%');
  delete from musica_integrantes where congregacion_id = v_congregacion_id and grupo_id in (select id from musica_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%');
  delete from musica_grupos where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%';
  delete from obra_carcelaria_seguimiento_familiar where congregacion_id = v_congregacion_id and notas = 'SIGA_PRUEBA_CARGA';
  delete from obra_carcelaria_asistencia where culto_id in (select id from obra_carcelaria_cultos where congregacion_id = v_congregacion_id and notas = 'SIGA_PRUEBA_CARGA');
  delete from obra_carcelaria_cultos where congregacion_id = v_congregacion_id and notas = 'SIGA_PRUEBA_CARGA';
  delete from obra_carcelaria_internos where congregacion_id = v_congregacion_id and observaciones = 'SIGA_PRUEBA_CARGA';
  delete from obra_carcelaria_delegados where congregacion_id = v_congregacion_id and observaciones = 'SIGA_PRUEBA_CARGA';
  if v_distrito_id is not null then
    delete from centros_reclusion where distrito_id = v_distrito_id and nombre like 'SIGA_PRUEBA_CARGA%';
  end if;
  delete from damas_dorcas_asistencia where actividad_id in (select id from damas_dorcas_actividades where congregacion_id = v_congregacion_id and descripcion = 'SIGA_PRUEBA_CARGA');
  delete from damas_dorcas_actividades where congregacion_id = v_congregacion_id and descripcion = 'SIGA_PRUEBA_CARGA';
  delete from damas_dorcas_beneficiarias where congregacion_id = v_congregacion_id and direccion = 'SIGA_PRUEBA_CARGA';
  delete from escuela_dominical_asistencia where leccion_id in (select l.id from escuela_dominical_lecciones l join escuela_dominical_clases c on c.id = l.clase_id where c.congregacion_id = v_congregacion_id and c.nombre like 'SIGA_PRUEBA_CARGA%');
  delete from escuela_dominical_lecciones where clase_id in (select id from escuela_dominical_clases where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%');
  delete from escuela_dominical_ninos where congregacion_id = v_congregacion_id and acudiente_nombre = 'SIGA_PRUEBA_CARGA';
  delete from escuela_dominical_maestros where congregacion_id = v_congregacion_id and persona_id in (select id from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA');
  delete from escuela_dominical_clases where congregacion_id = v_congregacion_id and nombre like 'SIGA_PRUEBA_CARGA%';
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

  raise notice 'Datos de prueba eliminados de la congregacion demo (incluye los 8 modulos agregados en esta sesion).';
end $$;

commit;

select 'personas' as entidad, count(*) as filas from personas where observaciones_pastorales = 'SIGA_PRUEBA_CARGA'
union all select 'familias', count(*) from familias where nombre_familia like 'SIGA_PRUEBA_CARGA%'
union all select 'comites', count(*) from comites where descripcion = 'SIGA_PRUEBA_CARGA'
union all select 'seguimientos', count(*) from seguimientos_pastorales where notas = 'SIGA_PRUEBA_CARGA'
union all select 'asistencias', count(*) from registros_actividad where novedades = 'SIGA_PRUEBA_CARGA'
union all select 'instituciones juveniles', count(*) from mision_instituciones where notas = 'SIGA_PRUEBA_CARGA'
union all select 'estudiantes juveniles', count(*) from mision_estudiantes where notas = 'SIGA_PRUEBA_CARGA'
union all select 'grupos juveniles', count(*) from mision_grupos where nombre like 'SIGA_PRUEBA_CARGA%'
union all select 'casos red de familias', count(*) from red_familias_casos where notas_confidenciales = 'SIGA_PRUEBA_CARGA'
union all select 'clases escuela dominical', count(*) from escuela_dominical_clases where nombre like 'SIGA_PRUEBA_CARGA%'
union all select 'ninos escuela dominical', count(*) from escuela_dominical_ninos where acudiente_nombre = 'SIGA_PRUEBA_CARGA'
union all select 'beneficiarias damas dorcas', count(*) from damas_dorcas_beneficiarias where direccion = 'SIGA_PRUEBA_CARGA'
union all select 'internos obra carcelaria', count(*) from obra_carcelaria_internos where observaciones = 'SIGA_PRUEBA_CARGA'
union all select 'grupos musica', count(*) from musica_grupos where nombre like 'SIGA_PRUEBA_CARGA%'
union all select 'grupos artistica', count(*) from artistica_grupos where nombre like 'SIGA_PRUEBA_CARGA%'
union all select 'grupos teologia', count(*) from teologica_grupos where nombre like 'SIGA_PRUEBA_CARGA%'
union all select 'conquistadores', count(*) from conquistadores_miembros mc join personas p on p.id = mc.persona_id where p.congregacion_id in (select id from congregaciones where es_demo = true) and p.observaciones_pastorales = 'SIGA_PRUEBA_CARGA'
union all select 'casos obra social', count(*) from obra_social_casos where notas = 'SIGA_PRUEBA_CARGA';
