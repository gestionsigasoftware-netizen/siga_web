-- SIGAP - Acceso demo publico, paso 2: persona de la cuenta demo +
-- censo y actividad de ejemplo.
--
-- IDs confirmados por el usuario tras correr el paso 1 y crear la
-- cuenta de Authentication a mano:
--   congregacion demo: 9ec5c3d8-41f4-4af0-b9d7-a0019b99c27b
--   auth_user_id (cuenta de login demo): a2866ced-0d3d-4771-9b42-b415a9a19427
--
-- Alcance deliberado de este seed: censo (personas) + actividad
-- reciente (registros_actividad), que es lo que mueve la piramide
-- poblacional, la salud de datos y el grafico de actividad -- las
-- piezas que mas se notan al abrir la demo. Familias y comites
-- quedan fuera de este primer seed a proposito (se puede ampliar
-- despues sin tocar lo de aqui).

begin;

do $$
declare
  v_congregacion_id uuid := '9ec5c3d8-41f4-4af0-b9d7-a0019b99c27b';
  v_auth_user_id uuid := 'a2866ced-0d3d-4771-9b42-b415a9a19427';
  v_persona_pastor_id uuid;
  v_modulo_id uuid;
  v_tipo_martes uuid;
  v_tipo_jueves uuid;
  v_tipo_sabado uuid;
  v_tipo_domingo uuid;
  v_cat_ninos uuid;
  v_cat_adolescentes uuid;
  v_cat_jovenes uuid;
  v_cat_caballeros uuid;
  v_cat_damas uuid;
  v_cat_ancianos uuid;
