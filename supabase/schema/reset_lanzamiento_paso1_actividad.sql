-- SIGAP - Limpieza de datos de prueba para el lanzamiento (2026-11-01)
-- Deja en cero toda la actividad capturada durante las pruebas, sin
-- tocar estructura organizativa, catalogos, accesos/roles ni negocio.
--
-- NO TOCA: congregaciones, distritos, zonas, centros_reclusion,
-- modulos, tipos_actividad, caracteres_culto, categorias_demograficas,
-- catalogo_congregaciones_ipuc, tipos_comite, cargos (catalogo de
-- roles por modulo), etapas_seguimiento, configuracion_congregacion,
-- refam_lecciones, esfob_lecciones, discipulado_lecciones,
-- roles_sistema, asignaciones_acceso, perfiles_acceso, permisos_perfil,
-- metodos_pago_sigap, suscripciones, preferencias_usuario.
--
-- NO TOCA TODAVIA (requiere revision manual -- ver paso 2):
-- pastores, asignaciones_pastorales, historial_licencias_pastorales,
-- formacion_pastoral.
--
-- Verificado contra las 264 foreign keys reales del esquema completo
-- (mapeadas con un script, no a ojo) antes de dar el script por bueno:
-- cobertura 100% de las 116 tablas, cero referencias de una tabla que
-- se preserva hacia una que se borra, salvo una (personas.familia_id
-- -> familias) que se resuelve sacando `familias` del TRUNCATE y
-- borrandola aparte con un DELETE normal (ver nota mas abajo).
-- Nota: rangos_edad_comite, escuela_dominical_lecciones y
-- mision_lecciones NO son catalogos globales -- son hijas directas
-- (CASCADE) de comites/escuela_dominical_clases/mision_grupos, asi
-- que van en el TRUNCATE junto con su padre, no se preservan.
--
-- Todo el TRUNCATE va en UNA sola sentencia (no varios bloques): asi
-- Postgres resuelve las dependencias entre las tablas que se borran
-- sin importar el orden en que esten escritas.
--
-- IMPORTANTE: hacer un respaldo (export CSV o backup) antes de correr
-- esto. No hay forma de deshacerlo.

begin;

-- Blindaje: si algun registro de prueba del directorio distrital
-- (tabla `pastores`, que se revisa aparte en el paso 2) quedo
-- enlazado a una persona de censo que se va a borrar, se desvincula
-- primero para que el DELETE final no falle. Se excluye a Damil Lerma
-- (ver mas abajo) para no desvincular su registro real sin necesidad,
-- aunque tampoco pasaria nada grave si se desvinculara por error.
update pastores set persona_id = null
where persona_id in (
  select id from personas
  where auth_user_id is null
    and id <> '454d7953-fc79-44da-99eb-b88dd3d3896b'
);

