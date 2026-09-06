-- SIGA - Seed de carga visual para pruebas.
-- SOLO usar en una base de pruebas. No ejecutar en produccion.
-- Requiere schema.sql, accesos.sql, feligresia.sql, evangelismo.sql,
-- mision_juvenil.sql, configuracion.sql, notificaciones.sql, red_familias.sql,
-- escuela_dominical_damas_dorcas.sql, pastoral_distrital.sql,
-- obra_carcelaria.sql, formacion_musica_artistica_teologica.sql,
-- conquistadores_obra_social.sql y censo_bautizados_sellados.sql.
-- Ejecutar este archivo completo desde Supabase SQL Editor.
--
-- Actualizado 2026-09-01: las fechas de todo el volumen historico
-- (asistencia, seguimientos, amigos, sesiones de cada comite) ahora se
-- distribuyen explicitamente entre el 2025-01-01 y la fecha de hoy, para
-- poder revisar como se ve la carga real de informacion (tendencias,
-- graficos, consolidados) en un rango de casi 2 anos. Se agrego seed para
-- los 8 modulos construidos esta sesion que antes no tenian ningun dato de
-- prueba: Escuela Dominical, Damas Dorcas, Obra Carcelaria, Musica,
-- Educacion Artistica, Educacion Teologica, Conquistadores Pentecostales,
-- Obra Social y Red de Familias. Tambien se agrego sellado_espiritu_santo
-- a las personas del censo (antes solo se sembraba bautizado).

begin;

do $$
declare
  v_congregacion_id uuid;
  v_distrito_id uuid;
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
  v_clase_id uuid;
  v_nino_id uuid;
  v_beneficiaria_id uuid;
  v_actividad_id uuid;
  v_centro_id uuid;
  v_centro2_id uuid;
  v_interno_id uuid;
  v_culto_id uuid;
  v_musica_grupo_id uuid;
  v_musica_integrante_id uuid;
  v_musica_sesion_id uuid;
  v_artistica_grupo_id uuid;
  v_artistica_integrante_id uuid;
  v_artistica_sesion_id uuid;
  v_teologica_grupo_id uuid;
  v_teologica_integrante_id uuid;
  v_teologica_sesion_id uuid;
  v_conquistador_id uuid;
  v_caso_id uuid;
  v_rf_caso_id uuid;
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
  v_clases uuid[] := '{}';
  v_ninos uuid[] := '{}';
  v_beneficiarias uuid[] := '{}';
  v_internos uuid[] := '{}';
  v_musica_grupos uuid[] := '{}';
  v_musica_integrantes uuid[] := '{}';
  v_artistica_grupos uuid[] := '{}';
  v_artistica_integrantes uuid[] := '{}';
  v_teologica_grupos uuid[] := '{}';
  v_teologica_integrantes uuid[] := '{}';
  v_conquistadores uuid[] := '{}';
  v_rf_casos uuid[] := '{}';
  v_i integer;
  v_j integer;
  v_estado text;
  v_bautizado boolean;
  v_sellado boolean;
  v_base_2025 date := '2025-01-01'::date;
  v_dias_totales integer;
