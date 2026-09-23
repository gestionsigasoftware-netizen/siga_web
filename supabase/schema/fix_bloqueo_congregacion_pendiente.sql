-- SIGA - Una congregacion pendiente de aprobacion o suspendida no debe
-- poder usar SIGAP de verdad.
--
-- Encontrado el 2026-09-23 (a partir de una pregunta real del usuario):
-- `congregaciones.estado` (pendiente_aprobacion/activa/suspendida) no
-- bloqueaba nada tecnicamente. crear_congregacion_con_pastor() siembra
-- los modulos operativos y envia la invitacion por correo de inmediato,
-- antes de que nadie apruebe la congregacion -- y ni mis_congregaciones()
-- ni ninguna pantalla revisaban `estado`. El texto de Aprobaciones.jsx
-- ("Una congregacion registrada no puede usar el sistema hasta ser
-- aprobada aqui") no era cierto en la practica: "aprobar" era solo una
-- etiqueta administrativa.
--
-- Diseno (evita romper la visibilidad del propio pastor sobre su
-- congregacion, que es lo que pasaria si se tocara mis_congregaciones()
-- sin agregar antes esta politica nueva -- el sidebar y cualquier
-- pantalla que necesite mostrar "tu congregacion esta pendiente" se
-- quedarian en blanco):
--
-- 1. Politica nueva, aditiva: un pastor SIEMPRE puede ver la fila de su
--    propia congregacion (nombre, estado, etc.) sin importar el estado.
-- 2. Recien ahi, mis_congregaciones() -- la funcion detras de casi todas
--    las politicas RLS operativas (personas, familias, comites,
--    registros_actividad, todos los modulos de ministerio) -- exige
--    estado = 'activa' en la rama local. Las ramas de distrital/
--    nacional/super_admin quedan intactas (siguen viendo congregaciones
--    pendientes en Aprobaciones/dashboards, como deben).
--
-- Ejecutar despues de schema.sql. Es repetible.

drop policy if exists "congregaciones_select_propia_pendiente" on congregaciones;
create policy "congregaciones_select_propia_pendiente" on congregaciones
for select to authenticated
using (id in (
  select congregacion_id from roles_sistema
  where persona_id = mi_persona_id() and nivel = 'local' and fecha_fin is null
));

create or replace function mis_congregaciones() returns setof uuid language sql stable security definer as $$
  select r.congregacion_id from roles_sistema r
    join congregaciones c on c.id = r.congregacion_id
   where r.persona_id = mi_persona_id() and r.nivel = 'local' and r.fecha_fin is null and c.estado = 'activa'
  union
  select c.id from congregaciones c where c.distrito_id in (select mis_distritos())
  union
  select id from congregaciones where es_super_admin() or es_nacional();
$$;
