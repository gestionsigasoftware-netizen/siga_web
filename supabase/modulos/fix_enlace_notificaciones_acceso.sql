-- SIGA - Corrige el enlace de las notificaciones "Nuevo perfil de acceso"
-- ya guardadas antes de arreglar notificar_asignacion_acceso() en
-- notificaciones.sql (apuntaban a /configuracion-sistema en vez de /perfil).
-- Ejecutar una sola vez, despues de volver a correr notificaciones.sql.

update notificaciones
set enlace = '/perfil'
where titulo = 'Nuevo perfil de acceso'
  and enlace = '/configuracion-sistema';
