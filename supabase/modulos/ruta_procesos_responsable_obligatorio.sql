-- SIGA - Hardening: responsable_persona_id obligatorio a nivel de base
-- de datos en ruta_procesos.
--
-- Hoy solo se exige desde el frontend (iniciarOMoverEstacion en
-- src/lib/rutaEvangelistica.js) al iniciar un proceso nuevo. Esto lo
-- refuerza a nivel de base de datos para que ningun otro cliente
-- (script, RPC futuro, etc.) pueda insertar un proceso sin responsable.
--
-- IMPORTANTE: ejecutar SOLO despues de limpiar cualquier fila de
-- ruta_procesos con responsable_persona_id nulo (por ejemplo, datos
-- sembrados por supabase/seed_datos_pruebas.sql). Mientras existan,
-- este ALTER TABLE falla. Verificar antes con:
--
--   select id, congregacion_id, amigo_id, estacion_id
--   from ruta_procesos
--   where responsable_persona_id is null;

alter table ruta_procesos
  alter column responsable_persona_id set not null;
