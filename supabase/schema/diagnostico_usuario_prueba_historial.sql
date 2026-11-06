-- SIGAP - Diagnostico de solo lectura: ubicar a "usuario de prueba"
-- antes de ver que tiene asociado. No borra nada.

select id, nombres, apellidos, congregacion_id, auth_user_id, created_at
from personas
where nombres ilike '%prueba%' or apellidos ilike '%prueba%' or (nombres || ' ' || apellidos) ilike '%usuario de prueba%';
