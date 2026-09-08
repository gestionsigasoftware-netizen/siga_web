-- SIGA - Purgar ruido de auditoria de comites en Puerto Tejada Cauca
-- Central, generado por cargas/limpiezas de datos de prueba (no por
-- actividad pastoral real).
--
-- Confirmado contra la base real (2026-09-08): 1.505 filas en
-- auditoria_feligresia para esta congregacion (entidad in ('comites',
-- 'membresias_comite')), repartidas en exactamente 4 fechas (2026-08-26,
-- 2026-08-28, 2026-09-01, 2026-09-05) -- coinciden con las cargas de
-- datos de prueba de esta sesion, no con los 3 comites reales que
-- existen hoy (Comite de Escuela Dominical, Comite de Evangelismo,
-- Comite Alabanza). Confirmado por el propio usuario: "esos delete son
-- porque cargue datos prueba y despues los elimine".
--
-- auditoria_feligresia no tiene politica de DELETE para el cliente a
-- proposito (protege el historial real) -- por eso esto se ejecuta
-- manualmente aqui, una sola vez, y no desde la app.

delete from auditoria_feligresia
where congregacion_id = 'a9420cae-cacd-4484-875f-f54548f9f639'
  and entidad in ('comites', 'membresias_comite');

-- Verificacion rapida despues de ejecutar (deberia devolver 0 filas):
-- select count(*) from auditoria_feligresia
--   where congregacion_id = 'a9420cae-cacd-4484-875f-f54548f9f639'
--     and entidad in ('comites', 'membresias_comite');
