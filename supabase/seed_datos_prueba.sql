-- SIGA - Seed de carga visual para pruebas.
-- SOLO usar en una base de pruebas. No ejecutar en produccion.
-- Requiere schema.sql, accesos.sql, feligresia.sql y notificaciones.sql.
-- Ejecutar este archivo completo desde Supabase SQL Editor.

begin;

do $$
declare
  v_congregacion_id uuid;
  v_modulo_id uuid;
  v_persona_id uuid;
  v_familia_id uuid;
  v_comite_id uuid;
  v_etapa_id uuid;
  v_usuario_id uuid;
  v_capturador_id uuid;
  v_familias uuid[] := '{}';
  v_personas uuid[] := '{}';
  v_comites uuid[] := '{}';
  v_zonas uuid[] := '{}';
  v_etapas uuid[] := '{}';
  v_categorias uuid[];
  v_tipos uuid[];
  v_i integer;
  v_j integer;
  v_estado text;
  v_bautizado boolean;
begin
  select id into v_congregacion_id
  from congregaciones
  where es_demo = true
  order by created_at
  limit 1;

  if v_congregacion_id is null then
    raise exception 'No existe una congregacion demo. Ejecuta primero crear_congregacion_demo() y usuario_prueba_local.sql.';
  end if;

  select id into v_modulo_id
  from modulos
  where congregacion_id = v_congregacion_id
  order by created_at
  limit 1;

  select array_agg(id order by orden) into v_categorias
  from categorias_demograficas
  where congregacion_id = v_congregacion_id;

  select array_agg(ta.id order by ta.nombre) into v_tipos
  from tipos_actividad ta
  where ta.modulo_id = v_modulo_id;

  if v_modulo_id is null or coalesce(array_length(v_categorias, 1), 0) < 3 or coalesce(array_length(v_tipos, 1), 0) = 0 then
    raise exception 'La congregacion demo no tiene modulos, categorias o tipos de actividad configurados.';
  end if;

  select array_agg(id order by orden) into v_etapas
  from etapas_seguimiento
  where congregacion_id = v_congregacion_id;
  if coalesce(array_length(v_etapas, 1), 0) = 0 then
    raise exception 'La congregacion demo no tiene etapas de seguimiento configuradas.';
  end if;

  select auth_user_id into v_capturador_id
  from personas
  where congregacion_id = v_congregacion_id and auth_user_id is not null
  order by created_at
  limit 1;
  if v_capturador_id is null then
    select id into v_capturador_id from auth.users order by created_at limit 1;
  end if;
  if v_capturador_id is null then
    raise exception 'Se necesita al menos un usuario Auth para crear registros de asistencia.';
  end if;

  -- Familias: 35 hogares con distinto tamano para probar listados y cobertura.
  for v_i in 1..35 loop
    insert into familias (congregacion_id, nombre_familia, direccion, telefono)
    values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Familia %s', lpad(v_i::text, 3, '0')), format('Carrera %s # %s-%s', 10 + (v_i % 20), 12 + (v_i % 40), v_i), format('300555%04s', v_i))
    returning id into v_familia_id;
    v_familias := array_append(v_familias, v_familia_id);
  end loop;

  -- Personas: 240 filas con estados, bautismo, ingreso y asistencia variados.
  for v_i in 1..240 loop
    v_estado := case
      when v_i % 31 = 0 then 'fallecido'
      when v_i % 23 = 0 then 'trasladado'
      when v_i % 17 = 0 then 'inactivo'
      when v_i % 11 = 0 then 'apartado'
      else 'activo'
    end;
    v_bautizado := v_i % 3 <> 0;
    insert into personas (
      congregacion_id, nombres, apellidos, telefono, fecha_nacimiento,
      estado_membresia, bautizado, fecha_bautismo, fecha_ingreso,
      fecha_ultima_asistencia, familia_id, parentesco_familiar, observaciones_pastorales
    ) values (
      v_congregacion_id,
      format('Persona Prueba %s', lpad(v_i::text, 3, '0')),
      format('Carga SIGA %s', lpad(((v_i - 1) % 60 + 1)::text, 3, '0')),
      format('301700%04s', v_i),
      current_date - ((18 + (v_i % 55)) * 365 + (v_i % 365)),
      v_estado,
      v_bautizado,
      case when v_bautizado then current_date - ((1 + (v_i % 15)) * 365) else null end,
      current_date - (v_i % 1460),
      case when v_i % 13 = 0 then null else current_date - (v_i % 100) end,
      v_familias[((v_i - 1) % array_length(v_familias, 1)) + 1],
      case when v_i % 5 = 0 then 'cabeza' when v_i % 2 = 0 then 'hijo' else 'conyuge' end,
      'SIGA_PRUEBA_CARGA'
    ) returning id into v_persona_id;
    v_personas := array_append(v_personas, v_persona_id);
  end loop;

  -- Zonas y etapas para poblar el flujo Amigos.
  for v_i in 1..8 loop
    insert into zonas (congregacion_id, modulo_id, nombre)
    values (v_congregacion_id, v_modulo_id, format('SIGA_PRUEBA_CARGA Zona %s', lpad(v_i::text, 2, '0')))
    returning id into v_persona_id;
    v_zonas := array_append(v_zonas, v_persona_id);
  end loop;

  -- Comites y membresias activas.
  for v_i in 1..10 loop
    insert into comites (congregacion_id, nombre, descripcion, activo)
    values (v_congregacion_id, format('SIGA_PRUEBA_CARGA Comite %s', lpad(v_i::text, 2, '0')), 'SIGA_PRUEBA_CARGA', v_i % 7 <> 0)
    returning id into v_comite_id;
    v_comites := array_append(v_comites, v_comite_id);
    for v_j in 1..24 loop
      insert into membresias_comite (comite_id, persona_id, cargo, fecha_inicio)
      values (v_comite_id, v_personas[((v_j + array_length(v_comites, 1) * 3) % array_length(v_personas, 1)) + 1], case when v_j = 1 then 'Presidente' when v_j = 2 then 'Secretaria' else 'Integrante' end, current_date - (v_j % 700))
      on conflict (comite_id, persona_id, fecha_inicio) do nothing;
    end loop;
  end loop;

  -- Historial de cargos con vigentes y cerrados.
  for v_i in 1..140 loop
    insert into historial_cargos (persona_id, nombre_cargo, area, fecha_inicio, fecha_fin, observaciones)
    values (v_personas[((v_i - 1) % array_length(v_personas, 1)) + 1], format('Cargo de prueba %s', lpad(v_i::text, 3, '0')), case when v_i % 2 = 0 then 'Liderazgo' else 'Servicio' end, current_date - (v_i % 1000), case when v_i % 4 = 0 then current_date - (v_i % 40) else null end, 'SIGA_PRUEBA_CARGA');
  end loop;

  -- Seguimientos pastorales: pendientes, vencidos, completados y cancelados.
  for v_i in 1..260 loop
    insert into seguimientos_pastorales (congregacion_id, persona_id, tipo_alerta, accion, notas, fecha, proxima_fecha, estado)
    values (
      v_congregacion_id,
      v_personas[((v_i - 1) % array_length(v_personas, 1)) + 1],
      case when v_i % 3 = 0 then 'asistencia_persona' when v_i % 3 = 1 then 'bautismo' else 'general' end,
      format('Contacto pastoral de prueba %s', v_i),
      'SIGA_PRUEBA_CARGA',
      current_date - (v_i % 180),
      case when v_i % 4 = 0 then current_date - (v_i % 30) when v_i % 4 = 1 then current_date + (1 + v_i % 45) else null end,
      case when v_i % 5 = 0 then 'completado' when v_i % 7 = 0 then 'cancelado' else 'pendiente' end
    );
  end loop;

  -- Amigos en todas las etapas del proceso.
  for v_i in 1..120 loop
    select id into v_etapa_id from etapas_seguimiento where congregacion_id = v_congregacion_id order by orden offset ((v_i - 1) % greatest(array_length(v_etapas, 1), 1)) limit 1;
    insert into amigos (congregacion_id, nombres, telefono, direccion, sector, invitado_por, fecha_primer_contacto, zona_id, etapa_id, convertido, categoria_asignada_id)
    values (v_congregacion_id, format('Amigo Prueba %s Carga', lpad(v_i::text, 3, '0')), format('302800%04s', v_i), format('Calle %s # %s', 20 + (v_i % 30), v_i), format('Sector %s', 1 + (v_i % 8)), format('Persona Prueba %s', 1 + (v_i % 40)), current_date - (v_i % 420), v_zonas[((v_i - 1) % array_length(v_zonas, 1)) + 1], v_etapa_id, v_i % 6 = 0, v_categorias[((v_i - 1) % array_length(v_categorias, 1)) + 1]);
  end loop;

  -- Asistencia diaria durante casi dos anos: 720 registros para forzar graficos y reportes.
  for v_i in 1..720 loop
    insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, capturado_por, responsable_persona_id, fecha, novedades, desglose)
    values (
      v_congregacion_id,
      v_modulo_id,
      v_tipos[((v_i - 1) % array_length(v_tipos, 1)) + 1],
      v_capturador_id,
      v_personas[((v_i - 1) % array_length(v_personas, 1)) + 1],
      current_date - (720 - v_i),
      'SIGA_PRUEBA_CARGA',
      jsonb_build_object(
        v_categorias[1]::text, 8 + (v_i % 18),
        v_categorias[2]::text, 12 + ((v_i * 2) % 24),
        v_categorias[3]::text, 7 + ((v_i * 3) % 20),
        v_categorias[4]::text, 10 + ((v_i * 5) % 25),
        v_categorias[5]::text, 14 + ((v_i * 7) % 30)
      )
    );
  end loop;

  -- Notificaciones visibles para el usuario demo, si tiene usuario Auth asociado.
  select auth_user_id into v_usuario_id from personas where id = v_personas[1];
  if v_usuario_id is null then
    v_usuario_id := v_capturador_id;
  end if;
  if v_usuario_id is not null then
    for v_i in 1..45 loop
      insert into notificaciones (usuario_id, titulo, mensaje, tipo, enlace, leida)
      values (v_usuario_id, format('SIGA_PRUEBA_CARGA Aviso %s', v_i), 'Notificacion generada para probar el centro de notificaciones.', case when v_i % 4 = 0 then 'danger' when v_i % 3 = 0 then 'warning' else 'info' end, '/feligresia?tab=historial', v_i % 5 = 0);
    end loop;
  end if;

  raise notice 'Seed listo: 240 personas, 35 familias, 10 comites, 140 cargos, 260 seguimientos, 120 amigos, 720 asistencias y 45 notificaciones.';
end $$;

commit;

-- Verificacion rapida.
select 'personas' as entidad, count(*) as filas from personas where observaciones_pastorales = 'SIGA_PRUEBA_CARGA'
union all select 'familias', count(*) from familias where nombre_familia like 'SIGA_PRUEBA_CARGA%'
union all select 'comites', count(*) from comites where descripcion = 'SIGA_PRUEBA_CARGA'
union all select 'seguimientos', count(*) from seguimientos_pastorales where notas = 'SIGA_PRUEBA_CARGA'
union all select 'asistencias', count(*) from registros_actividad where novedades = 'SIGA_PRUEBA_CARGA';
