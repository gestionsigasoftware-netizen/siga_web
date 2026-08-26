-- SIGA - Seed de carga visual para pruebas.
-- SOLO usar en una base de pruebas. No ejecutar en produccion.
-- Requiere schema.sql, accesos.sql, feligresia.sql, evangelismo.sql,
-- mision_juvenil.sql, configuracion.sql y notificaciones.sql.
-- Ejecutar este archivo completo desde Supabase SQL Editor.

begin;

do $$
declare
  v_congregacion_id uuid;
  v_modulo_id uuid;
  v_evangelismo_id uuid;
  v_mision_id uuid;
  v_tipo_custom_id uuid;
  v_persona_id uuid;
  v_familia_id uuid;
  v_comite_id uuid;
  v_etapa_id uuid;
  v_usuario_id uuid;
  v_capturador_id uuid;
  v_institucion_id uuid;
  v_grupo_id uuid;
  v_leccion_id uuid;
  v_estudiante_id uuid;
  v_familias uuid[] := '{}';
  v_personas uuid[] := '{}';
  v_comites uuid[] := '{}';
  v_zonas uuid[] := '{}';
  v_zonas_mision uuid[] := '{}';
  v_etapas uuid[] := '{}';
  v_categorias uuid[];
  v_tipos uuid[];
  v_metodologias uuid[];
  v_instituciones uuid[] := '{}';
  v_estudiantes uuid[] := '{}';
  v_i integer;
  v_j integer;
  v_estado text;
  v_bautizado boolean;