begin
  select id into v_congregacion_id from congregaciones where es_demo = true order by created_at limit 1;
  if v_congregacion_id is null then
    raise exception 'No existe una congregacion demo. Ejecuta primero crear_congregacion_demo() y usuario_prueba_local.sql.';
  end if;
  select distrito_id into v_distrito_id from congregaciones where id = v_congregacion_id;
  v_dias_totales := greatest(current_date - v_base_2025, 1);

  -- Limpia solo filas creadas por este seed para permitir repetirlo.
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
  delete from centros_reclusion where distrito_id = v_distrito_id and nombre like 'SIGA_PRUEBA_CARGA%';
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
    -- Bautizado y sellado son hitos independientes (aclarado por el usuario): no siempre coinciden.
    v_sellado := v_i % 4 <> 0;
    insert into personas (congregacion_id, nombres, apellidos, telefono, fecha_nacimiento, estado_membresia, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ingreso, fecha_ultima_asistencia, familia_id, parentesco_familiar, observaciones_pastorales)
    values (v_congregacion_id, format('Persona Prueba %s', lpad(v_i::text, 3, '0')), format('Carga SIGA %s', lpad(((v_i - 1) % 60 + 1)::text, 3, '0')), format('301700%04s', v_i), current_date - ((18 + (v_i % 55)) * 365 + (v_i % 365)), v_estado, v_bautizado, case when v_bautizado then v_base_2025 + (v_i * v_dias_totales / 240) else null end, v_sellado, case when v_sellado then v_base_2025 + (((v_i * 7) % 240) * v_dias_totales / 240) else null end, current_date - (v_i % 1460), case when v_i % 13 = 0 then null else current_date - (v_i % 100) end, v_familias[((v_i - 1) % array_length(v_familias, 1)) + 1], case when v_i % 5 = 0 then 'cabeza' when v_i % 2 = 0 then 'hijo' else 'conyuge' end, 'SIGA_PRUEBA_CARGA') returning id into v_persona_id;
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
    for v_j in 1..24 loop
      -- Solo se asignan personas bautizadas al comite (requisito real ya exigido por el trigger validar_requisitos_comite()).
      insert into membresias_comite (comite_id, persona_id, cargo, fecha_inicio)
      select v_comite_id, p.id, case when v_j = 1 then 'Presidente' when v_j = 2 then 'Secretaria' else 'Integrante' end, current_date - (v_j % 700)
      from personas p where p.congregacion_id = v_congregacion_id and p.bautizado and p.observaciones_pastorales = 'SIGA_PRUEBA_CARGA'
      order by p.created_at, p.id offset ((v_j + array_length(v_comites, 1) * 3) % 150) limit 1
      on conflict do nothing;
    end loop;
  end loop;
  for v_i in 1..140 loop insert into historial_cargos (persona_id, nombre_cargo, area, fecha_inicio, fecha_fin, observaciones) values (v_personas[((v_i - 1) % array_length(v_personas, 1)) + 1], format('Cargo de prueba %s', lpad(v_i::text, 3, '0')), case when v_i % 2 = 0 then 'Liderazgo' else 'Servicio' end, current_date - (v_i % 1000), case when v_i % 4 = 0 then current_date - (v_i % 40) else null end, 'SIGA_PRUEBA_CARGA'); end loop;
  for v_i in 1..260 loop
    insert into seguimientos_pastorales (congregacion_id, persona_id, tipo_alerta, accion, notas, fecha, proxima_fecha, estado) values (v_congregacion_id, v_personas[((v_i - 1) % array_length(v_personas, 1)) + 1], case when v_i % 3 = 0 then 'asistencia_persona' when v_i % 3 = 1 then 'bautismo' else 'general' end, format('Contacto pastoral de prueba %s', v_i), 'SIGA_PRUEBA_CARGA', v_base_2025 + (v_i * v_dias_totales / 260), case when v_i % 4 = 0 then current_date - (v_i % 30) when v_i % 4 = 1 then current_date + (1 + v_i % 45) else null end, case when v_i % 5 = 0 then 'completado' when v_i % 7 = 0 then 'cancelado' else 'pendiente' end);
  end loop;

  for v_i in 1..120 loop
    select id into v_etapa_id from etapas_seguimiento where congregacion_id = v_congregacion_id order by orden offset ((v_i - 1) % array_length(v_etapas, 1)) limit 1;
    insert into amigos (congregacion_id, nombres, telefono, direccion, sector, invitado_por, fecha_primer_contacto, zona_id, evangelismo_metodologia_id, etapa_id, convertido, categoria_asignada_id, estado_espiritual, bautizado, fecha_bautismo, sellado, fecha_sellado)
    values (
      v_congregacion_id, format('Amigo Prueba %s Carga', lpad(v_i::text, 3, '0')), format('302800%04s', v_i), format('Calle %s # %s', 20 + (v_i % 30), v_i), format('Sector %s', 1 + (v_i % 8)), format('Persona Prueba %s', 1 + (v_i % 40)), v_base_2025 + (v_i * v_dias_totales / 120), v_zonas[8 + ((v_i - 1) % 8) + 1], v_metodologias[((v_i - 1) % array_length(v_metodologias, 1)) + 1], v_etapa_id, v_i % 6 = 0, v_categorias[((v_i - 1) % array_length(v_categorias, 1)) + 1],
      case when v_i % 6 = 0 then 'bautizado' else 'en_ruta' end,
      v_i % 6 = 0, case when v_i % 6 = 0 then v_base_2025 + (v_i * v_dias_totales / 120) else null end,
      -- Algunos amigos ya sellados aunque aun no bautizados (hito independiente que pidio el usuario medir).
      v_i % 9 = 0, case when v_i % 9 = 0 then v_base_2025 + (((v_i * 5) % 120) * v_dias_totales / 120) else null end
    );
  end loop;

  for v_i in 1..4 loop
    insert into mision_instituciones (congregacion_id, nombre, tipo, nivel, direccion, contacto_nombre, contacto_cargo, fase, notas) values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Institucion %s', lpad(v_i::text, 2, '0')), case when v_i % 2 = 0 then 'privada' else 'publica' end, case when v_i = 4 then 'universidad' else 'bachillerato' end, format('Carrera %s # %s', 5 + v_i, 10 + v_i), format('Contacto %s', v_i), 'Coordinacion', ((v_i - 1) % 3) + 1, 'SIGA_PRUEBA_CARGA') returning id into v_institucion_id;
    v_instituciones := array_append(v_instituciones, v_institucion_id);
  end loop;
  for v_i in 1..60 loop
    v_bautizado := v_i % 11 = 0;
    insert into mision_estudiantes (congregacion_id, institucion_id, tutor_persona_id, nombres, apellidos, grado_semestre, telefono, estado, notas, bautizado, fecha_bautismo, sellado, fecha_sellado)
    values (v_congregacion_id, v_instituciones[((v_i - 1) % 4) + 1], v_personas[((v_i - 1) % 240) + 1], format('Estudiante Prueba %s', lpad(v_i::text, 3, '0')), format('Mision SIGA %s', lpad(((v_i - 1) % 15 + 1)::text, 2, '0')), format('%s grado', 6 + (v_i % 6)), format('304900%04s', v_i), case when v_bautizado then 'bautizado' when v_i % 5 = 0 then 'discipulado' when v_i % 3 = 0 then 'refam' else 'simpatizante' end, 'SIGA_PRUEBA_CARGA',
      v_bautizado, case when v_bautizado then v_base_2025 + (v_i * v_dias_totales / 60) else null end,
      v_i % 7 = 0, case when v_i % 7 = 0 then v_base_2025 + (((v_i * 3) % 60) * v_dias_totales / 60) else null end
    ) returning id into v_estudiante_id;
  end loop;
  for v_i in 1..6 loop
    insert into mision_grupos (congregacion_id, institucion_id, nombre, direccion, lider_persona_id, leccion_actual, lecciones_total) values (v_congregacion_id, v_instituciones[((v_i - 1) % 4) + 1], format('SIGA_PRUEBA_CARGA Grupo Juvenil %s', lpad(v_i::text, 2, '0')), format('Salon %s', v_i), v_personas[((v_i + 10) % 240) + 1], 2 + (v_i % 7), 10) returning id into v_grupo_id;
    for v_j in 1..4 loop
      insert into mision_lecciones (grupo_id, numero, tema, fecha, asistentes, notas) values (v_grupo_id, v_j, format('Leccion juvenil %s', v_j), v_base_2025 + (((v_i * 4 + v_j) * v_dias_totales) / 24), 8 + ((v_i + v_j) % 12), 'SIGA_PRUEBA_CARGA') returning id into v_leccion_id;
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
    insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, capturado_por, responsable_persona_id, fecha, novedades, desglose) values (v_congregacion_id, v_modulo_id, v_tipos[((v_i - 1) % array_length(v_tipos, 1)) + 1], v_capturador_id, v_personas[((v_i - 1) % 240) + 1], v_base_2025 + (v_i * v_dias_totales / 720), 'SIGA_PRUEBA_CARGA', jsonb_build_object(v_categorias[1]::text, 8 + (v_i % 18), v_categorias[2]::text, 12 + ((v_i * 2) % 24), v_categorias[3]::text, 7 + ((v_i * 3) % 20)));
  end loop;
  insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, nombre_actividad, capturado_por, responsable_persona_id, fecha, novedades, desglose) values (v_congregacion_id, v_modulo_id, v_tipo_custom_id, 'Culto especial de prueba', v_capturador_id, v_personas[1], current_date - 2, 'SIGA_PRUEBA_CARGA', jsonb_build_object(v_categorias[1]::text, 14, v_categorias[2]::text, 18, v_categorias[3]::text, 11));
  for v_i in 1..90 loop insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, capturado_por, responsable_persona_id, fecha, zona_id, novedades, desglose) values (v_congregacion_id, v_evangelismo_id, v_metodologias[((v_i - 1) % array_length(v_metodologias, 1)) + 1], v_capturador_id, v_personas[((v_i - 1) % 240) + 1], v_base_2025 + (v_i * v_dias_totales / 90), v_zonas[8 + ((v_i - 1) % 8) + 1], 'SIGA_PRUEBA_CARGA', jsonb_build_object(v_categorias[1]::text, 4 + (v_i % 8), v_categorias[2]::text, 5 + (v_i % 10), v_categorias[3]::text, 3 + (v_i % 7))); end loop;
  for v_i in 1..90 loop insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, capturado_por, responsable_persona_id, fecha, zona_id, novedades, desglose) values (v_congregacion_id, v_mision_id, (select id from tipos_actividad where modulo_id = v_mision_id order by nombre offset ((v_i - 1) % 5) limit 1), v_capturador_id, v_personas[((v_i + 20) % 240) + 1], v_base_2025 + (v_i * v_dias_totales / 90), v_zonas_mision[((v_i - 1) % 8) + 1], 'SIGA_PRUEBA_CARGA', jsonb_build_object(v_categorias[1]::text, 5 + (v_i % 7), v_categorias[2]::text, 6 + (v_i % 9), v_categorias[3]::text, 4 + (v_i % 8))); end loop;

  -- ===========================================================================
  -- RED DE FAMILIAS (casos) — antes sin ningun dato de prueba. Obra Social
  -- se conecta a este mismo censo de familias, asi que se siembra primero.
  -- ===========================================================================
  for v_i in 1..15 loop
    insert into red_familias_casos (congregacion_id, familia_id, persona_id, tipo_necesidad, prioridad, estado, responsable_id, fecha_apertura, proxima_fecha, notas_confidenciales)
    values (v_congregacion_id, v_familias[((v_i - 1) % array_length(v_familias, 1)) + 1], v_personas[((v_i * 3) % 240) + 1],
      (array['acompanamiento_solicitado', 'visita_pendiente', 'orientacion', 'integracion', 'reactivacion', 'necesidad_identificada'])[1 + (v_i % 6)],
      (array['baja', 'media', 'alta'])[1 + (v_i % 3)],
      case when v_i % 5 = 0 then 'cerrado' when v_i % 3 = 0 then 'pausado' else 'activo' end,
      v_personas[((v_i * 7) % 240) + 1], v_base_2025 + (v_i * v_dias_totales / 15), current_date + (1 + v_i % 30), 'SIGA_PRUEBA_CARGA'
    ) returning id into v_rf_caso_id;
    v_rf_casos := array_append(v_rf_casos, v_rf_caso_id);
  end loop;

  -- ===========================================================================
  -- ESCUELA DOMINICAL (MISION INFANTIL)
  -- ===========================================================================
  for v_i in 1..4 loop
    insert into escuela_dominical_clases (congregacion_id, nombre, etapa, metodologia, maestro_lider_persona_id, leccion_actual, activo)
    values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Clase %s', lpad(v_i::text, 2, '0')), (array['Cuna', 'Párvulos', 'Primarios', 'Preadolescentes'])[v_i], 'Metodologia ludica', v_personas[((v_i * 5) % 240) + 1], 8 + v_i, true)
    returning id into v_clase_id;
    v_clases := array_append(v_clases, v_clase_id);
  end loop;
  for v_i in 1..60 loop
    insert into escuela_dominical_ninos (congregacion_id, clase_id, nombres, apellidos, fecha_nacimiento, acudiente_nombre, acudiente_telefono, estado, bautizado, fecha_bautismo, sellado, fecha_sellado)
    values (v_congregacion_id, v_clases[((v_i - 1) % 4) + 1], format('Nino Prueba %s', lpad(v_i::text, 3, '0')), format('Escuela SIGA %s', lpad(((v_i - 1) % 20 + 1)::text, 2, '0')), current_date - ((4 + (v_i % 10)) * 365), 'SIGA_PRUEBA_CARGA', format('305100%04s', v_i), case when v_i % 19 = 0 then 'inactivo' else 'activo' end,
      v_i % 8 = 0, case when v_i % 8 = 0 then v_base_2025 + (v_i * v_dias_totales / 60) else null end,
      v_i % 10 = 0, case when v_i % 10 = 0 then v_base_2025 + (((v_i * 4) % 60) * v_dias_totales / 60) else null end
    ) returning id into v_nino_id;
    v_ninos := array_append(v_ninos, v_nino_id);
  end loop;
  for v_i in 1..4 loop
    for v_j in 1..8 loop
      insert into escuela_dominical_lecciones (clase_id, numero, tema, fecha, asistentes, notas)
      values (v_clases[v_i], v_j, format('Leccion %s de la clase %s', v_j, v_i), v_base_2025 + (((v_i * 8 + v_j) * v_dias_totales) / 32), 10 + ((v_i + v_j) % 8), 'SIGA_PRUEBA_CARGA')
      returning id into v_leccion_id;
      insert into escuela_dominical_asistencia (leccion_id, nino_id, asistio)
      select v_leccion_id, n.id, random() > 0.2
      from escuela_dominical_ninos n
      where n.clase_id = v_clases[v_i] and n.congregacion_id = v_congregacion_id;
    end loop;
  end loop;
  for v_i in 1..6 loop
    insert into escuela_dominical_maestros (congregacion_id, persona_id, rol, activo)
    select v_congregacion_id, id, case when v_i = 1 then 'coordinador' else 'maestro' end, true
    from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA'
    order by created_at, id offset (v_i * 9) limit 1
    on conflict do nothing;
  end loop;

  -- ===========================================================================
  -- DAMAS DORCAS
  -- ===========================================================================
  for v_i in 1..40 loop
    v_bautizado := v_i % 6 <> 0;
    insert into damas_dorcas_beneficiarias (congregacion_id, nombres, apellidos, telefono, direccion, responsable_persona_id, estado, bautizado, fecha_bautismo, sellado, fecha_sellado)
    values (v_congregacion_id, format('Dama Prueba %s', lpad(v_i::text, 3, '0')), format('Dorcas SIGA %s', lpad(((v_i - 1) % 20 + 1)::text, 2, '0')), format('305200%04s', v_i), 'SIGA_PRUEBA_CARGA', v_personas[((v_i * 3) % 240) + 1], case when v_i % 13 = 0 then 'inactiva' else 'activa' end,
      v_bautizado, case when v_bautizado then v_base_2025 + (v_i * v_dias_totales / 40) else null end,
      v_i % 5 = 0, case when v_i % 5 = 0 then v_base_2025 + (((v_i * 6) % 40) * v_dias_totales / 40) else null end
    ) returning id into v_beneficiaria_id;
    v_beneficiarias := array_append(v_beneficiarias, v_beneficiaria_id);
  end loop;
  for v_i in 1..30 loop
    insert into damas_dorcas_actividades (congregacion_id, fecha, tipo, descripcion, responsable_persona_id)
    values (v_congregacion_id, v_base_2025 + (v_i * v_dias_totales / 30), (array['visita', 'social', 'espiritual', 'otro'])[1 + (v_i % 4)], 'SIGA_PRUEBA_CARGA', v_personas[((v_i * 5) % 240) + 1])
    returning id into v_actividad_id;
    insert into damas_dorcas_asistencia (actividad_id, beneficiaria_id, asistio)
    select v_actividad_id, b, random() > 0.25
    from unnest(v_beneficiarias[1:25]) as b;
  end loop;

  -- ===========================================================================
  -- OBRA CARCELARIA
  -- ===========================================================================
  if v_distrito_id is not null then
    insert into centros_reclusion (distrito_id, nombre, tipo, ciudad, direccion, activo) values (v_distrito_id, 'SIGA_PRUEBA_CARGA Centro Reclusion 1', 'municipal', 'Ciudad Demo', 'Via 1', true) returning id into v_centro_id;
    insert into centros_reclusion (distrito_id, nombre, tipo, ciudad, direccion, activo) values (v_distrito_id, 'SIGA_PRUEBA_CARGA Centro Reclusion 2', 'mediana_seguridad', 'Ciudad Demo', 'Via 2', true) returning id into v_centro2_id;

    for v_i in 1..15 loop
      insert into obra_carcelaria_delegados (congregacion_id, persona_id, centro_id, permiso_inpec_vigente, permiso_inpec_vencimiento, observaciones, activo)
      values (v_congregacion_id, v_personas[((v_i * 4) % 240) + 1], case when v_i % 2 = 0 then v_centro_id else v_centro2_id end, v_i % 5 <> 0, case when v_i % 5 <> 0 then current_date + (30 + v_i * 10) else current_date - v_i end, 'SIGA_PRUEBA_CARGA', true)
      on conflict do nothing;
    end loop;

    for v_i in 1..50 loop
      v_bautizado := v_i % 4 <> 0;
      v_sellado := v_i % 5 = 0;
      insert into obra_carcelaria_internos (congregacion_id, centro_id, nombres, apellidos, patio, fecha_ingreso_ministerio, estado, bautizado, fecha_bautismo, sellado, fecha_sellado, fecha_liberacion, observaciones)
      values (v_congregacion_id, case when v_i % 2 = 0 then v_centro_id else v_centro2_id end, format('Interno Prueba %s', lpad(v_i::text, 3, '0')), format('Carcelaria SIGA %s', lpad(((v_i - 1) % 20 + 1)::text, 2, '0')), format('Patio %s', 1 + (v_i % 6)), v_base_2025 + (v_i * v_dias_totales / 50), case when v_i % 21 = 0 then 'liberado' when v_i % 33 = 0 then 'inactivo' else 'activo' end,
        v_bautizado, case when v_bautizado then v_base_2025 + (v_i * v_dias_totales / 50) else null end,
        v_sellado, case when v_sellado then v_base_2025 + (((v_i * 6) % 50) * v_dias_totales / 50) else null end,
        case when v_i % 21 = 0 then current_date - (v_i % 60) else null end, 'SIGA_PRUEBA_CARGA')
      returning id into v_interno_id;
      v_internos := array_append(v_internos, v_interno_id);
    end loop;

    for v_i in 1..40 loop
      insert into obra_carcelaria_cultos (congregacion_id, centro_id, fecha, patio, asistentes_total, estudios_biblicos_entregados, responsable_persona_id, notas)
      values (v_congregacion_id, case when v_i % 2 = 0 then v_centro_id else v_centro2_id end, v_base_2025 + (v_i * v_dias_totales / 40), format('Patio %s', 1 + (v_i % 6)), 15 + (v_i % 25), 3 + (v_i % 10), v_personas[((v_i * 2) % 240) + 1], 'SIGA_PRUEBA_CARGA')
      returning id into v_culto_id;
      insert into obra_carcelaria_asistencia (culto_id, interno_id, asistio)
      select v_culto_id, i, random() > 0.3
      from unnest(v_internos[1:20]) as i
      on conflict do nothing;
    end loop;

    for v_i in 1..20 loop
      insert into obra_carcelaria_seguimiento_familiar (congregacion_id, interno_id, contacto_nombre, parentesco, telefono, fecha_visita, tipo_apoyo, responsable_persona_id, notas)
      values (v_congregacion_id, v_internos[((v_i - 1) % array_length(v_internos, 1)) + 1], format('Familiar Prueba %s', v_i), (array['esposa', 'madre', 'hijo', 'hermano'])[1 + (v_i % 4)], format('305300%04s', v_i), v_base_2025 + (v_i * v_dias_totales / 20), (array['visita', 'consejeria', 'espiritual', 'material', 'otro'])[1 + (v_i % 5)], v_personas[((v_i * 3) % 240) + 1], 'SIGA_PRUEBA_CARGA');
    end loop;
  end if;

  -- ===========================================================================
  -- MUSICA
  -- ===========================================================================
  for v_i in 1..4 loop
    insert into musica_grupos (congregacion_id, nombre, tipo, instructor_persona_id, sesion_actual, activo)
    values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Grupo Musica %s', lpad(v_i::text, 2, '0')), (array['coro', 'orquesta', 'alabanza', 'otro'])[v_i], v_personas[((v_i * 6) % 240) + 1], 6 + v_i, true)
    returning id into v_musica_grupo_id;
    v_musica_grupos := array_append(v_musica_grupos, v_musica_grupo_id);
  end loop;
  for v_i in 1..50 loop
    insert into musica_integrantes (congregacion_id, persona_id, grupo_id, instrumento_voz, estado)
    select v_congregacion_id, id, v_musica_grupos[((v_i - 1) % 4) + 1], (array['Voz', 'Guitarra', 'Piano', 'Bateria', 'Bajo'])[1 + (v_i % 5)], case when v_i % 17 = 0 then 'inactivo' else 'activo' end
    from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA' order by created_at, id offset ((v_i * 3) % 200) limit 1
    on conflict do nothing
    returning id into v_musica_integrante_id;
    if v_musica_integrante_id is not null then v_musica_integrantes := array_append(v_musica_integrantes, v_musica_integrante_id); end if;
  end loop;
  for v_i in 1..4 loop
    for v_j in 1..7 loop
      insert into musica_sesiones (grupo_id, numero, tema, fecha, asistentes, notas)
      values (v_musica_grupos[v_i], v_j, format('Ensayo %s del grupo %s', v_j, v_i), v_base_2025 + (((v_i * 7 + v_j) * v_dias_totales) / 28), 6 + ((v_i + v_j) % 8), 'SIGA_PRUEBA_CARGA')
      returning id into v_musica_sesion_id;
    end loop;
  end loop;

  -- ===========================================================================
  -- EDUCACION ARTISTICA
  -- ===========================================================================
  for v_i in 1..3 loop
    insert into artistica_grupos (congregacion_id, nombre, disciplina, instructor_persona_id, sesion_actual, activo)
    values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Grupo Artistica %s', lpad(v_i::text, 2, '0')), (array['danza', 'teatro', 'artes_visuales'])[v_i], v_personas[((v_i * 8) % 240) + 1], 4 + v_i, true)
    returning id into v_artistica_grupo_id;
    v_artistica_grupos := array_append(v_artistica_grupos, v_artistica_grupo_id);
  end loop;
  for v_i in 1..35 loop
    insert into artistica_integrantes (congregacion_id, persona_id, grupo_id, estado)
    select v_congregacion_id, id, v_artistica_grupos[((v_i - 1) % 3) + 1], case when v_i % 15 = 0 then 'inactivo' else 'activo' end
    from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA' order by created_at, id offset ((v_i * 5) % 200) limit 1
    on conflict do nothing
    returning id into v_artistica_integrante_id;
  end loop;
  for v_i in 1..3 loop
    for v_j in 1..8 loop
      insert into artistica_sesiones (grupo_id, numero, tema, fecha, asistentes, notas)
      values (v_artistica_grupos[v_i], v_j, format('Ensayo %s del grupo %s', v_j, v_i), v_base_2025 + (((v_i * 8 + v_j) * v_dias_totales) / 24), 5 + ((v_i + v_j) % 7), 'SIGA_PRUEBA_CARGA')
      returning id into v_artistica_sesion_id;
    end loop;
  end loop;

  -- ===========================================================================
  -- EDUCACION TEOLOGICA
  -- ===========================================================================
  for v_i in 1..3 loop
    insert into teologica_grupos (congregacion_id, nombre, nivel, instructor_persona_id, sesion_actual, activo)
    values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Grupo Teologia %s', lpad(v_i::text, 2, '0')), (array['curso', 'diplomado', 'seminario_biblico'])[v_i], v_personas[((v_i * 9) % 240) + 1], 5 + v_i, true)
    returning id into v_teologica_grupo_id;
    v_teologica_grupos := array_append(v_teologica_grupos, v_teologica_grupo_id);
  end loop;
  for v_i in 1..45 loop
    insert into teologica_integrantes (congregacion_id, persona_id, grupo_id, estado, certificado, fecha_certificado)
    select v_congregacion_id, id, v_teologica_grupos[((v_i - 1) % 3) + 1], case when v_i % 19 = 0 then 'inactivo' else 'activo' end, v_i % 6 = 0, case when v_i % 6 = 0 then v_base_2025 + (v_i * v_dias_totales / 45) else null end
    from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA' order by created_at, id offset ((v_i * 4) % 200) limit 1
    on conflict do nothing
    returning id into v_teologica_integrante_id;
  end loop;
  for v_i in 1..3 loop
    for v_j in 1..8 loop
      insert into teologica_sesiones (grupo_id, numero, tema, fecha, asistentes, notas)
      values (v_teologica_grupos[v_i], v_j, format('Sesion %s del grupo %s', v_j, v_i), v_base_2025 + (((v_i * 8 + v_j) * v_dias_totales) / 24), 8 + ((v_i + v_j) % 10), 'SIGA_PRUEBA_CARGA')
      returning id into v_teologica_sesion_id;
    end loop;
  end loop;

  -- ===========================================================================
  -- CONQUISTADORES PENTECOSTALES (18 a 40 anios)
  -- ===========================================================================
  for v_i in 1..45 loop
    insert into conquistadores_miembros (congregacion_id, persona_id, rol, fecha_ingreso, estado)
    select v_congregacion_id, id, case when v_i % 6 = 0 then 'lider' else 'miembro' end, v_base_2025 + (v_i * v_dias_totales / 45), case when v_i % 21 = 0 then 'inactivo' else 'activo' end
    from personas where congregacion_id = v_congregacion_id and observaciones_pastorales = 'SIGA_PRUEBA_CARGA' order by created_at, id offset ((v_i * 2) % 200) limit 1
    on conflict do nothing
    returning id into v_conquistador_id;
    if v_conquistador_id is not null then v_conquistadores := array_append(v_conquistadores, v_conquistador_id); end if;
  end loop;
  for v_i in 1..25 loop
    insert into conquistadores_actividades (congregacion_id, fecha, tipo, descripcion, responsable_persona_id)
    values (v_congregacion_id, v_base_2025 + (v_i * v_dias_totales / 25), (array['campamento', 'taller', 'social', 'reunion', 'otro'])[1 + (v_i % 5)], 'SIGA_PRUEBA_CARGA', v_personas[((v_i * 4) % 240) + 1])
    returning id into v_actividad_id;
    if array_length(v_conquistadores, 1) > 0 then
      insert into conquistadores_asistencia (actividad_id, miembro_id, asistio)
      select v_actividad_id, m, random() > 0.25
      from unnest(v_conquistadores[1:least(30, array_length(v_conquistadores, 1))]) as m
      on conflict do nothing;
    end if;
  end loop;

  -- ===========================================================================
  -- OBRA SOCIAL (censo de familias compartido con Red de Familias)
  -- ===========================================================================
  for v_i in 1..20 loop
    insert into obra_social_casos (congregacion_id, familia_id, red_familias_caso_id, tipo_necesidad, prioridad, estado, responsable_persona_id, fecha_apertura, notas)
    values (v_congregacion_id, v_familias[((v_i - 1) % array_length(v_familias, 1)) + 1], case when v_i % 3 = 0 and array_length(v_rf_casos, 1) > 0 then v_rf_casos[((v_i - 1) % array_length(v_rf_casos, 1)) + 1] else null end,
      (array['economica', 'alimentaria', 'salud', 'vivienda', 'otra'])[1 + (v_i % 5)], (array['baja', 'media', 'alta'])[1 + (v_i % 3)],
      case when v_i % 6 = 0 then 'resuelta' when v_i % 5 = 0 then 'cerrada' when v_i % 2 = 0 then 'en_apoyo' else 'identificada' end,
      v_personas[((v_i * 5) % 240) + 1], v_base_2025 + (v_i * v_dias_totales / 20), 'SIGA_PRUEBA_CARGA')
    returning id into v_caso_id;
    for v_j in 1..(1 + (v_i % 3)) loop
      insert into obra_social_ayudas (caso_id, fecha, tipo, descripcion, responsable_persona_id)
      values (v_caso_id, v_base_2025 + (((v_i * 3 + v_j) * v_dias_totales) / 60), (array['material', 'economica', 'acompanamiento', 'otra'])[1 + (v_j % 4)], 'SIGA_PRUEBA_CARGA', v_personas[((v_i + v_j) % 240) + 1]);
    end loop;
  end loop;

  insert into configuracion_congregacion (congregacion_id, umbral_alerta, modulo_predeterminado, exigir_responsable, exigir_novedades) values (v_congregacion_id, 18, v_evangelismo_id, true, false) on conflict (congregacion_id) do update set umbral_alerta = excluded.umbral_alerta, modulo_predeterminado = excluded.modulo_predeterminado, exigir_responsable = excluded.exigir_responsable, exigir_novedades = excluded.exigir_novedades;
  insert into preferencias_usuario (usuario_id, recibir_notificaciones, recibir_alertas, formato_fecha) values (v_capturador_id, true, true, 'DD/MM/AAAA') on conflict (usuario_id) do update set recibir_notificaciones = excluded.recibir_notificaciones, recibir_alertas = excluded.recibir_alertas, formato_fecha = excluded.formato_fecha;
  select auth_user_id into v_usuario_id from personas where id = v_personas[1];
  if v_usuario_id is null then v_usuario_id := v_capturador_id; end if;
  for v_i in 1..45 loop insert into notificaciones (usuario_id, titulo, mensaje, tipo, enlace, leida) values (v_usuario_id, format('SIGA_PRUEBA_CARGA Aviso %s', v_i), 'Notificacion generada para probar el centro de notificaciones.', case when v_i % 4 = 0 then 'danger' when v_i % 3 = 0 then 'warning' else 'info' end, '/feligresia?tab=historial', v_i % 5 = 0); end loop;
  raise notice 'Seed listo: 240 personas, 35 familias, 10 comites, 260 seguimientos, 120 amigos, 901 asistencias, 60 estudiantes, 6 grupos juveniles, 15 casos Red de Familias, 60 ninos Escuela Dominical, 40 beneficiarias Damas Dorcas, 50 internos Obra Carcelaria, integrantes de Musica/Artistica/Teologia, 45 conquistadores, 20 casos de Obra Social y 45 notificaciones. Datos distribuidos entre % y %.', v_base_2025, current_date;
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