begin
  -- 1) Persona + login de la cuenta demo (si ya existia por una
  --    corrida anterior de este script, lo deja igual en vez de
  --    duplicar).
  insert into personas (congregacion_id, auth_user_id, nombres, apellidos, fecha_nacimiento, genero, estado_membresia, estado_civil, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ingreso)
  values (v_congregacion_id, v_auth_user_id, 'Pastor', 'Demo', '1979-03-14', 'masculino', 'activo', 'casado', true, '1998-06-01', true, '1999-02-14', '2015-01-01')
  on conflict (auth_user_id) do update set congregacion_id = excluded.congregacion_id
  returning id into v_persona_pastor_id;

  insert into roles_sistema (persona_id, nivel, congregacion_id)
  select v_persona_pastor_id, 'local', v_congregacion_id
  where not exists (
    select 1 from roles_sistema where persona_id = v_persona_pastor_id and nivel = 'local' and congregacion_id = v_congregacion_id and fecha_fin is null
  );

  -- 2) Censo de ejemplo -- nombres claramente ficticios, edades
  --    variadas para que la piramide poblacional se vea real. Sin
  --    clave natural para detectar duplicados (id es un uuid nuevo
  --    cada vez), asi que se protege con un conteo: si ya hay mas de
  --    1 persona (el pastor del paso 1), no vuelve a insertar -- para
  --    que correr este script dos veces no duplique el censo.
  if (select count(*) from personas where congregacion_id = v_congregacion_id) <= 1 then
  insert into personas (congregacion_id, nombres, apellidos, fecha_nacimiento, genero, estado_membresia, estado_civil, bautizado, fecha_bautismo, sellado_espiritu_santo, fecha_sellado, fecha_ingreso)
  values
    (v_congregacion_id, 'Ana', 'Rodríguez Ejemplo', '1981-05-02', 'femenino', 'activo', 'casado', true, '2001-07-10', true, '2002-01-12', '2010-03-01'),
    (v_congregacion_id, 'Carlos', 'Martínez Ejemplo', '1975-11-20', 'masculino', 'activo', 'casado', true, '1995-04-22', true, '1996-02-18', '2008-06-15'),
    (v_congregacion_id, 'Diana', 'Gómez Ejemplo', '1990-02-17', 'femenino', 'activo', 'union_libre', true, '2012-08-05', false, null, '2012-01-20'),
    (v_congregacion_id, 'Esteban', 'López Ejemplo', '1988-09-09', 'masculino', 'activo', 'soltero', false, null, false, null, '2024-04-01'),
    (v_congregacion_id, 'Fabiola', 'Torres Ejemplo', '1965-01-30', 'femenino', 'activo', 'viudo', true, '1985-03-03', true, '1986-07-20', '1995-01-01'),
    (v_congregacion_id, 'Gabriel', 'Ramírez Ejemplo', '1999-06-25', 'masculino', 'activo', 'soltero', true, '2019-09-15', false, null, '2019-05-01'),
    (v_congregacion_id, 'Helena', 'Castro Ejemplo', '2003-03-11', 'femenino', 'activo', 'soltero', true, '2021-10-10', false, null, '2021-06-01'),
    (v_congregacion_id, 'Iván', 'Suárez Ejemplo', '2010-07-04', 'masculino', 'activo', 'soltero', false, null, false, null, '2016-01-01'),
    (v_congregacion_id, 'Julia', 'Mendoza Ejemplo', '2012-12-19', 'femenino', 'activo', 'soltero', false, null, false, null, '2018-02-01'),
    (v_congregacion_id, 'Kevin', 'Herrera Ejemplo', '2015-08-08', 'masculino', 'activo', 'soltero', false, null, false, null, '2020-01-01'),
    (v_congregacion_id, 'Laura', 'Pérez Ejemplo', '1955-04-23', 'femenino', 'activo', 'casado', true, '1975-01-01', true, '1976-05-10', '1990-01-01'),
    (v_congregacion_id, 'Marco', 'Vargas Ejemplo', '1950-10-02', 'masculino', 'activo', 'casado', true, '1970-01-01', true, '1971-03-15', '1988-01-01'),
    (v_congregacion_id, 'Natalia', 'Rojas Ejemplo', '1993-05-14', 'femenino', 'activo', 'soltero', true, '2013-11-01', true, '2014-03-01', '2013-01-01'),
    (v_congregacion_id, 'Oscar', 'Jiménez Ejemplo', '1983-08-27', 'masculino', 'activo', 'casado', true, '2003-06-06', true, '2004-01-01', '2003-01-01'),
    (v_congregacion_id, 'Paula', 'Morales Ejemplo', '2007-02-28', 'femenino', 'activo', 'soltero', true, '2023-07-16', false, null, '2023-02-01'),
    (v_congregacion_id, 'Quintín', 'Ortiz Ejemplo', '1972-03-19', 'masculino', 'activo', 'casado', true, '1992-02-02', true, '1993-04-04', '2000-01-01'),
    (v_congregacion_id, 'Rosa', 'Flores Ejemplo', '1960-06-06', 'femenino', 'activo', 'viudo', true, '1980-01-01', true, '1981-01-01', '1992-01-01'),
    (v_congregacion_id, 'Samuel', 'Cruz Ejemplo', '1996-01-15', 'masculino', 'activo', 'soltero', true, '2016-05-05', false, null, '2016-01-01'),
    (v_congregacion_id, 'Tatiana', 'Reyes Ejemplo', '2001-09-22', 'femenino', 'activo', 'soltero', true, '2020-02-02', false, null, '2019-01-01'),
    (v_congregacion_id, 'Uriel', 'Guerrero Ejemplo', '1978-12-12', 'masculino', 'apartado', 'divorciado', true, '1998-01-01', true, '1999-01-01', '2005-01-01'),
    (v_congregacion_id, 'Valentina', 'Peña Ejemplo', '1992-07-07', 'femenino', 'activo', 'casado', true, '2010-03-03', true, '2010-12-25', '2010-01-01'),
    (v_congregacion_id, 'Wilson', 'Campos Ejemplo', '1986-04-04', 'masculino', 'activo', 'casado', true, '2006-09-09', true, '2007-02-02', '2006-01-01'),
    (v_congregacion_id, 'Ximena', 'Aguilar Ejemplo', '2018-03-03', 'femenino', 'activo', 'soltero', false, null, false, null, '2021-01-01'),
    (v_congregacion_id, 'Yesid', 'Navarro Ejemplo', '1945-05-05', 'masculino', 'inactivo', 'viudo', true, '1965-01-01', true, '1966-01-01', '1980-01-01');
  end if;

  -- 3) Actividad de ejemplo -- 8 cultos repartidos en las ultimas 8
  --    semanas, para que el grafico de actividad y la salud de datos
  --    no se vean en cero.
  select id into v_modulo_id from modulos where congregacion_id = v_congregacion_id and nombre_modulo = 'Ujieres' limit 1;
  select id into v_tipo_martes from tipos_actividad where modulo_id = v_modulo_id and nombre = 'Culto Martes';
  select id into v_tipo_jueves from tipos_actividad where modulo_id = v_modulo_id and nombre = 'Culto Jueves';
  select id into v_tipo_sabado from tipos_actividad where modulo_id = v_modulo_id and nombre = 'Culto Sábado';
  select id into v_tipo_domingo from tipos_actividad where modulo_id = v_modulo_id and nombre = 'Culto Domingo Noche';
  select id into v_cat_ninos from categorias_demograficas where congregacion_id = v_congregacion_id and nombre = 'Niños';
  select id into v_cat_adolescentes from categorias_demograficas where congregacion_id = v_congregacion_id and nombre = 'Adolescentes';
  select id into v_cat_jovenes from categorias_demograficas where congregacion_id = v_congregacion_id and nombre = 'Jóvenes';
  select id into v_cat_caballeros from categorias_demograficas where congregacion_id = v_congregacion_id and nombre = 'Caballeros';
  select id into v_cat_damas from categorias_demograficas where congregacion_id = v_congregacion_id and nombre = 'Damas';
  select id into v_cat_ancianos from categorias_demograficas where congregacion_id = v_congregacion_id and nombre = 'Ancianos';

  if (select count(*) from registros_actividad where congregacion_id = v_congregacion_id) = 0 then
  insert into registros_actividad (congregacion_id, modulo_id, tipo_actividad_id, capturado_por, responsable_persona_id, fecha, desglose)
  values
    (v_congregacion_id, v_modulo_id, v_tipo_domingo, v_auth_user_id, v_persona_pastor_id, current_date - 7,  jsonb_build_object(v_cat_ninos::text, 5, v_cat_adolescentes::text, 4, v_cat_jovenes::text, 8, v_cat_caballeros::text, 10, v_cat_damas::text, 12, v_cat_ancianos::text, 3)),
    (v_congregacion_id, v_modulo_id, v_tipo_martes,  v_auth_user_id, v_persona_pastor_id, current_date - 5,  jsonb_build_object(v_cat_ninos::text, 2, v_cat_jovenes::text, 5, v_cat_caballeros::text, 6, v_cat_damas::text, 7)),
    (v_congregacion_id, v_modulo_id, v_tipo_jueves,  v_auth_user_id, v_persona_pastor_id, current_date - 3,  jsonb_build_object(v_cat_jovenes::text, 6, v_cat_caballeros::text, 7, v_cat_damas::text, 9)),
    (v_congregacion_id, v_modulo_id, v_tipo_sabado,  v_auth_user_id, v_persona_pastor_id, current_date - 2,  jsonb_build_object(v_cat_adolescentes::text, 6, v_cat_jovenes::text, 9)),
    (v_congregacion_id, v_modulo_id, v_tipo_domingo, v_auth_user_id, v_persona_pastor_id, current_date,      jsonb_build_object(v_cat_ninos::text, 6, v_cat_adolescentes::text, 5, v_cat_jovenes::text, 9, v_cat_caballeros::text, 11, v_cat_damas::text, 13, v_cat_ancianos::text, 4));
  end if;
end;
$$;

commit;

-- Verificacion sugerida (correr aparte, de solo lectura):
-- select count(*) from personas where congregacion_id = '9ec5c3d8-41f4-4af0-b9d7-a0019b99c27b';
-- select count(*) from registros_actividad where congregacion_id = '9ec5c3d8-41f4-4af0-b9d7-a0019b99c27b';
-- Y entrar por /demo (con VITE_DEMO_EMAIL/VITE_DEMO_PASSWORD ya
-- configuradas) para confirmar que el censo y la actividad se ven.