-- Toda la actividad de prueba, en una sola sentencia.
-- NOTA: `familias` NO va aqui a proposito. TRUNCATE rechaza una tabla
-- si CUALQUIER OTRA tabla tiene un constraint que la referencia --
-- `personas.familia_id -> familias` existe aunque esa columna este en
-- null, y `personas` no se trunca (solo se borra selectivo), asi que
-- Postgres bloquea el TRUNCATE sin importar los datos. `familias` se
-- borra aparte mas abajo con un DELETE normal, que si respeta el
-- ON DELETE SET NULL fila por fila sin esa restriccion estructural.
truncate table
  -- Censo: actividad y vinculos directos de las personas de prueba
  familia_miembros,
  relaciones_familiares,
  cargos_distritales,
  asignaciones_cargo,
  membresias_comite,
  cargos_comite,
  comites,
  rangos_edad_comite,
  registros_actividad,
  movimientos_membresia,
  traslados_feligresia,
  auditoria_feligresia,
  seguimientos_pastorales,
  estados_alerta_pastoral,
  disciplinas_pastorales,
  disciplinas_seguimiento,
  historial_cargos,
  -- Ruta evangelistica / Amigos (BIS, REFAM, ESFOB, Discipulado, Uno Mas)
  amigos,
  amigos_notas,
  familia_amigos,
  historial_amigos,
  bis_atenciones,
  refam_grupos,
  refam_participantes,
  refam_asistencia_participante,
  refam_reuniones,
  refam_progreso_leccion,
  refam_notas_leccion,
  esfob_procesos,
  esfob_progreso_leccion,
  esfob_notas_leccion,
  discipulado_procesos,
  discipulado_progreso_leccion,
  discipulado_notas_leccion,
  ruta_estaciones,
  ruta_procesos,
  ruta_diagnosticos,
  uno_mas_compromisos,
  -- Comites operativos (actividad, no los catalogos de tipos)
  red_familias_casos,
  red_familias_actividades,
  red_familias_visitas,
  obra_social_casos,
  obra_social_ayudas,
  obra_carcelaria_cultos,
  obra_carcelaria_asistencia,
  obra_carcelaria_internos,
  obra_carcelaria_delegados,
  obra_carcelaria_reinsercion,
  obra_carcelaria_seguimiento_familiar,
  conquistadores_miembros,
  conquistadores_actividades,
  conquistadores_asistencia,
  damas_dorcas_beneficiarias,
  damas_dorcas_actividades,
  damas_dorcas_asistencia,
  escuela_dominical_clases,
  escuela_dominical_maestros,
  escuela_dominical_ninos,
  escuela_dominical_lecciones,
  escuela_dominical_asistencia,
  mision_grupos,
  mision_estudiantes,
  mision_instituciones,
  mision_lideres,
  mision_lecciones,
  mision_asistencia_estudiante,
  musica_grupos,
  musica_integrantes,
  musica_sesiones,
  musica_asistencia,
  artistica_grupos,
  artistica_integrantes,
  artistica_sesiones,
  artistica_asistencia,
  teologica_grupos,
  teologica_integrantes,
  teologica_sesiones,
  teologica_asistencia,
  ujieres_congregacion,
  -- SEPRI (el centro de reclusion en si no se toca)
  sepri_solicitudes_evento,
  sepri_delegados,
  -- Soporte / sistema (tickets, solicitudes y logs de las pruebas)
  notificaciones,
  reportes_soporte,
  solicitudes_jerarquicas,
  respuestas_solicitud,
  errores_frontend,
  negocio_snapshots_diarios
restart identity;

-- `familias` aparte, con DELETE normal (ver nota arriba) -- a esta
-- altura `familia_miembros` ya esta vacia (truncada arriba), asi que
-- no hay nada que cascadear. Cualquier persona (real o de prueba) que
-- tuviera familia_id apuntando aqui queda automaticamente en null.
delete from familias;

-- Censo de prueba: se borran todas las personas SIN cuenta de login
-- real (auth_user_id). Las que si tienen login (incluido el
-- super_admin y cualquier otra cuenta con acceso real) se preservan
-- intactas junto con su rol (roles_sistema) y accesos de equipo
-- (asignaciones_acceso) -- ninguna de esas dos tablas se toca aqui.
--
-- Excepcion confirmada por el usuario via el diagnostico de roles
-- huerfanos: el pastor Damil Lerma (persona 454d7953-fc79-44da-99eb-
-- b88dd3d3896b, PUERTO TEJADA CAUCA CENTRAL) es real y ya tiene un rol
-- 'local' activo en roles_sistema, pero todavia no completo su cuenta
-- de acceso (por eso auth_user_id es null) -- se excluye explicitamente
-- para no borrar al pastor real ni su rol.
delete from personas
where auth_user_id is null
  and id <> '454d7953-fc79-44da-99eb-b88dd3d3896b';

commit;

-- Verificacion rapida sugerida (correr aparte, despues del commit):
-- select count(*) from personas;              -- deberia quedar en 1-2
-- select count(*) from congregaciones;         -- debe ser igual que antes
-- select count(*) from amigos;                 -- debe ser 0
-- select count(*) from registros_actividad;    -- debe ser 0
-- select count(*) from comites;                -- debe ser 0