begin
  select id into v_congregacion_id from congregaciones where es_demo = true order by created_at limit 1;
  if v_congregacion_id is null then
    raise exception 'No existe una congregacion demo. Ejecuta primero crear_congregacion_demo() y usuario_prueba_local.sql.';
  end if;

  -- Limpia solo filas creadas por este seed para permitir repetirlo.
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

  select id into v_modulo_id from modulos where congregacion_id = v_congregacion_id order by created_at limit 1;
  select array_agg(id order by orden) into v_categorias from categorias_demograficas where congregacion_id = v_congregacion_id;
  select array_agg(id order by nombre) into v_tipos from tipos_actividad where modulo_id = v_modulo_id;
  select array_agg(id order by orden) into v_etapas from etapas_seguimiento where congregacion_id = v_congregacion_id;
  if v_modulo_id is null or coalesce(array_length(v_categorias, 1), 0) < 3 or coalesce(array_length(v_tipos, 1), 0) = 0 or coalesce(array_length(v_etapas, 1), 0) = 0 then
    raise exception 'La congregacion demo no tiene modulos, categorias o etapas configurados.';
  end if;

  select id into v_evangelismo_id from modulos where congregacion_id = v_congregacion_id and lower(nombre_modulo) = 'evangelismo' limit 1;
  select id into v_mision_id from modulos where congregacion_id = v_congregacion_id and lower(nombre_modulo) = 'mision juvenil' limit 1;
  if v_evangelismo_id is null then
    insert into modulos (congregacion_id, nombre_modulo, alcance, requiere_zona) values (v_congregacion_id, 'Evangelismo', 'extramural', true) returning id into v_evangelismo_id;
  end if;
  if v_mision_id is null then
    insert into modulos (congregacion_id, nombre_modulo, alcance, requiere_zona) values (v_congregacion_id, 'Mision Juvenil', 'extramural', true) returning id into v_mision_id;
  end if;
  insert into tipos_actividad (modulo_id, nombre, caracter)
  select v_evangelismo_id, nombre, 'Evangelismo'
  from unnest(array['REFAM', 'Culto de barrio', 'Celula', 'Discipulado', 'Visita']) as actividades(nombre)
  where not exists (select 1 from tipos_actividad where modulo_id = v_evangelismo_id and lower(tipos_actividad.nombre) = lower(actividades.nombre));
  insert into tipos_actividad (modulo_id, nombre, caracter)
  select v_mision_id, nombre, 'Mision Juvenil'
  from unnest(array['Charla de valores', 'REFAM Juvenil', 'Celula Juvenil', 'Discipulado Juvenil', 'Culto Juvenil']) as actividades(nombre)
  where not exists (select 1 from tipos_actividad where modulo_id = v_mision_id and lower(tipos_actividad.nombre) = lower(actividades.nombre));
  insert into tipos_actividad (modulo_id, nombre, caracter) values (v_modulo_id, 'Culto especial de prueba', 'SIGA_PRUEBA_CARGA') returning id into v_tipo_custom_id;
  select array_agg(id order by nombre) into v_metodologias from tipos_actividad where modulo_id = v_evangelismo_id and activo = true;
  if coalesce(array_length(v_metodologias, 1), 0) = 0 then raise exception 'Evangelismo no tiene metodologias activas.'; end if;

  select auth_user_id into v_capturador_id from personas where congregacion_id = v_congregacion_id and auth_user_id is not null order by created_at limit 1;
  if v_capturador_id is null then select id into v_capturador_id from auth.users order by created_at limit 1; end if;
  if v_capturador_id is null then raise exception 'Se necesita al menos un usuario Auth para crear registros.'; end if;

  for v_i in 1..35 loop
    insert into familias (congregacion_id, nombre_familia, direccion, telefono) values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Familia %s', lpad(v_i::text, 3, '0')), format('Carrera %s # %s-%s', 10 + (v_i % 20), 12 + (v_i % 40), v_i), format('300555%04s', v_i)) returning id into v_familia_id;
    v_familias := array_append(v_familias, v_familia_id);
  end loop;

  for v_i in 1..240 loop
    v_estado := case when v_i % 31 = 0 then 'fallecido' when v_i % 23 = 0 then 'trasladado' when v_i % 17 = 0 then 'inactivo' when v_i % 11 = 0 then 'apartado' else 'activo' end;
    v_bautizado := v_i % 3 <> 0;
    insert into personas (congregacion_id, nombres, apellidos, telefono, fecha_nacimiento, estado_membresia, bautizado, fecha_bautismo, fecha_ingreso, fecha_ultima_asistencia, familia_id, parentesco_familiar, observaciones_pastorales)
    values (v_congregacion_id, format('Persona Prueba %s', lpad(v_i::text, 3, '0')), format('Carga SIGA %s', lpad(((v_i - 1) % 60 + 1)::text, 3, '0')), format('301700%04s', v_i), current_date - ((18 + (v_i % 55)) * 365 + (v_i % 365)), v_estado, v_bautizado, case when v_bautizado then current_date - ((1 + (v_i % 15)) * 365) else null end, current_date - (v_i % 1460), case when v_i % 13 = 0 then null else current_date - (v_i % 100) end, v_familias[((v_i - 1) % array_length(v_familias, 1)) + 1], case when v_i % 5 = 0 then 'cabeza' when v_i % 2 = 0 then 'hijo' else 'conyuge' end, 'SIGA_PRUEBA_CARGA') returning id into v_persona_id;
    v_personas := array_append(v_personas, v_persona_id);
  end loop;

  for v_i in 1..8 loop
    insert into zonas (congregacion_id, modulo_id, nombre) values (v_congregacion_id, v_modulo_id, format('SIGA_PRUEBA_CARGA Zona %s', lpad(v_i::text, 2, '0'))) returning id into v_persona_id;
    v_zonas := array_append(v_zonas, v_persona_id);
  end loop;
  for v_i in 1..8 loop
    insert into zonas (congregacion_id, modulo_id, nombre, lider_persona_id) values (v_congregacion_id, v_evangelismo_id, format('SIGA_PRUEBA_CARGA Zona Evangelismo %s', lpad(v_i::text, 2, '0')), v_personas[((v_i - 1) % array_length(v_personas, 1)) + 1]) returning id into v_persona_id;
    v_zonas := array_append(v_zonas, v_persona_id);
  end loop;
  for v_i in 1..8 loop
    insert into zonas (congregacion_id, modulo_id, nombre, lider_persona_id) values (v_congregacion_id, v_mision_id, format('SIGA_PRUEBA_CARGA Zona Juvenil %s', lpad(v_i::text, 2, '0')), v_personas[((v_i + 20) % array_length(v_personas, 1)) + 1]) returning id into v_persona_id;
    v_zonas_mision := array_append(v_zonas_mision, v_persona_id);
  end loop;

  for v_i in 1..10 loop
    insert into comites (congregacion_id, nombre, descripcion, activo) values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Comite %s', lpad(v_i::text, 2, '0')), 'SIGA_PRUEBA_CARGA', v_i % 7 <> 0) returning id into v_comite_id;
    v_comites := array_append(v_comites, v_comite_id);
    for v_j in 1..24 loop insert into membresias_comite (comite_id, persona_id, cargo, fecha_inicio) values (v_comite_id, v_personas[((v_j + array_length(v_comites, 1) * 3) % array_length(v_personas, 1)) + 1], case when v_j = 1 then 'Presidente' when v_j = 2 then 'Secretaria' else 'Integrante' end, current_date - (v_j % 700)); end loop;
  end loop;
  for v_i in 1..140 loop insert into historial_cargos (persona_id, nombre_cargo, area, fecha_inicio, fecha_fin, observaciones) values (v_personas[((v_i - 1) % array_length(v_personas, 1)) + 1], format('Cargo de prueba %s', lpad(v_i::text, 3, '0')), case when v_i % 2 = 0 then 'Liderazgo' else 'Servicio' end, current_date - (v_i % 1000), case when v_i % 4 = 0 then current_date - (v_i % 40) else null end, 'SIGA_PRUEBA_CARGA'); end loop;
  for v_i in 1..260 loop
    insert into seguimientos_pastorales (congregacion_id, persona_id, tipo_alerta, accion, notas, fecha, proxima_fecha, estado) values (v_congregacion_id, v_personas[((v_i - 1) % array_length(v_personas, 1)) + 1], case when v_i % 3 = 0 then 'asistencia_persona' when v_i % 3 = 1 then 'bautismo' else 'general' end, format('Contacto pastoral de prueba %s', v_i), 'SIGA_PRUEBA_CARGA', current_date - (v_i % 180), case when v_i % 4 = 0 then current_date - (v_i % 30) when v_i % 4 = 1 then current_date + (1 + v_i % 45) else null end, case when v_i % 5 = 0 then 'completado' when v_i % 7 = 0 then 'cancelado' else 'pendiente' end);
  end loop;

  for v_i in 1..120 loop
    select id into v_etapa_id from etapas_seguimiento where congregacion_id = v_congregacion_id order by orden offset ((v_i - 1) % array_length(v_etapas, 1)) limit 1;
    insert into amigos (congregacion_id, nombres, telefono, direccion, sector, invitado_por, fecha_primer_contacto, zona_id, evangelismo_metodologia_id, etapa_id, convertido, categoria_asignada_id) values (v_congregacion_id, format('Amigo Prueba %s Carga', lpad(v_i::text, 3, '0')), format('302800%04s', v_i), format('Calle %s # %s', 20 + (v_i % 30), v_i), format('Sector %s', 1 + (v_i % 8)), format('Persona Prueba %s', 1 + (v_i % 40)), current_date - (v_i % 420), v_zonas[8 + ((v_i - 1) % 8) + 1], v_metodologias[((v_i - 1) % array_length(v_metodologias, 1)) + 1], v_etapa_id, v_i % 6 = 0, v_categorias[((v_i - 1) % array_length(v_categorias, 1)) + 1]);
  end loop;

  for v_i in 1..4 loop
    insert into mision_instituciones (congregacion_id, nombre, tipo, nivel, direccion, contacto_nombre, contacto_cargo, fase, notas) values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Institucion %s', lpad(v_i::text, 2, '0')), case when v_i % 2 = 0 then 'privada' else 'publica' end, case when v_i = 4 then 'universidad' else 'bachillerato' end, format('Carrera %s # %s', 5 + v_i, 10 + v_i), format('Contacto %s', v_i), 'Coordinacion', ((v_i - 1) % 3) + 1, 'SIGA_PRUEBA_CARGA') returning id into v_institucion_id;
    v_instituciones := array_append(v_instituciones, v_institucion_id);
  end loop;
  for v_i in 1..60 loop
    insert into mision_estudiantes (congregacion_id, institucion_id, tutor_persona_id, nombres, apellidos, grado_semestre, telefono, estado, notas) values (v_congregacion_id, v_instituciones[((v_i - 1) % 4) + 1], v_personas[((v_i - 1) % 240) + 1], format('Estudiante Prueba %s', lpad(v_i::text, 3, '0')), format('Mision SIGA %s', lpad(((v_i - 1) % 15 + 1)::text, 2, '0')), format('%s grado', 6 + (v_i % 6)), format('304900%04s', v_i), case when v_i % 11 = 0 then 'bautizado' when v_i % 5 = 0 then 'discipulado' when v_i % 3 = 0 then 'refam' else 'simpatizante' end, 'SIGA_PRUEBA_CARGA') returning id into v_estudiante_id;
  end loop;
  for v_i in 1..6 loop
    insert into mision_grupos (congregacion_id, institucion_id, nombre, direccion, lider_persona_id, leccion_actual, lecciones_total) values (v_congregacion_id, v_instituciones[((v_i - 1) % 4) + 1], format('SIGA_PRUEBA_CARGA Grupo Juvenil %s', lpad(v_i::text, 2, '0')), format('Salon %s', v_i), v_personas[((v_i + 10) % 240) + 1], 2 + (v_i % 7), 10) returning id into v_grupo_id;
    for v_j in 1..4 loop
      insert into mision_lecciones (grupo_id, numero, tema, fecha, asistentes, notas) values (v_grupo_id, v_j, format('Leccion juvenil %s', v_j), current_date - ((v_i * 7) + v_j), 8 + ((v_i + v_j) % 12), 'SIGA_PRUEBA_CARGA') returning id into v_leccion_id;
      insert into mision_asistencia_estudiante (leccion_id, estudiante_id)
      select v_leccion_id, e.id
      from mision_estudiantes e
      where e.congregacion_id = v_congregacion_id
        and e.notas = 'SIGA_PRUEBA_CARGA'
        and e.institucion_id = (select institucion_id from mision_grupos where id = v_grupo_id)
      order by e.created_at
      offset ((v_i + v_j) % 15)
      limit 1;
    end loop;
  end loop;
  insert into mision_lideres (congregacion_id, persona_id, rol) select v_congregacion_id, id, case when row_number() over (order by created_at) = 1 then 'coordinador' else 'gestor' end from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA' order by created_at limit 5 on conflict (congregacion_id, persona_id) do update set activo = true;

  for v_i in 1..720 loop
    insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, capturado_por, responsable_persona_id, fecha, novedades, desglose) values (v_congregacion_id, v_modulo_id, v_tipos[((v_i - 1) % array_length(v_tipos, 1)) + 1], v_capturador_id, v_personas[((v_i - 1) % 240) + 1], current_date - (720 - v_i), 'SIGA_PRUEBA_CARGA', jsonb_build_object(v_categorias[1]::text, 8 + (v_i % 18), v_categorias[2]::text, 12 + ((v_i * 2) % 24), v_categorias[3]::text, 7 + ((v_i * 3) % 20)));
  end loop;
  insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, nombre_actividad, capturado_por, responsable_persona_id, fecha, novedades, desglose) values (v_congregacion_id, v_modulo_id, v_tipo_custom_id, 'Culto especial de prueba', v_capturador_id, v_personas[1], current_date - 2, 'SIGA_PRUEBA_CARGA', jsonb_build_object(v_categorias[1]::text, 14, v_categorias[2]::text, 18, v_categorias[3]::text, 11));
  for v_i in 1..90 loop insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, capturado_por, responsable_persona_id, fecha, zona_id, novedades, desglose) values (v_congregacion_id, v_evangelismo_id, v_metodologias[((v_i - 1) % array_length(v_metodologias, 1)) + 1], v_capturador_id, v_personas[((v_i - 1) % 240) + 1], current_date - (v_i % 180), v_zonas[8 + ((v_i - 1) % 8) + 1], 'SIGA_PRUEBA_CARGA', jsonb_build_object(v_categorias[1]::text, 4 + (v_i % 8), v_categorias[2]::text, 5 + (v_i % 10), v_categorias[3]::text, 3 + (v_i % 7))); end loop;
  for v_i in 1..90 loop insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, capturado_por, responsable_persona_id, fecha, zona_id, novedades, desglose) values (v_congregacion_id, v_mision_id, (select id from tipos_actividad where modulo_id = v_mision_id order by nombre offset ((v_i - 1) % 5) limit 1), v_capturador_id, v_personas[((v_i + 20) % 240) + 1], current_date - (v_i % 180), v_zonas_mision[((v_i - 1) % 8) + 1], 'SIGA_PRUEBA_CARGA', jsonb_build_object(v_categorias[1]::text, 5 + (v_i % 7), v_categorias[2]::text, 6 + (v_i % 9), v_categorias[3]::text, 4 + (v_i % 8))); end loop;

  insert into configuracion_congregacion (congregacion_id, umbral_alerta, modulo_predeterminado, exigir_responsable, exigir_novedades) values (v_congregacion_id, 18, v_evangelismo_id, true, false) on conflict (congregacion_id) do update set umbral_alerta = excluded.umbral_alerta, modulo_predeterminado = excluded.modulo_predeterminado, exigir_responsable = excluded.exigir_responsable, exigir_novedades = excluded.exigir_novedades;
  insert into preferencias_usuario (usuario_id, recibir_notificaciones, recibir_alertas, formato_fecha) values (v_capturador_id, true, true, 'DD/MM/AAAA') on conflict (usuario_id) do update set recibir_notificaciones = excluded.recibir_notificaciones, recibir_alertas = excluded.recibir_alertas, formato_fecha = excluded.formato_fecha;
  select auth_user_id into v_usuario_id from personas where id = v_personas[1];
  if v_usuario_id is null then v_usuario_id := v_capturador_id; end if;
  for v_i in 1..45 loop insert into notificaciones (usuario_id, titulo, mensaje, tipo, enlace, leida) values (v_usuario_id, format('SIGA_PRUEBA_CARGA Aviso %s', v_i), 'Notificacion generada para probar el centro de notificaciones.', case when v_i % 4 = 0 then 'danger' when v_i % 3 = 0 then 'warning' else 'info' end, '/feligresia?tab=historial', v_i % 5 = 0); end loop;
  raise notice 'Seed listo: 240 personas, 35 familias, 10 comites, 260 seguimientos, 120 amigos, 901 asistencias, 60 estudiantes, 6 grupos y 45 notificaciones.';
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