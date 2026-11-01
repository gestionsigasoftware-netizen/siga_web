-- SIGAP - Limpieza de datos de prueba para el lanzamiento (2026-11-01)
-- Deja en cero toda la actividad capturada durante las pruebas, sin
-- tocar estructura organizativa, catalogos, accesos/roles ni negocio.
--
-- NO TOCA: congregaciones, distritos, zonas, centros_reclusion,
-- modulos, tipos_actividad, caracteres_culto, rangos_edad_comite,
-- categorias_demograficas, catalogo_congregaciones_ipuc, tipos_comite,
-- cargos (catalogo de roles por modulo), etapas_seguimiento,
-- configuracion_congregacion, refam_lecciones, esfob_lecciones,
-- discipulado_lecciones, mision_lecciones, escuela_dominical_lecciones,
-- roles_sistema, asignaciones_acceso, perfiles_acceso, permisos_perfil,
-- metodos_pago_sigap, suscripciones, preferencias_usuario.
--
-- NO TOCA TODAVIA (requiere revision manual -- ver paso 2):
-- pastores, asignaciones_pastorales, historial_licencias_pastorales,
-- formacion_pastoral.
--
-- IMPORTANTE: hacer un respaldo (export CSV o backup) antes de correr
-- esto. No hay forma de deshacerlo.

begin;

-- 1) Censo: actividad y vinculos directos de las personas de prueba
--    (el censo real -- cuentas con login -- se preserva via el DELETE
--    de personas al final de este script, no aqui).
truncate table
  familias,
  familia_miembros,
  relaciones_familiares,
  cargos_distritales,
  asignaciones_cargo,
  membresias_comite,
  cargos_comite,
  comites,
  registros_actividad,
  movimientos_membresia,
  traslados_feligresia,
  auditoria_feligresia,
  seguimientos_pastorales,
  estados_alerta_pastoral,
  disciplinas_pastorales,
  disciplinas_seguimiento,
  historial_cargos
restart identity;

-- 2) Ruta evangelistica / Amigos (BIS, REFAM, ESFOB, Discipulado, Uno Mas)
truncate table
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
  uno_mas_compromisos
restart identity;

-- 3) Comites operativos (actividad, no los catalogos de tipos/lecciones)
truncate table
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
  escuela_dominical_asistencia,
  mision_grupos,
  mision_estudiantes,
  mision_instituciones,
  mision_lideres,
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
  ujieres_congregacion
restart identity;

-- 4) SEPRI (el centro de reclusion en si no se toca -- solo las
--    solicitudes de eventos y delegados de prueba)
truncate table
  sepri_solicitudes_evento,
  sepri_delegados
restart identity;

-- 5) Soporte / sistema (tickets, solicitudes y logs de las pruebas)
truncate table
  notificaciones,
  reportes_soporte,
  solicitudes_jerarquicas,
  respuestas_solicitud,
  errores_frontend,
  negocio_snapshots_diarios
restart identity;

-- 6) Blindaje: si algun registro de prueba del directorio distrital
--    (tabla `pastores`, que se revisa aparte en el paso 2) quedo
--    enlazado a una persona de censo que se va a borrar ahora, se
--    desvincula primero para que el DELETE de abajo no falle.
update pastores set persona_id = null
where persona_id in (select id from personas where auth_user_id is null);

-- 7) Censo de prueba: se borran todas las personas SIN cuenta de
--    login real (auth_user_id). Las que si tienen login (incluido el
--    super_admin y cualquier otra cuenta con acceso real) se
--    preservan intactas junto con su rol (roles_sistema) y accesos
--    de equipo (asignaciones_acceso) -- ninguna de esas dos tablas se
--    toca en este script.
delete from personas where auth_user_id is null;

commit;

-- Verificacion rapida sugerida (correr aparte, despues del commit):
-- select count(*) from personas;              -- deberia quedar en 1-2
-- select count(*) from congregaciones;         -- debe ser igual que antes
-- select count(*) from amigos;                 -- debe ser 0
-- select count(*) from registros_actividad;    -- debe ser 0
